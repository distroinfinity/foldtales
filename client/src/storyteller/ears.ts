import { CommitStrategy, RealtimeEvents, Scribe } from '@elevenlabs/client';

/**
 * Hold to talk, through ElevenLabs' realtime speech to text. Pinching the gold tab opens a fresh
 * listening connection (its single-use token fetched ahead, so it opens fast); the tab glows only once
 * it's really listening, so you know when to speak. Letting go sends what you said and closes the
 * microphone. Nothing is heard outside a hold. The headset never holds the key.
 */

export type EarState = 'off' | 'opening' | 'listening' | 'sending';

export interface EarsDeps {
  /** A fresh single-use token, or null if listening isn't available (no backend, no key). */
  token(): Promise<string | null>;
  /** What you said, once you let go. Empty when nothing was heard. */
  heard(text: string): void;
  /** Words as they come, while you hold. */
  hearing?(text: string): void;
  /** The tab's state, for its glow and the page's line. */
  onState?(state: EarState): void;
  log?(message: string): void;
}

const MODEL = 'scribe_v2_realtime';
/** After letting go, wait this long at most for the last words. */
const SEND_WAIT_MS = 2500;

export function createEars(deps: EarsDeps) {
  let state: EarState = 'off';
  let connection: ReturnType<typeof Scribe.connect> | null = null;
  let spare: Promise<string | null> | null = null;
  let words = '';
  let generation = 0;

  const set = (next: EarState) => {
    state = next;
    deps.onState?.(next);
  };
  const prefetch = () => {
    spare ??= deps.token().catch(() => null);
  };
  const close = () => {
    const c = connection;
    connection = null;
    try {
      c?.close();
    } catch {
      // Already closed.
    }
  };

  return {
    get state() {
      return state;
    },
    /** Fetch a token ahead, so the next hold opens quickly. */
    ready(): void {
      prefetch();
    },
    /** The tab is pinched. */
    async hold(): Promise<void> {
      if (state !== 'off') return;
      const mine = ++generation;
      set('opening');
      words = '';
      prefetch();
      const token = await spare;
      spare = null;
      if (mine !== generation || (state as EarState) !== 'opening') return;
      if (!token) {
        deps.log?.('ears: no listening token');
        set('off');
        return;
      }
      try {
        const c = Scribe.connect({
          token,
          modelId: MODEL,
          commitStrategy: CommitStrategy.MANUAL,
          languageCode: 'en',
          microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        connection = c;
        c.on(RealtimeEvents.SESSION_STARTED, () => {
          if (mine === generation && state === 'opening') set('listening');
        });
        c.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data: { text: string }) => {
          if (mine !== generation) return;
          const live = data.text.trim();
          if (live) deps.hearing?.(words ? `${words} ${live}` : live);
        });
        c.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data: { text: string }) => {
          if (mine !== generation) return;
          const text = data.text.trim();
          if (text) words = words ? `${words} ${text}` : text;
          if (state === 'sending') finish(mine);
        });
        c.on(RealtimeEvents.ERROR, (error: unknown) => deps.log?.(`ears: ${String((error as { error?: string })?.error ?? error)}`));
      } catch (cause) {
        deps.log?.(`ears could not open: ${String(cause)}`);
        set('off');
      }
    },
    /** The tab is let go: what was said goes to the story. */
    release(): void {
      if (state === 'off') return;
      const mine = generation;
      if (state === 'opening') {
        // Let go before it was listening: nothing to send.
        generation += 1;
        close();
        set('off');
        prefetch();
        return;
      }
      set('sending');
      try {
        connection?.commit();
      } catch {
        // Nothing to commit.
      }
      setTimeout(() => finish(mine), SEND_WAIT_MS);
    },
    /** Stop at once (paused, headset off, put away). */
    stop(): void {
      generation += 1;
      close();
      if (state !== 'off') set('off');
    },
  };

  function finish(mine: number): void {
    if (mine !== generation || state !== 'sending') return;
    generation += 1;
    close();
    set('off');
    deps.heard(words.trim());
    words = '';
    prefetch();
  }
}
export type Ears = ReturnType<typeof createEars>;
