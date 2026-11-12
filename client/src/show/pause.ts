import type { PauseReason, ShowClock } from './clock.ts';

export interface PauseHooks {
  suspend(): void;
  resume(): void;
  /** `session.paused:<reason>` or `session.resumed`. */
  log(event: string): void;
}

/**
 * One place decides pausing. Every reason (book shut, ribbon, headset off, hands lost mid-grab)
 * is tracked on its own; the show resumes only when all have cleared, and repeats change nothing.
 */
export function createPauseControl(clock: ShowClock, hooks: PauseHooks) {
  return {
    set(reason: PauseReason, on: boolean): void {
      if (on) {
        const wasRunning = !clock.paused;
        if (!clock.pause(reason)) return;
        if (wasRunning) {
          hooks.suspend();
          hooks.log(`session.paused:${reason}`);
        }
      } else {
        if (!clock.resume(reason)) return;
        if (!clock.paused) {
          hooks.resume();
          hooks.log('session.resumed');
        }
      }
    },
  };
}
export type PauseControl = ReturnType<typeof createPauseControl>;
