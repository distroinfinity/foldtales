import { z } from 'zod';

export const CHECKPOINT_VERSION = 1;
const KEY = 'tt.checkpoint';
/** A crash window: older than this and the story starts again rather than resuming mid-scene. */
const MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Enough to rebuild the stage exactly: the beat cursor and the show clock. Everything else (book,
 * lights, the lantern, who is doing what) is a pure function of those, so nothing is replayed.
 */
const Checkpoint = z.strictObject({
  v: z.literal(CHECKPOINT_VERSION),
  savedAt: z.iso.datetime(),
  seriesId: z.string().min(1),
  beatId: z.string().min(1),
  showMs: z.number().nonnegative(),
  scale: z.number().positive(),
  confirmed: z.boolean(),
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
 * A checkpoint worth resuming: the same story and beat as this build, recent, and still inside the
 * beat (`untilMs`). Once the opening has played out, a reload starts it again, so whoever you show it
 * to sees it; a crash mid-opening comes back where it was.
 */
export function readCheckpoint(store: Store, nowMs: number, expected: { seriesId: string; beatId: string; untilMs: number }): Checkpoint | null {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = Checkpoint.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const cp = parsed.data;
    if (nowMs - Date.parse(cp.savedAt) > MAX_AGE_MS) return null;
    if (cp.seriesId !== expected.seriesId || cp.beatId !== expected.beatId || cp.showMs >= expected.untilMs) return null;
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
