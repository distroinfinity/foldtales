import { TRANSCRIBE_MAX_BASE64, type TranscribeRequest } from '@tabletop/contracts';

/**
 * Hold to talk. Pinching the gold tab opens the microphone and records; the tab glows only once
 * it's really recording, so you know when to speak. Letting go stops the microphone at once and
 * sends the clip to our backend, which hears it (owner, Nov 16: Groq's Whisper, on the backend;
 * the headset never holds a speech vendor's token). Nothing is heard outside a hold.
 */

export type EarState = 'off' | 'opening' | 'listening' | 'sending';

/** What the backend made of a clip: the words, nothing heard, or listening is busy right now. */
export type Heard = { text: string } | 'busy' | null;

export interface EarsDeps {
  /** Sends a clip to be heard. Null when it couldn't be (no backend, offline, an error). */
  transcribe(audio: TranscribeRequest['audio']): Promise<Heard>;
  /** What you said, once you let go. Empty when nothing was heard. */
  heard(text: string): void;
  /** It couldn't be heard just then (busy, or failed): "I couldn't hear you just then." */
  missed?(why: 'busy' | 'failed'): void;
  /** The tab's state, for its glow and the page's line. */
  onState?(state: EarState): void;
  log?(message: string): void;
  /** The browser's pieces, swappable for tests. */
  media?: {
    getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
    recorder(stream: MediaStream, options: MediaRecorderOptions): MediaRecorder;
    supports(mime: string): boolean;
  };
}

/** A hold is cut off here, so a clip always fits the contract (30 s of Opus at 32 kbps is about 160,000 characters). */
export const MAX_HOLD_MS = 30_000;
const BITS_PER_SECOND = 32_000;
/** In order of preference: what Quest Browser records, then what others do. */
const FORMATS: Array<{ recorder: string; mime: TranscribeRequest['audio']['mime'] }> = [
  { recorder: 'audio/webm;codecs=opus', mime: 'audio/webm' },
  { recorder: 'audio/ogg;codecs=opus', mime: 'audio/ogg' },
  { recorder: 'audio/webm', mime: 'audio/webm' },
  { recorder: 'audio/mp4', mime: 'audio/mp4' },
];

const browserMedia = (): NonNullable<EarsDeps['media']> => ({
  getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
  recorder: (stream, options) => new MediaRecorder(stream, options),
  supports: (mime) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime),
});

async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function createEars(deps: EarsDeps) {
  const media = deps.media ?? browserMedia();
  let state: EarState = 'off';
  let generation = 0;
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let cutOff: ReturnType<typeof setTimeout> | null = null;
  let chunks: Blob[] = [];

  const set = (next: EarState) => {
    state = next;
    deps.onState?.(next);
  };
  /** The microphone stops the moment a hold ends, whatever else happens. */
  const closeMic = () => {
    if (cutOff) clearTimeout(cutOff);
    cutOff = null;
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
  };

  async function send(mine: number, blob: Blob, mime: TranscribeRequest['audio']['mime']): Promise<void> {
    if (blob.size === 0) {
      set('off');
      deps.heard('');
      return;
    }
    const base64 = await base64Of(blob);
    if (mine !== generation) return;
    if (base64.length > TRANSCRIBE_MAX_BASE64) {
      deps.log?.('ears: the clip was too long to send');
      set('off');
      deps.missed?.('failed');
      return;
    }
    const answer = await deps.transcribe({ mime, base64 }).catch(() => null);
    if (mine !== generation) return;
    set('off');
    if (answer === 'busy') deps.missed?.('busy');
    else if (answer === null) deps.missed?.('failed');
    else deps.heard(answer.text.trim());
  }

  return {
    get state() {
      return state;
    },
    /** Kept for the host: there's nothing to fetch ahead any more. */
    ready(): void {},
    /** The tab is pinched. */
    async hold(): Promise<void> {
      if (state !== 'off') return;
      const mine = ++generation;
      set('opening');
      chunks = [];
      const format = FORMATS.find((f) => media.supports(f.recorder));
      if (!format) {
        deps.log?.('ears: this browser cannot record');
        set('off');
        deps.missed?.('failed');
        return;
      }
      try {
        const opened = await media.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        if (mine !== generation || (state as EarState) !== 'opening') {
          for (const track of opened.getTracks()) track.stop();
          return;
        }
        stream = opened;
        const r = media.recorder(opened, { mimeType: format.recorder, audioBitsPerSecond: BITS_PER_SECOND });
        recorder = r;
        r.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        r.onstop = () => {
          closeMic();
          if (mine !== generation) return;
          void send(mine, new Blob(chunks, { type: format.mime }), format.mime);
        };
        r.onerror = () => {
          deps.log?.('ears: the recorder failed');
          closeMic();
          if (mine === generation) {
            set('off');
            deps.missed?.('failed');
          }
        };
        r.start();
        set('listening');
        // A hold that goes on too long is sent as it is.
        cutOff = setTimeout(() => {
          if (mine === generation && state === 'listening') this.release();
        }, MAX_HOLD_MS);
      } catch (cause) {
        deps.log?.(`ears could not open: ${String(cause)}`);
        closeMic();
        if (mine === generation) {
          set('off');
          deps.missed?.('failed');
        }
      }
    },
    /** The tab is let go: what was said goes to the story. */
    release(): void {
      if (state === 'opening') {
        // Let go before it was recording: nothing to send.
        generation += 1;
        closeMic();
        set('off');
        return;
      }
      if (state !== 'listening') return;
      set('sending');
      const r = recorder;
      recorder = null;
      try {
        if (r && r.state !== 'inactive') r.stop();
        else closeMic();
      } catch {
        closeMic();
        set('off');
      }
    },
    /** Leaving, or the story ended: everything stops, and nothing is sent. */
    stop(): void {
      generation += 1;
      const r = recorder;
      recorder = null;
      try {
        if (r && r.state !== 'inactive') r.stop();
      } catch {
        // Already stopped.
      }
      closeMic();
      if (state !== 'off') set('off');
    },
  };
}
export type Ears = ReturnType<typeof createEars>;
