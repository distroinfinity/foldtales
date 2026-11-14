import { libraryState, type EnterTarget, type LibraryState } from '../show/progress.ts';

export type { EnterTarget, LibraryState };

export const BOOK_TITLE = 'Tales from the Table’s Edge';
const SERIES_ID = 'flagship-1';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The page's view of the library: ticket 3's `libraryState()` (the agreed seam), from this browser's progress. */
export function readLibrary(store: Store): LibraryState {
  return libraryState(store, Date.now(), SERIES_ID);
}

/** What the one button says, from the library. */
export function primaryLabel(library: LibraryState): { label: string; detail: string; secondary: string | null; target: EnterTarget } {
  const chapter = library.chapters.find((c) => c.n === library.next.n)!;
  if (chapter.state === 'started' && chapter.canResume)
    return { label: `Continue chapter ${chapter.n}`, detail: `You stopped partway through “${chapter.title}”.`, secondary: `Start chapter ${chapter.n} again`, target: { kind: 'chapter', n: chapter.n, from: 'resume' } };
  if (chapter.state === 'started') return { label: `Start chapter ${chapter.n} again`, detail: 'About six minutes. You only need your hands.', secondary: null, target: { kind: 'chapter', n: chapter.n, from: 'start' } };
  if (chapter.state === 'finished') return { label: `Read chapter ${chapter.n} again`, detail: 'More chapters on the way.', secondary: null, target: { kind: 'chapter', n: chapter.n, from: 'start' } };
  return { label: 'Open the book', detail: `Chapter ${chapter.n} takes about six minutes. You only need your hands.`, secondary: null, target: { kind: 'chapter', n: chapter.n, from: 'start' } };
}
