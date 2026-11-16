import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { Spine } from '../contracts/src/index.ts';
import { recordChapterEnd, type ChapterCanon } from '../client/src/memory/memory.ts';
import { loadChapter } from '../client/src/show/chapters.ts';
import { CHECKPOINT_VERSION, writeCheckpoint } from '../client/src/show/checkpoint.ts';
import { createShowLog, memoryLogStore } from '../client/src/show/log.ts';
import { defs, manifest, spine } from './stage-harness.ts';

/** As the page sees it: `art/` from the repo's art folder, the rest from client/public. */
const publicFile = (url: string) => {
  const key = url.replace(/^\.\//, '');
  return readFileSync(new URL(key.startsWith('art/') ? `../${key}` : `../client/public/${key}`, import.meta.url), 'utf8');
};
const SERIES = manifest.libraryVersion;
const now = Date.parse('2026-11-17T10:00:00.000Z');

/** A build with chapters 1 and 2, chapter 2's spine standing in as chapter 1's with a carry slot after its opening. */
function build() {
  const two: Spine = { ...spine, id: 'chapter-2', title: 'Chapter two' };
  const files: Record<string, unknown> = {
    'show/manifest.json': { ...JSON.parse(publicFile('show/manifest.json')), chapters: [{ n: 1, episode: 'show/episode-1.json', onStage: manifest.onStage }, { n: 2, episode: 'show/episode-2.json', onStage: manifest.onStage }] },
    'show/episode-2.json': two,
    'show/episode-2.carry.json': {
      episodeId: 'chapter-2',
      slots: [{ after: 'opening', otherwise: 'lantern-drop', pick: [{ when: { fact: 'crossing', is: 'kite', has: 'kite' }, beat: 'wick-gone' }, { when: { fact: 'crossing', is: 'rope' }, beat: 'lantern-back' }] }],
    },
  };
  return async (url: string) => {
    const key = url.replace(/^\.\//, '');
    if (key in files) return { ok: true, status: 200, json: async () => files[key] };
    try {
      const text = publicFile(url);
      return { ok: true, status: 200, json: async () => JSON.parse(text) as unknown };
    } catch {
      return { ok: false, status: 404, json: async () => null };
    }
  };
}

const storage = () => {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};
const canon = JSON.parse(publicFile('show/episode-1.canon.json')) as ChapterCanon;

/** Chapter 1 finished, having played `beats`, keeping `kept`. */
async function finished(beats: string[], kept: string[]) {
  const store = memoryLogStore();
  const log = createShowLog(store, { seriesId: SERIES, episodeId: 'chapter-1' }, { nowIso: () => new Date(now).toISOString(), showMs: () => 0 });
  recordChapterEnd(log.append, canon, new Set(beats), kept, defs, []);
  await log.flushed();
  return store;
}
const nextOf = (s: Spine, id: string) => s.scenes.flatMap((x) => x.beats).find((b) => b.id === id)!.next;

describe('what carries: a chapter plays the path its earlier chapters chose', () => {
  test('played without chapter 1, the slot keeps its default', async () => {
    const ch = await loadChapter(2, { fetchJson: build(), log: memoryLogStore(), store: storage(), now });
    expect(nextOf(ch.episode, 'opening')).toBe('lantern-drop');
  });

  test("chapter 1's crossing picks the variant, when the kite it needs is in the satchel", async () => {
    const withKite = await loadChapter(2, { fetchJson: build(), log: await finished(['cross-kite'], ['kite']), store: storage(), now });
    expect(withKite.satchel.map((o) => o.id)).toEqual(['kite']);
    expect(nextOf(withKite.episode, 'opening')).toBe('wick-gone');
    // The kite was given back: the fact stands, but the pick needs the kite, so the default plays.
    const noKite = await loadChapter(2, { fetchJson: build(), log: await finished(['cross-kite'], []), store: storage(), now });
    expect(nextOf(noKite.episode, 'opening')).toBe('lantern-drop');
    const rope = await loadChapter(2, { fetchJson: build(), log: await finished(['wick-rope'], []), store: storage(), now });
    expect(nextOf(rope.episode, 'opening')).toBe('lantern-back');
  });

  test('a chapter being resumed keeps the choice it started with, even if the facts changed', async () => {
    const store = storage();
    await loadChapter(2, { fetchJson: build(), log: await finished(['wick-rope'], []), store, now });
    writeCheckpoint(store, { v: CHECKPOINT_VERSION, savedAt: new Date(now).toISOString(), seriesId: SERIES, episodeId: 'chapter-2', showMs: 30_000, scale: 1, confirmed: true, runtime: {}, ended: false });
    const resumed = await loadChapter(2, { fetchJson: build(), log: await finished(['cross-kite'], ['kite']), store, now, from: 'resume' });
    expect(nextOf(resumed.episode, 'opening')).toBe('lantern-back');
    // Started again (no place to resume), it chooses afresh.
    store.removeItem('tt.checkpoint.chapter-2');
    store.removeItem('tt.checkpoint');
    const fresh = await loadChapter(2, { fetchJson: build(), log: await finished(['cross-kite'], ['kite']), store, now, from: 'resume' });
    expect(nextOf(fresh.episode, 'opening')).toBe('wick-gone');
  });
});

test("starting a chapter afresh follows the latest replay of the one before, even with an old place still saved", async () => {
  // Chapter 1 finished with the kite, chapter 2 started and left; chapter 1 replayed with the rope;
  // chapter 2 started from the beginning (the host clears the old place only after preparing).
  const store = storage();
  const kite = await finished(['cross-kite'], ['kite']);
  await loadChapter(2, { fetchJson: build(), log: kite, store, now, from: 'start' });
  writeCheckpoint(store, { v: CHECKPOINT_VERSION, savedAt: new Date(now).toISOString(), seriesId: SERIES, episodeId: 'chapter-2', showMs: 30_000, scale: 1, confirmed: true, runtime: {}, ended: false });
  const replayed = await finished(['wick-rope'], []);
  const again = await loadChapter(2, { fetchJson: build(), log: replayed, store, now, from: 'start' });
  expect(nextOf(again.episode, 'opening')).toBe('lantern-back');
  // A resume after that fresh start keeps the new choice (the old place goes once the host has prepared).
  const resumed = await loadChapter(2, { fetchJson: build(), log: replayed, store, now, from: 'resume' });
  expect(nextOf(resumed.episode, 'opening')).toBe('lantern-back');
});
