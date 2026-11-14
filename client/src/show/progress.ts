import { z } from 'zod';
import { readCheckpoint } from './checkpoint.ts';

const KEY = 'tt.progress';

/**
 * How far you've read, kept across visits so the landing page knows you: new, back mid-chapter,
 * or back after finishing. Small, and separate from the checkpoint (the exact moment, kept 30 days).
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

/** The chapters in this build. Titles as the product names them (product workspace, Nov 14). */
export const CHAPTERS: ReadonlyArray<{ n: number; title: string; episodeId: string }> = [{ n: 1, title: 'The lamp goes out', episodeId: 'chapter-1' }];

/** Whether the AI Storyteller is built and switched on in this build. Sign-in is checked by the landing page. */
export const STORYTELLER_AVAILABLE = true;

/** What the landing page shows: every chapter, what its one button does, and the AI Storyteller's door. Read-only. */
export interface LibraryState {
  chapters: Array<{ n: number; title: string; state: 'unread' | 'started' | 'finished'; canResume: boolean }>;
  next: { kind: 'chapter'; n: number; resume: boolean };
  storyteller: { available: boolean; sessions: Array<{ id: string; title: string; updatedAt: string }> };
}

/** Where the landing page sends the reader into the book. */
export type EnterTarget = { kind: 'chapter'; n: number; from: 'resume' | 'start' } | { kind: 'storyteller'; sessionId?: string };

/** The landing's view of the library, from what this browser has kept. Pure apart from reading `store`. */
export function libraryState(store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, now: number, seriesId?: string): LibraryState {
  let progress: Progress | null = null;
  try {
    const raw = store.getItem(KEY);
    const parsed = raw ? Progress.safeParse(JSON.parse(raw)) : null;
    progress = parsed?.success && (!seriesId || parsed.data.seriesId === seriesId) ? parsed.data : null;
  } catch {
    progress = null;
  }
  const chapters = CHAPTERS.map(({ n, title, episodeId }) => {
    const state: 'unread' | 'started' | 'finished' = progress?.chapter === n ? progress.state : progress && progress.chapter > n ? 'finished' : 'unread';
    const canResume = state === 'started' && progress !== null && readCheckpoint(store, now, { seriesId: progress.seriesId, episodeId }) !== null;
    return { n, title, state, canResume };
  });
  // The one button: carry on where you are, or the first chapter not yet finished, or the last one again.
  const current = chapters.find((c) => c.state === 'started') ?? chapters.find((c) => c.state === 'unread') ?? chapters[chapters.length - 1]!;
  return {
    chapters,
    next: { kind: 'chapter', n: current.n, resume: current.canResume },
    storyteller: { available: STORYTELLER_AVAILABLE, sessions: [] },
  };
}
