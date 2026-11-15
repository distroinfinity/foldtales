import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { loadChapter } from '../client/src/show/chapters.ts';
import { libraryState, subscribeLibrary, writeProgress } from '../client/src/show/progress.ts';

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
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};

describe('loadChapter', () => {
  test("chapter 1 is today's chapter, with its canon and where each spread is", async () => {
    const ch = await loadChapter(1, fromPublic);
    expect(ch).toMatchObject({ n: 1, episodeId: 'chapter-1', title: 'The night the light went out', next: null });
    expect(ch.episode.scenes.map((s) => s.id)).toEqual(['the-lamp', 'the-shore', 'the-gap']);
    expect(ch.canon?.episodeId).toBe('chapter-1');
    expect(ch.where('wick-back')).toBe('Stopped on the shore.');
    expect(ch.where('no-such-beat')).toBeNull();
  });

  test('a chapter not in this build rejects', async () => {
    await expect(loadChapter(2, fromPublic)).rejects.toThrow(/no chapter 2/);
    await expect(loadChapter(0, fromPublic)).rejects.toThrow();
  });
});

describe('subscribeLibrary', () => {
  test('fires on writeProgress, and stops after unsubscribing', () => {
    const store = storage();
    let calls = 0;
    const stop = subscribeLibrary(() => (calls += 1));
    writeProgress(store, { seriesId: 'flagship-1', chapter: 1, state: 'started' });
    expect(calls).toBe(1);
    expect(libraryState(store, Date.now(), 'flagship-1').chapters[0]!.state).toBe('started');
    stop();
    writeProgress(store, { seriesId: 'flagship-1', chapter: 1, state: 'finished' });
    expect(calls).toBe(1);
  });
});
