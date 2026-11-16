/**
 * Lanes B and D's seams, as the host reads them (approved by the sprint master, Nov 16).
 *
 * Lane B's chapters are on main and re-exported as they are. Lane D's types below are copied
 * verbatim from their stub (`client/src/storyteller/provider.ts` and `session.ts`, finish-ai-storyteller,
 * 808155c); until their PR reaches main, the functions give today's behaviour. Then this becomes:
 *
 *   export { storytellerSnapshot, subscribeStoryteller, refreshStoryteller, askMicrophone,
 *            recordFinished, listKeepsakes, type DoorState, type FinishedStory,
 *            type StorytellerSnapshot } from '../storyteller/provider.ts';
 *   export type { StoryEnding } from '../storyteller/session.ts';
 */
import { askForMicrophone } from '../landing/microphone.ts';
import { reviewQuery } from '../dev.ts';

// ---- lane B: chapters (on main since PR #24) -----------------------------------------------

export { loadChapter, whereIn, type ChapterData } from '../show/chapters.ts';

// ---- lane D: the AI Storyteller ----------------------------------------------------------------

export interface StoryEnding {
  title: string;
  lines: string[];
  things: string[];
}

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

/**
 * Re-checks what the door depends on. Today (accounts off): the connection and the microphone's
 * permission. Lane D's provider adds sign-in, the session and tonight's limit.
 */
export async function refreshStoryteller(): Promise<void> {
  // Review builds: `?door=mic-refused` (any state) shows that door, for the page's proofs.
  const forced = reviewQuery('door') as DoorState['kind'] | null;
  if (forced) return publish({ ...snapshot, door: forced === 'unavailable' ? { kind: 'unavailable', why: 'offline' } : forced === 'limit-reached' ? { kind: 'limit-reached', until: null } : ({ kind: forced } as DoorState) });
  const nav = globalThis.navigator as Navigator | undefined;
  if (nav && nav.onLine === false) return publish({ ...snapshot, door: { kind: 'unavailable', why: 'offline' } });
  let mic: PermissionState | 'unknown' = 'unknown';
  try {
    mic = (await nav?.permissions?.query({ name: 'microphone' as PermissionName }))?.state ?? 'unknown';
  } catch {
    mic = 'unknown';
  }
  publish({ ...snapshot, door: mic === 'granted' ? { kind: 'ready' } : mic === 'denied' ? { kind: 'mic-refused' } : { kind: 'mic-not-asked' } });
}

/** Asks for the microphone on the page (never in XR), then re-checks the door. */
export async function askMicrophone(): Promise<'granted' | 'denied'> {
  const answer = await askForMicrophone(globalThis.navigator?.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices));
  await refreshStoryteller();
  return answer;
}

/** Saves a finished story to the reader's shelf. Today: kept for this visit only. */
export async function recordFinished(story: { id: string } & StoryEnding): Promise<void> {
  publish({ ...snapshot, finished: [{ id: story.id, title: story.title, endedAt: new Date().toISOString(), lines: story.lines, things: story.things }, ...snapshot.finished] });
}

/** Things painted for you, names only. Tagged so "nothing yet" and "couldn't read" differ. */
export async function listKeepsakes(): Promise<{ ok: true; items: Array<{ id: string; name: string }> } | { ok: false }> {
  return { ok: true, items: [] };
}
