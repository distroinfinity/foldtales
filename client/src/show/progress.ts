import { z } from 'zod';

const KEY = 'tt.progress';

/**
 * How far you've read, kept across visits so the landing page knows you: new, back mid-chapter,
 * or back after finishing. Small, and separate from the crash checkpoint, which only lasts 30 minutes.
 */
const Progress = z.strictObject({
  v: z.literal(1),
  seriesId: z.string().min(1),
  chapter: z.number().int().positive(),
  state: z.enum(['started', 'finished']),
  updatedAt: z.iso.datetime(),
});
export type Progress = z.infer<typeof Progress>;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readProgress(store: Store, seriesId: string): Progress | null {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = Progress.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.seriesId === seriesId ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeProgress(store: Store, progress: Omit<Progress, 'v' | 'updatedAt'>, now = new Date()): void {
  try {
    store.setItem(KEY, JSON.stringify({ v: 1, ...progress, updatedAt: now.toISOString() }));
  } catch {
    // The landing page simply greets you as new.
  }
}

/** What the landing page's one button says. Continuing needs a saved place to continue from. */
export function landingChoice(progress: Progress | null, canResume: boolean): { label: string; restartLabel: string | null; resume: boolean } {
  if (progress?.state === 'started' && canResume) return { label: `Continue chapter ${progress.chapter}`, restartLabel: 'Start from the beginning', resume: true };
  if (progress?.state === 'finished') return { label: `Read chapter ${progress.chapter} again`, restartLabel: null, resume: false };
  return { label: 'Open the book', restartLabel: null, resume: false };
}
