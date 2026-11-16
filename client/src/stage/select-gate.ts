/**
 * What a look-and-pinch may choose, decided once per pinch. The choice on the card is fixed when the
 * pinch starts; a pinch that was cancelled (a card opened mid-pinch) chooses nothing until it's let go;
 * while a card stands, nothing behind it answers; and a hand that took hold of something within reach
 * chose that, not what it looked at.
 */
export type Slot = 'left' | 'right' | 'gaze';
export interface Picked {
  id: string;
  generation: number;
}
export type SelectDecision = { kind: 'card'; choice: Picked } | { kind: 'ribbon' } | { kind: 'story' } | { kind: 'none' };

export function createSelectGate() {
  const picked: Record<Slot, Picked | null> = { left: null, right: null, gaze: null };
  const pressed: Record<Slot, boolean> = { left: false, right: false, gaze: false };
  const swallowed: Record<Slot, boolean> = { left: false, right: false, gaze: false };
  return {
    /** A pinch started: what the gaze is on now (or null). */
    start(slot: Slot, pick: Picked | null): void {
      pressed[slot] = true;
      swallowed[slot] = false;
      picked[slot] = pick;
    },
    /** The pinch ended, with or without a select. */
    end(slot: Slot): void {
      pressed[slot] = false;
      swallowed[slot] = false;
      picked[slot] = null;
    },
    /** Tracking changed: no pinch in progress chooses anything. */
    reset(): void {
      for (const s of ['left', 'right', 'gaze'] as const) {
        picked[s] = null;
        swallowed[s] = pressed[s];
      }
    },
    /** A card opened or closed mid-pinch: every pinch now held chooses nothing until it's let go. */
    cancelAll(): void {
      this.reset();
    },
    /** The pinch was let go on a select. */
    select(slot: Slot, now: { cardShowing: boolean; generation: number; grabbedNear: boolean }): SelectDecision {
      const choice = picked[slot];
      const wasSwallowed = swallowed[slot];
      picked[slot] = null;
      swallowed[slot] = false;
      if (wasSwallowed || now.grabbedNear) return { kind: 'none' };
      if (choice) {
        if (choice.generation !== now.generation) return { kind: 'none' };
        return choice.id === 'ribbon' ? { kind: 'ribbon' } : { kind: 'card', choice };
      }
      // Nothing on the card was looked at: the story answers only while no card stands.
      return now.cardShowing ? { kind: 'none' } : { kind: 'story' };
    },
  };
}

/** Runs a frame's gesture events in order, stopping as soon as one changes the interaction generation. */
export function dispatchUntilChanged<E>(events: readonly E[], generation: () => number, handle: (event: E) => void): void {
  const at = generation();
  for (const event of events) {
    if (generation() !== at) return;
    handle(event);
  }
}
