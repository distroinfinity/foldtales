import { z } from 'zod';
import { readCheckpoint } from './checkpoint.ts';
import { whereIn } from './chapters.ts';

/** The furthest chapter and its state. Account sync reads and writes this key, so its shape stays. */
const KEY = 'tt.progress';
/** Each chapter's own state, so rereading chapter 1 doesn't forget chapter 2. */
export const CHAPTERS_KEY = 'tt.chapters';

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

export type ChapterState = 'unread' | 'started' | 'finished';
const ChapterStates = z.strictObject({
  v: z.literal(1),
  seriesId: z.string().min(1),
  chapters: z.record(z.string().regex(/^[1-9][0-9]{0,2}$/), z.enum(['started', 'finished'])),
});

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const RANK: Record<ChapterState, number> = { unread: 0, started: 1, finished: 2 };
/** States only move forward: finishing is for good, and rereading a finished chapter keeps it finished. */
const further = (a: ChapterState, b: ChapterState): ChapterState => (RANK[b] > RANK[a] ? b : a);

function readJson<T>(store: Store, key: string, schema: z.ZodType<T>): T | null {
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readProgress(store: Store, seriesId: string): Progress | null {
  const progress = readJson(store, KEY, Progress);
  return progress && progress.seriesId === seriesId ? progress : null;
}

/**
 * Every chapter's state. Reads both keys and takes the furthest of each, so a book merged from
 * the account (which writes only `tt.progress`: earlier chapters finished) still counts.
 */
export function readChapterStates(store: Store, seriesId?: string): { seriesId: string | null; states: Map<number, ChapterState> } {
  const states = new Map<number, ChapterState>();
  const progress = readJson(store, KEY, Progress);
  const own = readJson(store, CHAPTERS_KEY, ChapterStates);
  const series = seriesId ?? own?.seriesId ?? progress?.seriesId ?? null;
  if (progress && progress.seriesId === series) {
    for (let n = 1; n < progress.chapter; n++) states.set(n, 'finished');
    states.set(progress.chapter, further(states.get(progress.chapter) ?? 'unread', progress.state));
  }
  if (own && own.seriesId === series) {
    for (const [key, state] of Object.entries(own.chapters)) states.set(Number(key), further(states.get(Number(key)) ?? 'unread', state));
  }
  return { seriesId: series, states };
}

/**
 * Per chapter, for the host to call when a chapter starts and ends. Keeps this chapter's own state
 * (never moving back), and `tt.progress` as before for the furthest chapter only (account sync
 * reads it; an earlier chapter read again leaves it alone).
 */
export function writeProgress(store: Store, progress: Omit<Progress, 'v' | 'updatedAt'>, now = new Date()): void {
  const { states } = readChapterStates(store, progress.seriesId);
  const furthest = readJson(store, KEY, Progress);
  states.set(progress.chapter, further(states.get(progress.chapter) ?? 'unread', progress.state));
  const chapters: Record<string, 'started' | 'finished'> = {};
  for (const [n, state] of states) if (state !== 'unread') chapters[String(n)] = state;
  try {
    store.setItem(CHAPTERS_KEY, JSON.stringify({ v: 1, seriesId: progress.seriesId, chapters }));
    if (!furthest || furthest.seriesId !== progress.seriesId || progress.chapter >= furthest.chapter)
      store.setItem(KEY, JSON.stringify({ v: 1, ...progress, updatedAt: now.toISOString() }));
  } catch {
    // The landing page simply greets you as new.
  }
  notifyLibrary();
}

const libraryListeners = new Set<() => void>();

/** Calls every listener; one that throws doesn't stop the rest. */
function notifyLibrary(): void {
  for (const listener of [...libraryListeners]) {
    try {
      listener();
    } catch {
      // A page that failed to redraw shouldn't stop the show writing its progress.
    }
  }
}

/**
 * Called whenever progress changes (and, once lane D's provider lands, whenever the Storyteller's
 * snapshot does), so both doors on the page update live. Returns the unsubscribe.
 */
export function subscribeLibrary(listener: () => void): () => void {
  libraryListeners.add(listener);
  return () => void libraryListeners.delete(listener);
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
  /** `where` is the saved place in the reader's words ("Stopped on the shore."), when there is one. */
  chapters: Array<{ n: number; title: string; state: 'unread' | 'started' | 'finished'; canResume: boolean; where?: string }>;
  next: { kind: 'chapter'; n: number; resume: boolean };
  storyteller: { available: boolean; sessions: Array<{ id: string; title: string; updatedAt: string }> };
}

/** Where the landing page sends the reader into the book. */
export type EnterTarget = { kind: 'chapter'; n: number; from: 'resume' | 'start' } | { kind: 'storyteller'; sessionId?: string };

/** The landing's view of the library, from what this browser has kept. Pure apart from reading `store`. */
export function libraryState(store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, now: number, seriesId?: string): LibraryState {
  const { seriesId: series, states } = readChapterStates(store, seriesId);
  const chapters = CHAPTERS.map(({ n, title, episodeId }) => {
    const state = states.get(n) ?? 'unread';
    // A finished chapter being read again has a place too.
    const saved = state !== 'unread' && series ? readCheckpoint(store, now, { seriesId: series, episodeId }) : null;
    const where = saved ? whereSaved(episodeId, saved.runtime) : null;
    return { n, title, state, canResume: saved !== null, ...(where ? { where } : {}) };
  });
  // The one button: carry on where you are, or the first chapter not yet finished, or the last one again.
  const current = chapters.find((c) => c.state === 'started') ?? chapters.find((c) => c.state === 'unread') ?? chapters[chapters.length - 1]!;
  return {
    chapters,
    next: { kind: 'chapter', n: current.n, resume: current.canResume },
    storyteller: { available: STORYTELLER_AVAILABLE, sessions: [] },
  };
}

/** The saved place's spread, in the reader's words, from the runtime snapshot's last beat. */
function whereSaved(episodeId: string, runtime: Record<string, unknown>): string | null {
  const history = (runtime.scheduler as { history?: Array<{ scene?: unknown }> } | undefined)?.history;
  const scene = history?.at(-1)?.scene;
  return typeof scene === 'number' ? whereIn(episodeId, scene) : null;
}
