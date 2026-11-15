import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { StageLibrary, type Spine } from '../contracts/src/index.ts';
import { loadChapter } from '../client/src/show/chapters.ts';
import { libraryOf } from '../client/src/show/manifest.ts';
import { startingObjects } from '../client/src/stage/build.ts';
import { CHAPTERS } from '../client/src/show/progress.ts';
import { memoryLogStore } from '../client/src/show/log.ts';
import { defs, manifest, spine } from './stage-harness.ts';

const publicFile = (url: string) => readFileSync(new URL(`../client/public/${url.replace(/^\.\//, '')}`, import.meta.url), 'utf8');
/** client/public, with the manifest and any extra files swapped in, as a page load would see it. */
const serve = (overrides: Record<string, unknown> = {}) => async (url: string) => {
  const key = url.replace(/^\.\//, '');
  if (key in overrides) return { ok: true, status: 200, json: async () => overrides[key] };
  try {
    const text = publicFile(url);
    return { ok: true, status: 200, json: async () => JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 404, json: async () => null };
  }
};

describe('a page load prepares the chapter it was asked for', () => {
  test("chapter 1 opens with the manifest's own placement", async () => {
    const ch = await loadChapter(1, { fetchJson: serve(), log: memoryLogStore() });
    expect(ch.onStage).toEqual(manifest.onStage);
  });

  test('with a chapter list, chapter 2 gets its own spine, opening placement, where and next', async () => {
    const two: Spine = { ...spine, id: 'chapter-2', title: 'The night the sea came in' };
    const listed = {
      ...JSON.parse(publicFile('show/manifest.json')),
      chapters: [
        { n: 1, episode: 'show/episode-1.json', onStage: manifest.onStage },
        { n: 2, episode: 'show/episode-2.json', onStage: [{ cast: 'pip', mark: 'pip' }, { cast: 'wick', mark: 'wick' }, { cast: 'moth', mark: 'lamp' }], where: ['Stopped at the lamp.', 'Stopped at the water.', 'Stopped at the landing.'] },
      ],
    };
    const fetchJson = serve({ 'show/manifest.json': listed, 'show/episode-2.json': two });
    const one = await loadChapter(1, { fetchJson, log: memoryLogStore() });
    expect(one.next).toBe(2);
    const ch = await loadChapter(2, { fetchJson, log: memoryLogStore() });
    expect(ch).toMatchObject({ n: 2, episodeId: 'chapter-2', title: 'The night the sea came in', next: null, canon: null, satchel: [] });
    expect(ch.onStage.map((o) => o.cast)).toEqual(['pip', 'wick', 'moth']);
    expect(ch.where('wick-back')).toBe('Stopped at the water.');
  });
});

describe('every keeper starts with their light', () => {
  test("in a chapter whose scenes don't list the lantern, Pip still has it in his paw", () => {
    const bare: Spine = { ...spine, scenes: spine.scenes.map((s) => ({ ...s, objects: s.objects.filter((o) => o.id !== 'lantern') })) };
    const start = startingObjects(manifest, bare, [...defs.values()]);
    expect(start.find((o) => o.id === 'lantern')).toEqual({ id: 'lantern', home: { kind: 'carried', cast: 'pip' }, given: false, grabbable: true });
    expect(startingObjects(manifest, spine, [...defs.values()]).find((o) => o.id === 'lantern')!.home).toEqual({ kind: 'carried', cast: 'pip' });
  });
});

test('the library the director and the checks see is still a valid shared library', () => {
  expect(() => StageLibrary.parse(libraryOf(manifest, [...defs.values()]))).not.toThrow();
});

test("the page's chapter titles are each chapter's own", async () => {
  for (const c of CHAPTERS) {
    const ch = await loadChapter(c.n, { fetchJson: serve(), log: memoryLogStore() });
    expect({ n: c.n, title: c.title, episodeId: c.episodeId }).toEqual({ n: ch.n, title: ch.title, episodeId: ch.episodeId });
  }
});
