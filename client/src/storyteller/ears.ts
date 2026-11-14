import { CommitStrategy, RealtimeEvents, Scribe } from '@elevenlabs/client';

/**
 * Listening, through ElevenLabs' realtime speech to text. The headset never holds the key: each
 * listen asks our backend for a single-use token. The microphone opens with the browser's echo
 * cancellation on, so the cast's own voices mostly stay out; while they speak, only a few clear
 * words from you count as cutting in.
 */

export interface EarsDeps {
  /** A fresh single-use token, or null if listening isn't available (no backend, no key). */
  token(): Promise<string | null>;
  /** Something heard and finished (the reader paused). */
  heard(text: string): void;
  /** Words as they come, for cutting in while the cast speaks. */
  hearing?(text: string): void;
  log?(message: string): void;
}

/** The speech-to-text model, and how long a pause ends what you said. */
const MODEL = 'scribe_v2_realtime';
const SILENCE_S = 0.7;

export function createEars(deps: EarsDeps) {
  let connection: ReturnType<typeof Scribe.connect> | null = null;
  let opening = false;
  let wanted = false;

  async function open(): Promise<void> {
    if (connection || opening) return;
    opening = true;
    try {
      const token = await deps.token();
      if (!token || !wanted) return;
      const c = Scribe.connect({
        token,
        modelId: MODEL,
        commitStrategy: CommitStrategy.VAD,
        vadSilenceThresholdSecs: SILENCE_S,
        languageCode: 'en',
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      connection = c;
      c.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data: { text: string }) => {
        if (data.text.trim()) deps.hearing?.(data.text);
      });
      c.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data: { text: string }) => {
        const text = data.text.trim();
        if (text) deps.heard(text);
      });
      c.on(RealtimeEvents.ERROR, (error: unknown) => deps.log?.(`ears: ${String((error as { error?: string })?.error ?? error)}`));
      c.on(RealtimeEvents.CLOSE, () => {
        if (connection === c) connection = null;
        // Closed by the service (a time limit, a dropped line): listen again if we still should.
        if (wanted) setTimeout(() => void open(), 1000);
      });
    } catch (cause) {
      deps.log?.(`ears could not open: ${String(cause)}`);
    } finally {
      opening = false;
    }
  }

  return {
    /** Start listening (the evening is on, the book open, the headset on). */
    start(): void {
      wanted = true;
      void open();
    },
    /** Stop listening and let the microphone go (paused, headset off, put away). */
    stop(): void {
      wanted = false;
      const c = connection;
      connection = null;
      try {
        c?.close();
      } catch {
        // Already closed.
      }
    },
    get listening() {
      return connection !== null;
    },
  };
}
export type Ears = ReturnType<typeof createEars>;
