import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { ObjectDef, type ShowEvent } from '../contracts/src/index.ts';
import { keepId, keptAfter, memoryOf, recordChapterEnd, type ChapterCanon } from '../client/src/memory/memory.ts';
import { loadChapter } from '../client/src/show/chapters.ts';
import { CHECKPOINT_VERSION, checkpointKey, clearCheckpoint, readCheckpoint, writeCheckpoint, type Checkpoint } from '../client/src/show/checkpoint.ts';
import { createShowLog, memoryLogStore } from '../client/src/show/log.ts';
import { forgetLocalChapters, libraryState, readChapterStates, readLocalChapters, readProgress, subscribeLibrary, writeLocalChapters, writeProgress } from '../client/src/show/progress.ts';

/** Serves client/public as the page would. */
const fromPublic = async (url: string) => {
  try {
    const text = readFileSync(new URL(`../client/public/${url.replace(/^\.\//, '')}`, import.meta.url), 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 404, json: async () => null };
  }
};

const storage = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
};

const SERIES = 'flagship-1';
const now = Date.parse('2026-11-16T20:00:00.000Z');
const place = (episodeId: string, scene: number, over: Partial<Checkpoint> = {}): Checkpoint => ({
  v: CHECKPOINT_VERSION,
  savedAt: '2026-11-16T19:00:00.000Z',
  seriesId: SERIES,
  episodeId,
  showMs: 90_000,
  scale: 1,
  confirmed: true,
  runtime: { scheduler: { history: [{ beatId: 'x', scene: 0 }, { beatId: 'y', scene }] } },
  ended: false,
  ...over,
});

describe('loadChapter', () => {
  test("chapter 1 is today's chapter, with its canon, no satchel and where each spread is", async () => {
    const ch = await loadChapter(1, { fetchJson: fromPublic, log: memoryLogStore() });
    expect(ch).toMatchObject({ n: 1, episodeId: 'chapter-1', title: 'The night the light went out', next: null, satchel: [] });
    expect(ch.episode.scenes.map((s) => s.id)).toEqual(['the-lamp', 'the-shore', 'the-gap']);
    expect(ch.canon?.episodeId).toBe('chapter-1');
    expect(ch.where('opening')).toBe('Stopped at the top of the lighthouse.');
    expect(ch.where('wick-back')).toBe('Stopped on the shore.');
    expect(ch.where('no-such-beat')).toBeNull();
  });

  test('a chapter not in this build rejects', async () => {
    await expect(loadChapter(2, { fetchJson: fromPublic })).rejects.toThrow(/no chapter 2/);
    await expect(loadChapter(0, { fetchJson: fromPublic })).rejects.toThrow();
  });
});

describe('the satchel carries into the next chapter', () => {
  const defs = new Map(['kite', 'spool', 'ladder'].map((id) => {
    const def = ObjectDef.parse(JSON.parse(readFileSync(new URL(`../art/objects/${id}/object.json`, import.meta.url), 'utf8')));
    return [def.id, def] as const;
  }));
  const canon = JSON.parse(readFileSync(new URL('../client/public/show/episode-1.canon.json', import.meta.url), 'utf8')) as ChapterCanon;

  async function finishedChapter1(kept: string[]) {
    const store = memoryLogStore();
    const log = createShowLog(store, { seriesId: SERIES, episodeId: 'chapter-1' }, { nowIso: () => new Date(now).toISOString(), showMs: () => 0 });
    recordChapterEnd(log.append, canon, new Set(['cross-kite', 'the-beam']), kept, defs, []);
    await log.flushed();
    return { store, log };
  }

  test('what chapter 1 kept comes into chapter 2, with its history', async () => {
    const { store } = await finishedChapter1(['kite', 'spool']);
    const events = await store.all();
    const carried = keptAfter(memoryOf(events, defs), 'chapter-1', defs, events);
    expect(carried.map((o) => o.id)).toEqual(['kite', 'spool']);
    expect(carried[0]).toMatchObject({ origin: 'satchel', owner: 'reader', history: [{ episodeId: 'chapter-1', text: 'Carried Pip over the gap, the night the light went out.' }] });
  });

  test('a keepsake given back stays behind, and an unfinished chapter carries nothing', async () => {
    const { store, log } = await finishedChapter1(['kite', 'spool']);
    log.append('canon.reverted', { entryId: keepId('kite') });
    await log.flushed();
    const events: ShowEvent[] = await store.all();
    expect(keptAfter(memoryOf(events, defs), 'chapter-1', defs, events).map((o) => o.id)).toEqual(['spool']);
    expect(keptAfter(memoryOf(events, defs), 'chapter-2', defs, events)).toEqual([]);
  });
});

describe('a saved place per chapter', () => {
  test("each chapter keeps its own place, and the latest is kept for account sync", () => {
    const s = storage();
    writeCheckpoint(s, place('chapter-1', 1));
    writeCheckpoint(s, place('chapter-2', 2));
    expect(readCheckpoint(s, now, { seriesId: SERIES, episodeId: 'chapter-1' })?.episodeId).toBe('chapter-1');
    expect(readCheckpoint(s, now, { seriesId: SERIES, episodeId: 'chapter-2' })?.episodeId).toBe('chapter-2');
    expect(JSON.parse(s.getItem('tt.checkpoint')!).episodeId).toBe('chapter-2');
  });

  test('a place saved before places were per chapter still resumes', () => {
    const s = storage();
    s.setItem('tt.checkpoint', JSON.stringify(place('chapter-1', 1)));
    expect(readCheckpoint(s, now, { seriesId: SERIES, episodeId: 'chapter-1' })).not.toBeNull();
    expect(readCheckpoint(s, now, { seriesId: SERIES, episodeId: 'chapter-2' })).toBeNull();
  });

  test("forgetting one chapter's place leaves the other's", () => {
    const s = storage();
    writeCheckpoint(s, place('chapter-1', 1));
    writeCheckpoint(s, place('chapter-2', 2));
    clearCheckpoint(s, 'chapter-1');
    expect(readCheckpoint(s, now, { seriesId: SERIES, episodeId: 'chapter-1' })).toBeNull();
    expect(readCheckpoint(s, now, { seriesId: SERIES, episodeId: 'chapter-2' })).not.toBeNull();
    // With no chapter named, as the single-chapter host calls it: the latest place goes.
    clearCheckpoint(s);
    expect(readCheckpoint(s, now, { seriesId: SERIES, episodeId: 'chapter-2' })).toBeNull();
    expect(s.getItem(checkpointKey('chapter-2'))).toBeNull();
  });
});

describe('progress per chapter', () => {
  test('each chapter has its own state, and rereading a finished one keeps it finished', () => {
    const s = storage();
    writeProgress(s, { seriesId: SERIES, chapter: 1, state: 'started' });
    writeProgress(s, { seriesId: SERIES, chapter: 1, state: 'finished' });
    writeProgress(s, { seriesId: SERIES, chapter: 2, state: 'started' });
    writeProgress(s, { seriesId: SERIES, chapter: 1, state: 'started' });
    expect([...readChapterStates(s, SERIES).states]).toEqual([[1, 'finished'], [2, 'started']]);
    // Account sync's key still says the furthest chapter.
    expect(readProgress(s, SERIES)).toMatchObject({ chapter: 2, state: 'started' });
  });

  test("a book merged from the account (only tt.progress) counts earlier chapters as finished", () => {
    const s = storage();
    s.setItem('tt.progress', JSON.stringify({ v: 1, seriesId: SERIES, chapter: 3, state: 'started', updatedAt: '2026-11-16T19:00:00.000Z' }));
    expect([...readChapterStates(s, SERIES).states]).toEqual([[1, 'finished'], [2, 'finished'], [3, 'started']]);
  });

  test('the library says where you stopped, also in a finished chapter you were reading again', () => {
    const s = storage();
    writeProgress(s, { seriesId: SERIES, chapter: 1, state: 'started' });
    writeCheckpoint(s, place('chapter-1', 1));
    expect(libraryState(s, now, SERIES).chapters[0]).toEqual({ n: 1, title: 'The night the light went out', state: 'started', canResume: true, where: 'Stopped on the shore.' });
    writeProgress(s, { seriesId: SERIES, chapter: 1, state: 'finished' });
    writeCheckpoint(s, place('chapter-1', 2));
    expect(libraryState(s, now, SERIES)).toMatchObject({ chapters: [{ state: 'finished', canResume: true, where: 'Stopped at the gap.' }], next: { n: 1, resume: true } });
    writeCheckpoint(s, place('chapter-1', 2, { ended: true }));
    expect(libraryState(s, now, SERIES).chapters[0]).toEqual({ n: 1, title: 'The night the light went out', state: 'finished', canResume: false });
  });
});

describe('subscribeLibrary', () => {
  test('fires on writeProgress, and stops after unsubscribing', () => {
    const store = storage();
    let calls = 0;
    const stop = subscribeLibrary(() => (calls += 1));
    writeProgress(store, { seriesId: SERIES, chapter: 1, state: 'started' });
    expect(calls).toBe(1);
    expect(libraryState(store, now, SERIES).chapters[0]!.state).toBe('started');
    stop();
    writeProgress(store, { seriesId: SERIES, chapter: 1, state: 'finished' });
    expect(calls).toBe(1);
  });
});

describe("the account's view of this headset's book", () => {
  test('starting chapter 3 directly finishes nothing before it', () => {
    const s = storage();
    writeProgress(s, { seriesId: SERIES, chapter: 3, state: 'started' });
    writeCheckpoint(s, place('chapter-3', 0));
    expect(readLocalChapters(s, SERIES, now)).toMatchObject({ chapters: { '3': 'started' }, resume: { chapter: 3 } });
  });

  test('rereading chapter 1 after finishing chapter 2 keeps both finished, and its place is the one to resume', () => {
    const s = storage();
    for (const chapter of [1, 2]) {
      writeProgress(s, { seriesId: SERIES, chapter, state: 'started' });
      writeProgress(s, { seriesId: SERIES, chapter, state: 'finished' });
    }
    writeProgress(s, { seriesId: SERIES, chapter: 1, state: 'started' });
    writeCheckpoint(s, place('chapter-1', 1));
    expect(readLocalChapters(s, SERIES, now)).toMatchObject({ chapters: { '1': 'finished', '2': 'finished' }, resume: { chapter: 1 } });
  });

  test('progress from the account joins the local map, and neither side moves back', () => {
    const s = storage();
    writeProgress(s, { seriesId: SERIES, chapter: 1, state: 'finished' });
    writeProgress(s, { seriesId: SERIES, chapter: 2, state: 'started' });
    let calls = 0;
    const stop = subscribeLibrary(() => (calls += 1));
    writeLocalChapters(s, SERIES, { chapters: { '1': 'started', '2': 'finished', '3': 'started' }, resume: null, updatedAt: '2026-11-16T18:00:00.000Z' }, new Date(now));
    stop();
    expect([...readChapterStates(s, SERIES).states]).toEqual([[1, 'finished'], [2, 'finished'], [3, 'started']]);
    expect(calls).toBe(1);
    expect(readProgress(s, SERIES)).toMatchObject({ chapter: 3, state: 'started' });
    // Nothing new: nothing written, nobody told.
    writeLocalChapters(s, SERIES, { chapters: { '1': 'finished' }, resume: null, updatedAt: '2026-11-16T18:00:00.000Z' }, new Date(now));
    expect(calls).toBe(1);
  });

  test('an identity reset clears every chapter key and place', () => {
    const s = storage();
    writeProgress(s, { seriesId: SERIES, chapter: 2, state: 'started' });
    writeCheckpoint(s, place('chapter-2', 1));
    s.setItem('tt.other', 'kept');
    forgetLocalChapters(s);
    expect([...s.data.keys()]).toEqual(['tt.other']);
    expect(readLocalChapters(s, SERIES, now)).toEqual({ chapters: {}, resume: null, updatedAt: '1970-01-01T00:00:00.000Z' });
  });
});

describe('what the account merged, written back, is what the library shows', () => {
  test('a finish from another headset, newer than the place saved here, clears that place', () => {
    const s = storage();
    writeProgress(s, { seriesId: SERIES, chapter: 1, state: 'started' });
    writeCheckpoint(s, place('chapter-1', 1, { savedAt: '2026-11-16T19:00:00.000Z' }));
    // mergeBooks(): chapter 1 finished on another headset at 20:00, so nothing to resume.
    writeLocalChapters(s, SERIES, { chapters: { '1': 'finished' }, resume: null, updatedAt: '2026-11-16T20:00:00.000Z' }, new Date(now));
    expect(readLocalChapters(s, SERIES, now)).toEqual({ chapters: { '1': 'finished' }, resume: null, updatedAt: '2026-11-16T20:00:00.000Z' });
    expect(libraryState(s, now, SERIES).chapters[0]).toMatchObject({ state: 'finished', canResume: false });
  });

  test('a reread begun after that finish keeps its place', () => {
    const s = storage();
    writeProgress(s, { seriesId: SERIES, chapter: 1, state: 'finished' });
    writeCheckpoint(s, place('chapter-1', 2, { savedAt: '2026-11-16T19:30:00.000Z' }));
    writeLocalChapters(s, SERIES, { chapters: { '1': 'finished' }, resume: { chapter: 1, savedAt: '2026-11-16T19:30:00.000Z' }, updatedAt: '2026-11-16T19:00:00.000Z' }, new Date(now));
    expect(libraryState(s, now, SERIES).chapters[0]).toMatchObject({ state: 'finished', canResume: true, where: 'Stopped at the gap.' });
  });
});

test("a chapter 1 place saved before places were per chapter survives chapter 2's first save", () => {
  const s = storage();
  s.setItem('tt.checkpoint', JSON.stringify(place('chapter-1', 1)));
  writeCheckpoint(s, place('chapter-2', 0));
  expect(readCheckpoint(s, now, { seriesId: SERIES, episodeId: 'chapter-1' })?.episodeId).toBe('chapter-1');
  expect(readCheckpoint(s, now, { seriesId: SERIES, episodeId: 'chapter-2' })?.episodeId).toBe('chapter-2');
  // A newer place chapter 1 already had under its own key is never replaced by the old latest one.
  const t = storage();
  t.setItem('tt.checkpoint', JSON.stringify(place('chapter-1', 0, { savedAt: '2026-11-16T18:00:00.000Z' })));
  t.setItem(checkpointKey('chapter-1'), JSON.stringify(place('chapter-1', 2, { savedAt: '2026-11-16T19:00:00.000Z' })));
  writeCheckpoint(t, place('chapter-2', 0));
  expect(readCheckpoint(t, now, { seriesId: SERIES, episodeId: 'chapter-1' })?.savedAt).toBe('2026-11-16T19:00:00.000Z');
});
