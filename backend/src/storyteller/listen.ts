import { readFileSync } from 'node:fs';
import { BackendError, LISTENING_BUSY, type TranscribeRequest } from '@tabletop/contracts';

/**
 * Hold to talk, on the backend: the one place the speech-to-text provider lives (owner, Nov 16:
 * Groq's hosted Whisper; no ElevenLabs, no Google Cloud). The headset records while the tab is
 * held and sends the clip on release; this turns it into words. The key never leaves here.
 */

const API = 'https://api.groq.com/openai/v1/audio/transcriptions';
export const LISTEN_MODEL = 'whisper-large-v3-turbo';
/** Groq bills at least 10 seconds a request ($0.04 an hour of audio for this model, Nov 2026). */
export const MIN_BILLED_S = 10;

const EXT: Record<TranscribeRequest['audio']['mime'], string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/wav': 'wav' };

/** The listening prompt from the book's data, or null. */
export function readListenPrompt(path: string): string | null {
  try {
    const value = (JSON.parse(readFileSync(path, 'utf8')) as { prompt?: unknown }).prompt;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/** About how many seconds a clip is, before it's heard: Opus at about 32 kbps (4 KB a second), never under Groq's minimum. */
export function billedSecondsOf(base64Length: number): number {
  return Math.max(MIN_BILLED_S, Math.ceil((base64Length * 0.75) / 4000));
}

export interface Transcriber {
  /** The words, and the clip's real length when the service says. Throws LISTENING_BUSY on the free tier's rate limit. */
  transcribe(audio: TranscribeRequest['audio']): Promise<{ text: string; seconds: number | null }>;
}

export interface TranscriberOptions {
  /** The book's names and things, so they're heard as the story spells them (`art/voice/listen.json`). */
  prompt?: string | null;
  log?: (m: string) => void;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export function createTranscriber(apiKey: string | undefined, { prompt = null, log = console.error, fetch: send = fetch, timeoutMs = 8000 }: TranscriberOptions = {}): Transcriber {
  return {
    async transcribe(audio) {
      if (!apiKey) throw new BackendError('upstream_failed', 'listening is off', false);
      const form = new FormData();
      form.append('file', new Blob([Buffer.from(audio.base64, 'base64')], { type: audio.mime }), `hold.${EXT[audio.mime]}`);
      form.append('model', LISTEN_MODEL);
      form.append('language', 'en');
      form.append('response_format', 'verbose_json');
      form.append('temperature', '0');
      if (prompt) form.append('prompt', prompt.slice(0, 800));
      const started = Date.now();
      let response: Response;
      try {
        response = await send(API, { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(timeoutMs) });
      } catch (cause) {
        log(`listening: no answer (${String(cause).slice(0, 80)})`);
        throw new BackendError('upstream_failed', 'listening did not answer', true);
      }
      // The free tier's rate limit: the reader hears "I couldn't hear you just then", and plays on.
      if (response.status === 429) {
        log('listening: rate limited');
        throw new BackendError('quota_exceeded', LISTENING_BUSY, true);
      }
      if (!response.ok) {
        log(`listening: groq answered ${response.status} ${(await response.text().catch(() => '')).slice(0, 160)}`);
        throw new BackendError('upstream_failed', `listening answered ${response.status}`, true);
      }
      const body = (await response.json().catch(() => ({}))) as { text?: unknown; duration?: unknown };
      const text = typeof body.text === 'string' ? body.text.trim().slice(0, 600) : '';
      const seconds = typeof body.duration === 'number' ? body.duration : null;
      log(`listening: ${seconds ?? '?'} s heard in ${Date.now() - started} ms, ${text.length} chars`);
      return { text, seconds };
    },
  };
}
