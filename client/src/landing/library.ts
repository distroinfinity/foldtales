import { readProgress } from '../show/progress.ts';

/**
 * What the page shows about the book: the agreed seam with ticket 3. Ticket 3 implements
 * `libraryState()` in client/src/show/progress.ts with exactly this shape; until it lands,
 * this shim builds it from today's progress. Swap the import when theirs is in.
 */
export type LibraryState = {
  chapters: Array<{ n: number; title: string; state: 'unread' | 'started' | 'finished'; canResume: boolean }>;
  next: { kind: 'chapter'; n: number; resume: boolean };
  storyteller: { available: boolean; sessions: Array<{ id: string; title: string; updatedAt: string }> };
};

export type EnterTarget = { kind: 'chapter'; n: number; from: 'resume' | 'start' } | { kind: 'storyteller'; sessionId?: string };

export const BOOK_TITLE = 'Tales from the Table’s Edge';
const SERIES_ID = 'flagship-1';
const CHAPTER_TITLES: Record<number, string> = { 1: 'The lamp goes out' };

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function libraryStateShim(store: Store, canResume: (n: number) => boolean): LibraryState {
  const progress = readProgress(store, SERIES_ID);
  const chapters = Object.entries(CHAPTER_TITLES).map(([key, title]) => {
    const n = Number(key);
    const state = progress?.chapter === n ? progress.state : progress && progress.chapter > n ? ('finished' as const) : ('unread' as const);
    return { n, title, state, canResume: state === 'started' && canResume(n) };
  });
  const current = chapters.find((c) => c.state !== 'finished') ?? chapters[chapters.length - 1]!;
  return {
    chapters,
    next: { kind: 'chapter', n: current.n, resume: current.canResume },
    storyteller: { available: false, sessions: [] },
  };
}

/** What the one button says, from the library. */
export function primaryLabel(library: LibraryState): { label: string; detail: string; secondary: string | null; target: EnterTarget } {
  const chapter = library.chapters.find((c) => c.n === library.next.n)!;
  if (chapter.state === 'started' && chapter.canResume)
    return { label: `Continue chapter ${chapter.n}`, detail: `Chapter ${chapter.n} · ${chapter.title.toLowerCase()}`, secondary: `Start chapter ${chapter.n} again`, target: { kind: 'chapter', n: chapter.n, from: 'resume' } };
  if (chapter.state === 'started') return { label: `Start chapter ${chapter.n} again`, detail: 'About 6 minutes · just your hands', secondary: null, target: { kind: 'chapter', n: chapter.n, from: 'start' } };
  if (chapter.state === 'finished') return { label: `Read chapter ${chapter.n} again`, detail: 'More chapters on the way.', secondary: null, target: { kind: 'chapter', n: chapter.n, from: 'start' } };
  return { label: 'Open the book', detail: `Chapter ${chapter.n} · about 6 minutes · just your hands`, secondary: null, target: { kind: 'chapter', n: chapter.n, from: 'start' } };
}
