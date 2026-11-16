import { expect, test } from 'vitest';
import type { Spine } from '../contracts/src/index.ts';
import { setsToLoad } from '../client/src/paint/assets.ts';
import { libraryOf } from '../client/src/show/manifest.ts';
import { defs, manifest, spine } from './stage-harness.ts';

const withSnow = { ...manifest, sets: [...manifest.sets, { ...manifest.sets[0]!, id: 'the-lamp-snow', chapterOnly: true }] };
const snowy: Spine = { ...spine, scenes: spine.scenes.map((s, i) => (i === 0 ? { ...s, setId: 'the-lamp-snow' } : s)) };

test('every set the Storyteller may stage loads, the landing included, whichever chapter this page prepared', () => {
  const ids = setsToLoad(withSnow, spine).map((s) => s.id);
  expect(ids).toEqual(expect.arrayContaining(['the-lamp', 'shore-path', 'the-gap', 'the-landing']));
  expect(ids).not.toContain('the-lamp-snow');
  expect(setsToLoad(withSnow, null).map((s) => s.id)).not.toContain('the-lamp-snow');
});

test('a chapter-only set loads for the chapter that uses it, and the library offers only what loaded', () => {
  const loaded = setsToLoad(withSnow, snowy).map((s) => s.id);
  expect(loaded).toContain('the-lamp-snow');
  const offered = libraryOf(withSnow, [...defs.values()], setsToLoad(withSnow, spine).map((s) => s.id)).sets.map((s) => s.id);
  expect(offered).toContain('the-landing');
  expect(offered).not.toContain('the-lamp-snow');
});
