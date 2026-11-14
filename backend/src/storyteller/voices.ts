import { readFileSync } from 'node:fs';
import { NARRATOR, type VoiceAsset } from '@tabletop/contracts';
import { z } from 'zod';

/**
 * Live voices through ElevenLabs. Each line comes back whole with its timing, so the client times
 * the beat by the real audio. The audio travels inline as a data URL; the key never leaves here.
 */

const LiveVoices = z.object({
  model: z.string().min(1),
  /** Speaker id (a cast id or "narrator") to an ElevenLabs voice id and its settings. */
  voices: z.record(z.string(), z.object({ voiceId: z.string().min(1), stability: z.number(), similarity: z.number(), style: z.number().default(0), speed: z.number().default(1) })),
});
export type LiveVoices = z.infer<typeof LiveVoices>;

export interface Voices {
  speak(speaker: string, text: string): Promise<VoiceAsset | null>;
  /** Characters voiced this process, for the per-evening caps and the cost report. */
  readonly characters: number;
}

export function readLiveVoices(path: string): LiveVoices | null {
  try {
    return LiveVoices.parse(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return null;
  }
}

const Timed = z.object({
  audio_base64: z.string().min(1),
  alignment: z.object({ character_end_times_seconds: z.array(z.number()) }).nullable().optional(),
});

export function createVoices(apiKey: string | undefined, config: LiveVoices | null, log: (m: string) => void = console.error): Voices {
  let characters = 0;
  return {
    get characters() {
      return characters;
    },
    async speak(speaker, text) {
      if (!apiKey || !config) return null;
      const v = config.voices[speaker] ?? config.voices[NARRATOR];
      if (!v) return null;
      const started = Date.now();
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.voiceId}/with-timestamps?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: config.model,
          voice_settings: { stability: v.stability, similarity_boost: v.similarity, style: v.style, speed: v.speed },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        log(`elevenlabs ${response.status} for ${speaker}: ${(await response.text().catch(() => '')).slice(0, 160)}`);
        return null;
      }
      const parsed = Timed.safeParse(await response.json());
      if (!parsed.success) return null;
      characters += text.length;
      const ends = parsed.data.alignment?.character_end_times_seconds ?? [];
      // Without timing, 64 kbps MP3: bytes times 8 over 64,000 is the length in seconds.
      const bytes = (parsed.data.audio_base64.length * 3) / 4;
      const durationMs = Math.round(1000 * (ends.length ? ends[ends.length - 1]! + 0.15 : (bytes * 8) / 64_000));
      log(`voice ${speaker} ${text.length} chars in ${Date.now() - started} ms, ${durationMs} ms long`);
      return { url: `data:audio/mpeg;base64,${parsed.data.audio_base64}`, durationMs: Math.max(300, durationMs) };
    },
  };
}
