import { z } from 'zod';
import { clearCheckpoint, readCheckpoint } from './checkpoint.ts';
import { whereIn } from './chapters.ts';
import { storytellerSnapshot, subscribeStoryteller, type StorytellerSnapshot } from '../storyteller/provider.ts';

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
  updatedAt: z.iso.datetime().optional(),
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
 * Every chapter's state, from `tt.chapters`, which is the record. Nothing is inferred: starting
 * chapter 3 directly doesn't finish chapters 1 and 2. A browser from before chapters were kept one
 * by one has only `tt.progress`, from the single-chapter build, and is read from that once.
 */
export function readChapterStates(store: Store, seriesId?: string): { seriesId: string | null; states: Map<number, ChapterState>; updatedAt: string | null } {
  const states = new Map<number, ChapterState>();
  const own = readJson(store, CHAPTERS_KEY, ChapterStates);
  const progress = own ? null : readJson(store, KEY, Progress);
  const series = seriesId ?? own?.seriesId ?? progress?.seriesId ?? null;
  if (own && own.seriesId === series) {
    for (const [key, state] of Object.entries(own.chapters)) states.set(Number(key), state);
    return { seriesId: series, states, updatedAt: own.updatedAt ?? null };
  }
  if (progress && progress.seriesId === series) {
    for (let n = 1; n < progress.chapter; n++) states.set(n, 'finished');
    states.set(progress.chapter, progress.state);
    return { seriesId: series, states, updatedAt: progress.updatedAt };
  }
  return { seriesId: series, states, updatedAt: null };
}

/** Writes every chapter's state, and `tt.progress` as the furthest chapter for code that still reads it. */
function storeStates(store: Store, seriesId: string, states: Map<number, ChapterState>, now: Date, latest?: { chapter: number; state: 'started' | 'finished' }): void {
  const chapters: Record<string, 'started' | 'finished'> = {};
  for (const [n, state] of states) if (state !== 'unread') chapters[String(n)] = state;
  const furthest = readJson(store, KEY, Progress);
  const top = Math.max(0, ...Object.keys(chapters).map(Number));
  const summary = latest && (!furthest || furthest.seriesId !== seriesId || latest.chapter >= furthest.chapter) ? latest : top > 0 && (!furthest || furthest.seriesId !== seriesId || top > furthest.chapter) ? { chapter: top, state: chapters[String(top)]! } : null;
  try {
    store.setItem(CHAPTERS_KEY, JSON.stringify({ v: 1, seriesId, chapters, updatedAt: now.toISOString() }));
    if (summary) store.setItem(KEY, JSON.stringify({ v: 1, seriesId, ...summary, updatedAt: now.toISOString() }));
  } catch {
    // The landing page simply greets you as new.
  }
}

/**
 * Per chapter, for the host to call when a chapter starts and ends. Keeps this chapter's own state
 * (never moving back), and `tt.progress` as before for the furthest chapter only (account sync
 * reads it; an earlier chapter read again leaves it alone).
 */
export function writeProgress(store: Store, progress: Omit<Progress, 'v' | 'updatedAt'>, now = new Date()): void {
  const { states } = readChapterStates(store, progress.seriesId);
  states.set(progress.chapter, further(states.get(progress.chapter) ?? 'unread', progress.state));
  storeStates(store, progress.seriesId, states, now, { chapter: progress.chapter, state: progress.state });
  notifyLibrary();
}

// ---- the account's view of this headset's book (lane D calls these at its boundary) ----------

/** This headset's book as the account syncs it: the shape of `LocalBook` in `client/src/account/merge.ts`. */
export interface LocalChapters {
  chapters: Record<string, ChapterState>;
  resume: { chapter: number; savedAt: string } | null;
  updatedAt: string;
}

const EPOCH = '1970-01-01T00:00:00.000Z';

/**
 * Each chapter's own state (nothing inferred), and the latest saved place while it's fresh and
 * not at an end. Replaces the account's reading of `tt.progress` and `tt.checkpoint`.
 */
export function readLocalChapters(store: Store, seriesId: string, now = Date.now()): LocalChapters {
  const { states, updatedAt } = readChapterStates(store, seriesId);
  const chapters: Record<string, ChapterState> = {};
  for (const [n, state] of states) chapters[String(n)] = state;
  let resume: LocalChapters['resume'] = null;
  try {
    const latest = JSON.parse(store.getItem('tt.checkpoint') ?? 'null') as { episodeId?: unknown } | null;
    const episodeId = typeof latest?.episodeId === 'string' ? latest.episodeId : null;
    const n = episodeId ? Number(/^chapter-(\d+)$/.exec(episodeId)?.[1]) : NaN;
    const place = episodeId ? readCheckpoint(store, now, { seriesId, episodeId }) : null;
    if (place && Number.isInteger(n) && n > 0) resume = { chapter: n, savedAt: place.savedAt };
  } catch {
    resume = null;
  }
  return { chapters, resume, updatedAt: updatedAt ?? EPOCH };
}

/**
 * A book merged with the account, written back (lane D calls this with `mergeBooks()`'s result).
 * Each chapter only moves forward, so remote progress never undoes this headset's. The merge's
 * resume decision is honoured: a chapter it says is finished, and no longer to be resumed, loses an
 * older saved place here (one made before the book's time), while a newer place, a reread begun
 * after that finish, is kept. The saved place itself stays on the headset that made it.
 */
export function writeLocalChapters(store: Store, seriesId: string, book: LocalChapters, now = new Date()): void {
  const { states, updatedAt } = readChapterStates(store, seriesId);
  let changed = false;
  for (const [key, state] of Object.entries(book.chapters)) {
    const n = Number(key);
    if (!Number.isInteger(n) || n < 1) continue;
    const next = further(states.get(n) ?? 'unread', state);
    if (next !== (states.get(n) ?? 'unread')) changed = true;
    states.set(n, next);
  }
  const bookTime = Date.parse(book.updatedAt);
  for (const [n, state] of states) {
    if (state !== 'finished' || book.resume?.chapter === n || !Number.isFinite(bookTime)) continue;
    const episodeId = `chapter-${n}`;
    const place = readCheckpoint(store, now.getTime(), { seriesId, episodeId });
    if (place && Date.parse(place.savedAt) < bookTime) {
      clearCheckpoint(store, episodeId);
      changed = true;
    }
  }
  const later = updatedAt && Date.parse(updatedAt) >= bookTime ? null : book.updatedAt;
  if (!changed && !later) return;
  storeStates(store, seriesId, states, later && Number.isFinite(bookTime) ? new Date(bookTime) : now);
  notifyLibrary();
}

/** Every key this module and the checkpoints keep, for an identity reset to clear (lane D). */
export function forgetLocalChapters(store: Pick<Storage, 'removeItem' | 'key' | 'length'>): void {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key && (key === KEY || key === CHAPTERS_KEY || key.startsWith('tt.checkpoint') || key.startsWith('tt.carry.'))) keys.push(key);
  }
  for (const key of keys) store.removeItem(key);
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
  // The Storyteller's door and shelf change on their own (sign-in, tonight's limit, a story saved).
  const stopStoryteller = subscribeStoryteller(listener);
  return () => {
    libraryListeners.delete(listener);
    stopStoryteller();
  };
}

/** What the landing page's one button says. Continuing needs a saved place to continue from. */
export function landingChoice(progress: Progress | null, canResume: boolean): { label: string; restartLabel: string | null; resume: boolean } {
  if (progress?.state === 'started' && canResume) return { label: `Continue chapter ${progress.chapter}`, restartLabel: 'Start from the beginning', resume: true };
  if (progress?.state === 'finished') return { label: `Read chapter ${progress.chapter} again`, restartLabel: null, resume: false };
  return { label: 'Open the book', restartLabel: null, resume: false };
}

/**
 * The chapters in this build, for the page, which reads them without loading any chapter. Each
 * title is its episode's own (`title` in `episode-N.json`), as the cards and the end page print it;
 * `tests/chapter-seam.test.ts` keeps the two the same.
 */
export const CHAPTERS: ReadonlyArray<{ n: number; title: string; episodeId: string }> = [
  { n: 1, title: 'The night the light went out', episodeId: 'chapter-1' },
  { n: 3, title: 'The longest night', episodeId: 'chapter-3' },
];

/** Whether the AI Storyteller is built and switched on in this build. Sign-in is checked by the landing page. */
export const STORYTELLER_AVAILABLE = true;

/** What the landing page shows: every chapter, what its one button does, and the AI Storyteller's door. Read-only. */
export interface LibraryState {
  /** `where` is the saved place in the reader's words ("Stopped on the shore."), when there is one. */
  chapters: Array<{ n: number; title: string; state: 'unread' | 'started' | 'finished'; canResume: boolean; where?: string }>;
  next: { kind: 'chapter'; n: number; resume: boolean };
  /** Lane D's provider's snapshot: the door's state and the finished stories. */
  storyteller: StorytellerSnapshot;
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
    storyteller: storytellerSnapshot(),
  };
}

/** The saved place's spread, in the reader's words, from the runtime snapshot's last beat. */
function whereSaved(episodeId: string, runtime: Record<string, unknown>): string | null {
  const history = (runtime.scheduler as { history?: Array<{ scene?: unknown }> } | undefined)?.history;
  const scene = history?.at(-1)?.scene;
  return typeof scene === 'number' ? whereIn(episodeId, scene) : null;
}
