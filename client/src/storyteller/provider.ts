/**
 * The AI Storyteller's provider: what its door shows and the stories on your shelf, for the page
 * (lane A draws the door, lane B's `libraryState()` carries the snapshot). Shapes agreed in
 * `docs/plans/2026-11-16-finish-api-shapes.md` §2; a change to one goes through the sprint master.
 *
 * `storytellerSnapshot()` is synchronous, from what's cached. `refreshStoryteller()` re-checks
 * sign-in, the microphone, the connection and tonight's limit, and tells subscribers.
 */
import type { StoryEnding } from './session.ts';

export type DoorState =
  | { kind: 'signed-out' }
  | { kind: 'auth-loading' }
  | { kind: 'auth-failed' }
  | { kind: 'session-expired' }
  | { kind: 'mic-not-asked' }
  | { kind: 'mic-refused' }
  | { kind: 'unavailable'; why: 'offline' | 'service' }
  | { kind: 'limit-reached'; until: string | null }
  | { kind: 'ready' };

export interface FinishedStory {
  id: string;
  title: string;
  endedAt: string;
  /** Two or three lines of what happened. */
  lines: string[];
  /** Names of the things painted for it. */
  things: string[];
}

export interface StorytellerSnapshot {
  door: DoorState;
  finished: FinishedStory[];
}

// ---- the stub (Nov 16): exact types, minimal behaviour; filled in on this branch -------------

let snapshot: StorytellerSnapshot = { door: { kind: 'auth-loading' }, finished: [] };
const listeners = new Set<() => void>();

const publish = (next: StorytellerSnapshot): void => {
  snapshot = next;
  for (const listener of listeners) listener();
};

/** Synchronous, from what's cached. */
export function storytellerSnapshot(): StorytellerSnapshot {
  return snapshot;
}

/** Called whenever the snapshot changes. Returns the unsubscribe. */
export function subscribeStoryteller(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-checks sign-in, the microphone, the connection and tonight's limit. Never throws. */
export async function refreshStoryteller(): Promise<void> {
  publish({ ...snapshot });
}

/**
 * Asks for the microphone on the page, because a first prompt inside XR ended the session
 * (measured twice). The stream only proves permission, so it closes at once.
 */
export async function askMicrophone(): Promise<'granted' | 'denied'> {
  const getUserMedia = globalThis.navigator?.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (!getUserMedia) return 'denied';
  try {
    const stream = await getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    for (const track of stream.getTracks()) track.stop();
    return 'granted';
  } catch {
    return 'denied';
  }
}

/** Saves a finished story to the reader's shelf (kept on this headset until the server has it). */
export async function recordFinished(_story: { id: string } & StoryEnding): Promise<void> {}

/** Things painted for you, names only. Tagged so "nothing yet" and "couldn't read" differ. */
export async function listKeepsakes(): Promise<{ ok: true; items: Array<{ id: string; name: string }> } | { ok: false }> {
  return { ok: true, items: [] };
}
