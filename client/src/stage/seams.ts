/**
 * Lanes B and D's seams, as the host reads them (approved by the sprint master, Nov 16).
 *
 * The types below are copied verbatim from their stubs: lane B's `client/src/show/chapters.ts`
 * (finish-chapter-2, 651cb4c) and lane D's `client/src/storyteller/provider.ts` and `session.ts`
 * (finish-ai-storyteller, 808155c). Until their PRs reach main, the functions give today's
 * behaviour. When they land, this file becomes re-exports:
 *
 *   export { loadChapter, type ChapterData } from '../show/chapters.ts';
 *   export { storytellerSnapshot, subscribeStoryteller, refreshStoryteller, askMicrophone,
 *            recordFinished, listKeepsakes, type DoorState, type FinishedStory,
 *            type StorytellerSnapshot } from '../storyteller/provider.ts';
 *   export type { StoryEnding } from '../storyteller/session.ts';
 */
import type { ShowObject, Spine } from '@tabletop/contracts';
import type { ChapterCanon } from '../memory/memory.ts';
import { askForMicrophone } from '../landing/microphone.ts';

// ---- lane B: chapters ------------------------------------------------------------------------

export interface ChapterData {
  n: number;
  /** From the episode's own data. */
  title: string;
  episodeId: string;
  /** The chapter's spine, as `loadStageAssets` reads it today. */
  episode: Spine;
  /** What the chapter records when it ends, or null if it records nothing. */
  canon: ChapterCanon | null;
  /** The next chapter's number, or null for the last one in this build. */
  next: number | null;
  /** Keepsakes carried in from the chapter before, with their histories, for the host to put in the satchel. */
  satchel: ShowObject[];
  /** Where the reader is, for "Stopped on the shore.", from a beat id; null when unknown. */
  where(beatId: string): string | null;
}

/** Where each spread is, in the reader's words, by episode and scene index (lane B's stub). */
const WHERE: Record<string, readonly string[]> = {
  'chapter-1': ['Stopped at the top of the lighthouse.', 'Stopped on the shore.', 'Stopped at the gap.'],
};

/** Today: where a beat is, from the spine the host already loaded. Lane B's `ChapterData.where` replaces it. */
export function whereIn(spine: Spine, beatId: string): string | null {
  const i = spine.scenes.findIndex((scene) => scene.beats.some((b) => b.id === beatId));
  return i >= 0 ? (WHERE[spine.id]?.[i] ?? null) : null;
}

/** The chapters this build can open. Today, chapter 1 only (index.ts loads it from the manifest). */
export const CHAPTERS_IN_BUILD = 1;

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
