import { z } from 'zod';

export const CHECKPOINT_VERSION = 2;
/** The latest place, whichever chapter it's in. Account sync reads this key, so it stays. */
const LATEST_KEY = 'tt.checkpoint';
/** Every key a checkpoint can live under starts with this (a guest reset clears them all). */
export const CHECKPOINT_KEY_PREFIX = LATEST_KEY;
/** Each chapter's own place, so reading one chapter never loses another's. */
export const checkpointKey = (episodeId: string): string => `${LATEST_KEY}.${episodeId}`;
/** How long a place in the story is kept for "Continue". After that the story starts again. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Enough to rebuild the stage exactly: the scheduler's bound history and the show clock, where
 * every object is, and the drawer and satchel. Everything else (lights, the lantern, who is doing
 * what) is a pure function of those, so nothing is replayed.
 */
const Checkpoint = z.strictObject({
  v: z.literal(CHECKPOINT_VERSION),
  savedAt: z.iso.datetime(),
  seriesId: z.string().min(1),
  episodeId: z.string().min(1),
  showMs: z.number().nonnegative(),
  scale: z.number().positive(),
  confirmed: z.boolean(),
  /** The runtime's own snapshot. Checked by the runtime, which owns its shape. */
  runtime: z.record(z.string(), z.unknown()),
  /** The chapter's end page was showing. */
  ended: z.boolean(),
});
export type Checkpoint = z.infer<typeof Checkpoint>;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function parse(store: Store, key: string): Checkpoint | null {
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = Checkpoint.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Written synchronously, so a forced quit right after an event still has it: under the chapter's
 * own key and as the latest place. Never throws.
 */
export function writeCheckpoint(store: Store, checkpoint: Checkpoint): void {
  const text = JSON.stringify(checkpoint);
  try {
    store.setItem(checkpointKey(checkpoint.episodeId), text);
  } catch {
    // Without storage, recovery restarts the opening. The show itself is unaffected.
  }
  try {
    store.setItem(LATEST_KEY, text);
  } catch {
    // As above.
  }
}

/**
 * A checkpoint worth resuming: this chapter's own place (or, from before places were kept per
 * chapter, the latest one if it's this chapter), the same story, recent, and not at its end. A
 * finished chapter starts again from "Read it again" instead.
 */
export function readCheckpoint(store: Store, nowMs: number, expected: { seriesId: string; episodeId: string }): Checkpoint | null {
  const own = parse(store, checkpointKey(expected.episodeId));
  const latest = parse(store, LATEST_KEY);
  const cp = own ?? (latest?.episodeId === expected.episodeId ? latest : null);
  if (!cp) return null;
  if (nowMs - Date.parse(cp.savedAt) > MAX_AGE_MS) return null;
  if (cp.seriesId !== expected.seriesId || cp.episodeId !== expected.episodeId || cp.ended) return null;
  return cp;
}

/**
 * Forgets a chapter's place ("Start from the beginning", "Read it again"). With no chapter named,
 * forgets the latest place and the chapter it belongs to, as the single-chapter build did.
 */
export function clearCheckpoint(store: Store, episodeId?: string): void {
  const latest = parse(store, LATEST_KEY);
  const target = episodeId ?? latest?.episodeId ?? null;
  try {
    if (target) store.removeItem(checkpointKey(target));
    if (!episodeId || latest?.episodeId === episodeId || !latest) store.removeItem(LATEST_KEY);
  } catch {
    // Nothing to clear without storage.
  }
}
