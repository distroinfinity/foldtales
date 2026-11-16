import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { Spine } from '../contracts/src/index.ts';
import { ChapterCanon, PAGE_LINES } from '../client/src/memory/memory.ts';
import { CHAPTERS } from '../client/src/show/progress.ts';
import { manifest, playTo, spine, stage } from './stage-harness.ts';

vi.setConfig({ testTimeout: 30_000 });
const json = (path: string) => JSON.parse(readFileSync(new URL(`../client/public/${path}`, import.meta.url), 'utf8'));

test("CHAPTERS lists every chapter in the manifest, each with its episode's own id and title", () => {
  const listed = (manifest.chapters ?? []).map((c) => {
    const s = Spine.parse(json(c.episode));
    return { n: c.n, title: s.title, episodeId: s.id };
  });
  expect(CHAPTERS.map((c) => ({ n: c.n, title: c.title, episodeId: c.episodeId }))).toEqual(listed);
});

test('each recorded page prints at most three lines, said to the reader', () => {
  for (const c of manifest.chapters ?? []) {
    const canon = ChapterCanon.parse(json(c.episode.replace(/\.json$/, '.canon.json')));
    expect(new Set(canon.facts.filter((f) => f.page).map((f) => f.key)).size).toBeLessThanOrEqual(PAGE_LINES);
  }
});

describe("a rig part that is also an object (Wick's logbook)", () => {
  const logbookShown = (s: ReturnType<typeof stage>) => s.puppets.get('wick')!.root.getObjectByName('logbook')!.visible;

  test('shows in a chapter where the logbook object is out of play', () => {
    expect(logbookShown(playTo(stage(), 2000))).toBe(true);
  });

  test("is hidden in a chapter where the logbook is in play (chapter 3's hunt), so it's never in two places", () => {
    const withLog: Spine = { ...spine, scenes: spine.scenes.map((s, i) => (i === 0 ? { ...s, objects: [...s.objects, { id: 'logbook', defId: 'logbook', origin: 'set' as const }] } : s)) };
    expect(logbookShown(playTo(stage(withLog), 2000))).toBe(false);
  });
});
