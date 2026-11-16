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

/** What a chapter on the shelf does: Continue where it was left, Read again once finished, else Start. */
export function shelfTarget(c: LibraryState['chapters'][number]): { label: string; from: 'resume' | 'start' } {
  if (c.state === 'started' && c.canResume) return { label: 'Continue', from: 'resume' };
  return { label: c.state === 'finished' ? 'Read again' : 'Start', from: 'start' };
}

/**
 * The page's one button when this page load prepared a chapter other than the library's next (a review
 * link, or a fallback after another chapter failed): it speaks for what was prepared, resumes its saved
 * place if there is one, and always carries the failure line.
 */
export function preparedChoice(prepared: number, hasSavedPlace: boolean, problem: string | null): { label: string; detail: string; resume: boolean } {
  const base = hasSavedPlace ? `You stopped partway through chapter ${prepared}.` : 'About six minutes. You only need your hands.';
  return { label: `${hasSavedPlace ? 'Continue' : 'Open'} chapter ${prepared}`, detail: problem ? `${problem} ${base}` : base, resume: hasSavedPlace };
}
