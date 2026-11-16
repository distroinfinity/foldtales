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

/** The longest hold heard, as the client cuts it off, with a little room for the container's rounding. */
export const MAX_HOLD_S = 30.5;

/** Seconds billed for a clip this long: never under Groq's minimum. */
export function billedSecondsOf(seconds: number): number {
  return Math.max(MIN_BILLED_S, Math.ceil(seconds));
}

const OPUS_RATE = 48_000;

/** An Ogg Opus file's length: the last page's granule position, less the codec's pre-skip, at 48 kHz. */
function oggOpusSeconds(b: Buffer): number | null {
  const head = b.indexOf('OpusHead');
  if (head < 0 || head + 12 > b.length) return null;
  const preSkip = b.readUInt16LE(head + 10);
  let granule = -1n;
  for (let at = b.indexOf('OggS'); at >= 0 && at + 14 <= b.length; at = b.indexOf('OggS', at + 4)) {
    const g = b.readBigInt64LE(at + 6);
    if (g >= 0n && g > granule) granule = g;
  }
  return granule < 0n ? null : Math.max(0, Number(granule - BigInt(preSkip)) / OPUS_RATE);
}

/** An EBML variable-length integer: its value (with the length marker removed, unless it's an id), length, and "unknown size". */
function vint(b: Buffer, at: number, keepMarker: boolean): { value: number; length: number; unknown: boolean } | null {
  const first = b[at];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (length <= 8 && !(first & (0x80 >> (length - 1)))) length += 1;
  if (length > 8 || at + length > b.length) return null;
  let value = keepMarker ? first : first & (0xff >> length);
  let allOnes = (first & (0xff >> length)) === 0xff >> length;
  for (let i = 1; i < length; i++) {
    value = value * 256 + b[at + i]!;
    if (b[at + i] !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !keepMarker && allOnes };
}

const SEGMENT = 0x18538067;
const CLUSTER = 0x1f43b675;
const BLOCK_GROUP = 0xa0;
const INFO = 0x1549a966;
const TIMECODE = 0xe7;
const TIMECODE_SCALE = 0x2ad7b1;
const SIMPLE_BLOCK = 0xa3;
const BLOCK = 0xa1;

/**
 * A WebM Opus file's length, from its blocks: the latest block's time (cluster time plus its own
 * offset) and one 20 ms frame. Walks the elements flat, so a browser's live recording (clusters of
 * unknown size, no Duration) reads as well as a finished file.
 */
function webmOpusSeconds(b: Buffer): number | null {
  if (b.indexOf('A_OPUS') < 0) return null;
  let at = 0;
  let scale = 1_000_000;
  let cluster = 0;
  let latest = -1;
  while (at < b.length) {
    const id = vint(b, at, true);
    if (!id) return null;
    const size = vint(b, at + id.length, false);
    if (!size) return null;
    const start = at + id.length + size.length;
    const end = size.unknown ? b.length : Math.min(b.length, start + size.value);
    if (id.value === SEGMENT || id.value === CLUSTER || id.value === BLOCK_GROUP || id.value === INFO) {
      if (id.value === CLUSTER) cluster = 0;
      at = start;
      continue;
    }
    if (size.unknown) return null;
    if (id.value === TIMECODE || id.value === TIMECODE_SCALE) {
      let v = 0;
      for (let i = start; i < end; i++) v = v * 256 + b[i]!;
      if (id.value === TIMECODE) cluster = v;
      else scale = v;
    } else if ((id.value === SIMPLE_BLOCK || id.value === BLOCK) && end - start >= 4) {
      const track = vint(b, start, false);
      if (track && start + track.length + 2 <= end) latest = Math.max(latest, cluster + b.readInt16BE(start + track.length));
    }
    at = end;
  }
  return latest < 0 ? null : (latest * scale) / 1e9 + 0.02;
}

/**
 * How long a hold's clip really is, read from the container: only Opus in Ogg or WebM (what the
 * headset records) is heard. Null for anything else, or a clip that can't be read.
 */
export function opusSeconds(mime: TranscribeRequest['audio']['mime'], bytes: Buffer): number | null {
  if (mime === 'audio/ogg') return oggOpusSeconds(bytes);
  if (mime === 'audio/webm') return webmOpusSeconds(bytes);
  return null;
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
