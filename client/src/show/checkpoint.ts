import { z } from 'zod';

export const CHECKPOINT_VERSION = 2;
const KEY = 'tt.checkpoint';
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

/** Written synchronously, so a forced quit right after an event still has it. Never throws. */
export function writeCheckpoint(store: Store, checkpoint: Checkpoint): void {
  try {
    store.setItem(KEY, JSON.stringify(checkpoint));
  } catch {
    // Without storage, recovery restarts the opening. The show itself is unaffected.
  }
}

/**
 * A checkpoint worth resuming: the same story and episode as this build, recent, and not at its
 * end. A finished chapter starts again from the landing page's "Read it again" instead.
 */
export function readCheckpoint(store: Store, nowMs: number, expected: { seriesId: string; episodeId: string }): Checkpoint | null {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = Checkpoint.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const cp = parsed.data;
    if (nowMs - Date.parse(cp.savedAt) > MAX_AGE_MS) return null;
    if (cp.seriesId !== expected.seriesId || cp.episodeId !== expected.episodeId || cp.ended) return null;
    return cp;
  } catch {
    return null;
  }
}

export function clearCheckpoint(store: Store): void {
  try {
    store.removeItem(KEY);
  } catch {
    // Nothing to clear without storage.
  }
}
