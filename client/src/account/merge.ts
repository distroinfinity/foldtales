import type { Book, ChapterState, ResumePoint } from '@tabletop/contracts';

/** A book as this headset holds it: no revision, which only the server has. */
export interface LocalBook {
  chapters: Book['chapters'];
  resume: ResumePoint | null;
  /** When this copy last changed. With no resume point, that's when its last chapter was finished. */
  updatedAt: string;
}

const RANK: Record<ChapterState, number> = { unread: 0, started: 1, finished: 2 };

const timeOf = (iso: string): number => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
};

/** When a copy last finished a chapter and so cleared its place, or null if that's not what it last did. */
function finishedAt(book: LocalBook, chapter: number): number | null {
  return book.resume === null && book.chapters[String(chapter)] === 'finished' ? timeOf(book.updatedAt) : null;
}

/**
 * Two copies of a book into one, losing nothing finished. Per chapter the furthest state wins
 * (finished, then started, then unread). The newer resume point wins, and an active one beats an
 * older finish of the same chapter, so replaying a finished chapter keeps your place; a finish
 * newer than the place clears it.
 */
export function mergeBooks(a: LocalBook, b: LocalBook): LocalBook {
  const chapters: Book['chapters'] = { ...a.chapters };
  for (const [key, state] of Object.entries(b.chapters)) {
    if (RANK[state] > RANK[chapters[key] ?? 'unread']) chapters[key] = state;
  }

  const points = [a.resume, b.resume].filter((point): point is ResumePoint => point !== null);
  const newest = points.sort((x, y) => timeOf(y.savedAt) - timeOf(x.savedAt))[0] ?? null;
  const finishes = newest ? [finishedAt(a, newest.chapter), finishedAt(b, newest.chapter)] : [];
  const resume: ResumePoint | null = newest && !finishes.some((at) => at !== null && at > timeOf(newest.savedAt)) ? newest : null;

  const updatedAt = timeOf(a.updatedAt) >= timeOf(b.updatedAt) ? a.updatedAt : b.updatedAt;
  return { chapters, resume, updatedAt };
}

/** Same chapters and resume point, so a write would change nothing. */
export function sameBook(a: Pick<LocalBook, 'chapters' | 'resume'>, b: Pick<LocalBook, 'chapters' | 'resume'>): boolean {
  const keys = new Set([...Object.keys(a.chapters), ...Object.keys(b.chapters)]);
  for (const key of keys) if ((a.chapters[key] ?? 'unread') !== (b.chapters[key] ?? 'unread')) return false;
  return a.resume?.chapter === b.resume?.chapter && a.resume?.savedAt === b.resume?.savedAt;
}
