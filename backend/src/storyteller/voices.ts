import { readFileSync } from 'node:fs';
import { NARRATOR, type VoiceAsset } from '@tabletop/contracts';
import { z } from 'zod';

/**
 * Live voices: the one place the voice provider lives (owner, Nov 16: OpenAI's gpt-4o-mini-tts,
 * not ElevenLabs, and no Google Cloud). Each line comes back whole; its length is read from the
 * audio itself, so the client times the beat by the real sound. The audio travels inline as a
 * data URL, as the contract says; the key never leaves the backend.
 *
 * Who sounds like what is the book's data, in `art/voice/live.json`: a voice and a direction
 * (`instructions`) per speaker, steered toward the cast in `docs/design-language.md`.
 */

const API = 'https://api.openai.com/v1/audio/speech';

const LiveVoices = z.object({
  model: z.string().min(1),
  /** Speaker id (a cast id or "narrator") to a built-in voice and how to perform it. */
  voices: z.record(z.string(), z.object({ voice: z.string().min(1), instructions: z.string().min(1), speed: z.number().min(0.25).max(4).default(1) })),
});
export type LiveVoices = z.infer<typeof LiveVoices>;

export interface Voices {
  speak(speaker: string, text: string): Promise<VoiceAsset | null>;
  /** Characters voiced this process, for the cost report. */
  readonly characters: number;
  /** A short sound effect, made on the spot. Not offered by this provider: always null (v2's SOUND step). */
  sound(description: string, seconds: number): Promise<VoiceAsset | null>;
}

export function readLiveVoices(path: string): LiveVoices | null {
  try {
    return LiveVoices.parse(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return null;
  }
}

/** OpenAI's published price for gpt-4o-mini-tts (Nov 2026): $0.60 per 1M text tokens, $12 per 1M audio tokens. */
export const TTS_PRICE = { textPerToken: 0.6 / 1e6, audioPerToken: 12 / 1e6 } as const;

/**
 * An estimate of a line's cost from its characters and its length, for the per-story log: about 4
 * characters a text token, and the audio at OpenAI's rough figure of $0.015 a minute. Measured
 * figures replace it once the live proof has run.
 */
export function estimateTtsCost(characters: number, audioMs: number): number {
  return (characters / 4) * TTS_PRICE.textPerToken + (audioMs / 60_000) * 0.015;
}

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** An MP3's length in ms, by walking its frames (any bitrate, MPEG 1 or 2). Null if it isn't one. */
export function mp3DurationMs(bytes: Uint8Array): number | null {
  let i = 0;
  // Skip an ID3v2 tag.
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33 && bytes.length > 10) {
    i = 10 + (((bytes[6]! & 0x7f) << 21) | ((bytes[7]! & 0x7f) << 14) | ((bytes[8]! & 0x7f) << 7) | (bytes[9]! & 0x7f));
  }
  let samples = 0;
  let rate = 0;
  let frames = 0;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff || (bytes[i + 1]! & 0xe0) !== 0xe0) {
      i += 1;
      continue;
    }
    const version = (bytes[i + 1]! >> 3) & 0x3; // 3: MPEG1, 2: MPEG2, 0: MPEG2.5
    const layer = (bytes[i + 1]! >> 1) & 0x3; // 1: Layer III
    const bitIndex = (bytes[i + 2]! >> 4) & 0xf;
    const rateIndex = (bytes[i + 2]! >> 2) & 0x3;
    const padding = (bytes[i + 2]! >> 1) & 0x1;
    if (version === 1 || layer !== 1 || rateIndex === 3 || bitIndex === 0 || bitIndex === 15) {
      i += 1;
      continue;
    }
    const kbps = (version === 3 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bitIndex]!;
    rate = RATES[version]![rateIndex]!;
    const perFrame = version === 3 ? 1152 : 576;
    const length = Math.floor(((perFrame / 8) * kbps * 1000) / rate) + padding;
    if (length <= 4) break;
    samples += perFrame;
    frames += 1;
    i += length;
  }
  return frames > 0 && rate > 0 ? Math.round((samples / rate) * 1000) : null;
}

export interface VoicesOptions {
  log?: (m: string) => void;
  fetch?: typeof fetch;
  /** Per call, so a slow line falls back to captions instead of holding the story. */
  timeoutMs?: number;
}

/** OpenAI's text to speech, as the Storyteller's voices. Without a key or a config, every line is captions only. */
export function createVoices(apiKey: string | undefined, config: LiveVoices | null, { log = console.error, fetch: send = fetch, timeoutMs = 8000 }: VoicesOptions = {}): Voices {
  let characters = 0;
  return {
    get characters() {
      return characters;
    },
    sound: async () => null,
    async speak(speaker, text) {
      if (!apiKey || !config) return null;
      const v = config.voices[speaker] ?? config.voices[NARRATOR];
      if (!v) return null;
      const started = Date.now();
      let response: Response;
      try {
        response = await send(API, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model: config.model, voice: v.voice, input: text, instructions: v.instructions, response_format: 'mp3', speed: v.speed }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (cause) {
        log(`voice ${speaker}: no answer (${String(cause).slice(0, 80)})`);
        return null;
      }
      if (!response.ok) {
        log(`voice ${speaker}: openai answered ${response.status} ${(await response.text().catch(() => '')).slice(0, 160)}`);
        return null;
      }
      const audio = new Uint8Array(await response.arrayBuffer());
      if (audio.length === 0) return null;
      characters += text.length;
      // Read from the frames; failing that, about 15 characters a second.
      const durationMs = Math.max(300, mp3DurationMs(audio) ?? Math.round((text.length / 15) * 1000));
      log(`voice ${speaker} ${text.length} chars in ${Date.now() - started} ms, ${durationMs} ms long`);
      return { url: `data:audio/mpeg;base64,${Buffer.from(audio).toString('base64')}`, durationMs };
    },
  };
}
