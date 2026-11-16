import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { checkSpine, Spine } from '../contracts/src/index.ts';
import { CarryFile } from '../client/src/show/carry.ts';
import { libraryOf } from '../client/src/show/manifest.ts';
import { ChapterCanon } from '../client/src/memory/memory.ts';
import { defs, manifest } from './stage-harness.ts';

const json = (path: string) => JSON.parse(readFileSync(new URL(`../client/public/show/${path}`, import.meta.url), 'utf8'));
const spine = Spine.parse(json('episode-2.json'));
const carry = CarryFile.parse(json('episode-2.carry.json'));
const canon = ChapterCanon.parse(json('episode-2.canon.json'));
const library = libraryOf(manifest, [...defs.values()]);
const beats = new Map(spine.scenes.flatMap((s) => s.beats.map((b) => [b.id, b] as const)));

describe('chapter 2, The night the sea came in, as data', () => {
  test('the spine passes the contract checks against the real library', () => {
    expect(checkSpine(spine, library)).toEqual([]);
  });

  test('it is in the chapter list, opening with Moth at the lamp', () => {
    const entry = manifest.chapters?.find((c) => c.n === 2);
    expect(entry?.episode).toBe('show/episode-2.json');
    expect(entry?.onStage.map((o) => o.cast)).toEqual(['pip', 'wick', 'moth']);
    expect(entry?.where).toHaveLength(spine.scenes.length);
  });

  test('every carry slot and pick names real beats, and each pick rejoins the default path', () => {
    for (const slot of carry.slots) {
      expect(beats.get(slot.after)?.next).toBe(slot.otherwise);
      for (const pick of slot.pick) expect(beats.get(pick.beat)?.next).toBe(slot.otherwise);
    }
  });

  test('the canon records only beats that exist, and every history names a library object', () => {
    for (const f of canon.facts) for (const b of f.beats) expect(beats.has(b), `${f.key} ${b}`).toBe(true);
    for (const [id, list] of Object.entries(canon.history)) {
      if (id !== 'default') expect(defs.has(id), id).toBe(true);
      for (const h of list) for (const b of h.beats ?? []) expect(beats.has(b), `${id} ${b}`).toBe(true);
    }
  });

  test("the signature: the sea comes in by the first spread's end, the boat turns for home in the second, the sea goes out in the third", () => {
    const effects = spine.scenes.map((s) => s.beats.flatMap((b) => b.actions.filter((a) => a.do === 'room').map((a) => (a as { effect: string }).effect)));
    expect(effects[0]).toEqual(expect.arrayContaining(['sea', 'bottle']));
    expect(effects[1]).toEqual(expect.arrayContaining(['boat', 'boat-home']));
    expect(effects[2]).toEqual(expect.arrayContaining(['tide-out', 'sea-off']));
  });

  test('no line is over 200 characters (one credit a line)', () => {
    for (const b of [...beats.values(), ...spine.bridges])
      for (const a of b.actions) if ('text' in a) expect(a.text.length, a.text).toBeLessThanOrEqual(200);
  });
});

describe("the recorded page: at most three lines, each to the reader", () => {
  test.each(['episode-1.canon.json', 'episode-2.canon.json'])('%s', (file) => {
    const c = ChapterCanon.parse(json(file));
    const keys = new Set(c.facts.filter((f) => f.page).map((f) => f.key));
    expect(keys.size).toBeLessThanOrEqual(3);
    for (const f of c.facts) if (f.page) expect(f.page.length).toBeLessThanOrEqual(120);
  });
});
