/**
 * The page's state, set by the 3D side (client/src/index.ts) and read by the React page.
 * The API is unchanged from before the redesign, so index.ts keeps calling setLandingState.
 */
export type LandingState =
  | { kind: 'loading'; share: number }
  | {
      kind: 'ready';
      open: () => void;
      openRoom: (() => void) | null;
      label?: string;
      /** The line under the button, when the book has something more exact to say than the library. */
      detail?: string;
      restart?: { label: string; run: () => void } | null;
      /** The second way in: the AI Storyteller (ticket 3 wires it in index.ts). The page's door gates it on sign-in and the microphone. */
      storyteller?: { label: string; run: () => void; byHand?: () => void } | null;
      /** One chapter, from the shelf: its own target, never a waiting choice's. */
      openChapter?: (n: number, from: 'resume' | 'start') => void;
    }
  | { kind: 'opening' }
  | { kind: 'inside' }
  | { kind: 'failed' };

/** A tap that should have opened the book, but no session came. */
export type PageState = LandingState | { kind: 'refused'; last: Extract<LandingState, { kind: 'ready' }> };

/** If the browser hasn't opened the book this long after a tap, offer a fresh one. */
const REFUSED_AFTER_MS = 12_000;

let current: PageState = { kind: 'loading', share: 0 };
let lastReady: Extract<LandingState, { kind: 'ready' }> | null = null;
let refusedTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function publish(next: PageState): void {
  current = next;
  document.documentElement.dataset.landing = next.kind;
  for (const listener of listeners) listener();
}

export function setLandingState(state: LandingState): void {
  if (refusedTimer && state.kind !== 'opening') {
    clearTimeout(refusedTimer);
    refusedTimer = null;
  }
  if (state.kind === 'ready') lastReady = state;
  publish(state);
}

/** The page's own taps go through here, so XR still starts inside the tap. */
export function openingTap(run: () => void): void {
  publish({ kind: 'opening' });
  run();
  if (refusedTimer) clearTimeout(refusedTimer);
  refusedTimer = setTimeout(() => {
    refusedTimer = null;
    if (current.kind === 'opening' && lastReady) publish({ kind: 'refused', last: lastReady });
  }, REFUSED_AFTER_MS);
}

export function landingSnapshot(): PageState {
  return current;
}

export function subscribeLanding(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
