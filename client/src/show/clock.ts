import type { ShowEvent } from '@tabletop/contracts';

export type PauseReason = Extract<ShowEvent, { type: 'session.paused' }>['data']['reason'];

/** One frame never moves the show further than this, so a stall slows the story instead of skipping it. */
const MAX_STEP_MS = 100;

export interface ShowClock {
  readonly ms: number;
  readonly paused: boolean;
  reasons(): PauseReason[];
  /** Moves the show by one frame's time, unless something holds it. */
  advance(deltaMs: number): void;
  /** True if this reason is new. */
  pause(reason: PauseReason): boolean;
  /** True if this reason was holding it. */
  resume(reason: PauseReason): boolean;
  seek(ms: number): void;
}

/** The show's one clock. Acting, cues, light and sound all read it; the SDK's elapsed time never drives the show. */
export function createShowClock(): ShowClock {
  let ms = 0;
  const holding = new Set<PauseReason>();
  return {
    get ms() {
      return ms;
    },
    get paused() {
      return holding.size > 0;
    },
    reasons: () => [...holding],
    advance(deltaMs) {
      if (holding.size > 0 || !(deltaMs > 0)) return;
      ms += Math.min(deltaMs, MAX_STEP_MS);
    },
    pause(reason) {
      if (holding.has(reason)) return false;
      holding.add(reason);
      return true;
    },
    resume(reason) {
      return holding.delete(reason);
    },
    seek(next) {
      ms = Math.max(0, next);
    },
  };
}
