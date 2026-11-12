/**
 * Runs or freezes an audio context. The context's state only changes when its promise settles, so
 * guarding on it races: a pause and unpause in quick succession could leave it frozen. Instead this
 * remembers what is wanted and always sends that, and the context applies its calls in order.
 */
export function createSuspender(ctx: { suspend(): Promise<void>; resume(): Promise<void> }) {
  let running = true;
  return {
    set(next: boolean): void {
      if (next === running) return;
      running = next;
      (next ? ctx.resume() : ctx.suspend()).catch(() => undefined);
    },
    running: (): boolean => running,
  };
}
