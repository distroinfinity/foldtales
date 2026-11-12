import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { checkSpine, ObjectDef, Spine } from '../contracts/src/index.ts';
import { libraryOf, ShowManifest, voiceMsOf } from '../client/src/show/manifest.ts';
import { actionDuration } from '../client/src/show/schedule.ts';
import { createScheduler, HOLD_GRACE_MS } from '../client/src/show/scheduler.ts';
import { simulate, type Reader, type ReaderMove } from '../client/src/show/simulate.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = ShowManifest.parse(read('../client/public/show/manifest.json'));
const spine = Spine.parse(read(`../client/public/${manifest.episode}`));
const objects = [...manifest.objectFiles.map((f) => ObjectDef.parse(read(`../art/${f}`))), ...manifest.extraObjects];
const library = libraryOf(manifest, objects);
const tags = (id: string) => objects.find((o) => o.id === id)!.tags;
const durationOf = actionDuration({ cueMs: Object.fromEntries(manifest.cues.map((c) => [c.id, c.nominalMs])), voiceMs: voiceMsOf(manifest) });

const LANTERN = 'lantern-lost';
const GAP = 'the-gap';
/** A keepsake from another story, matching no rule at the gap. */
const STRANGER = { id: 'button', tags: ['rolls', 'heavy'] };
const gift = (object: string): ReaderMove => ({ do: 'gift', object, tags: object === STRANGER.id ? STRANGER.tags : [...tags(object)], to: 'pip' });

/** A reader built from small rules: each fires once, when its condition first holds. */
function reader(rules: Array<{ when: Parameters<Reader>[0] extends infer V ? (v: V) => boolean : never; then: ReaderMove[] }>): Reader {
  const fired = new Set<number>();
  return (view) => {
    for (let i = 0; i < rules.length; i++) {
      if (fired.has(i) || !rules[i]!.when(view)) continue;
      fired.add(i);
      return rules[i]!.then;
    }
    return [];
  };
}
const asked = (id: string, afterMs = 1500) => (v: { problem: { id: string; sinceMs: number } | null }) => v.problem?.id === id && v.problem.sinceMs >= afterMs;
const during = (beat: string, afterMs = 0) => (v: { beatId: string; nowMs: number; scheduler: { current(): { startMs: number } } }) => v.beatId === beat && v.nowMs - v.scheduler.current().startMs >= afterMs;

const nothing: Reader = () => [];
const eager = reader([
  { when: asked(LANTERN, 1200), then: [gift('lantern')] },
  { when: during('page-corner', 800), then: [{ do: 'skip' }] },
  { when: asked(GAP, 1500), then: [gift('kite')] },
]);
const firstGift = (object: string) =>
  reader([
    { when: asked(LANTERN, 6000), then: [gift('lantern')] },
    { when: asked(GAP, 6000), then: [gift(object)] },
  ]);

const paths: Record<string, Reader> = {
  'nothing ever': nothing,
  'eager: lantern, page and kite at once': eager,
  'lantern late': reader([{ when: asked(LANTERN, 18_000), then: [gift('lantern')] }]),
  'kite first': firstGift('kite'),
  'spool first': firstGift('spool'),
  'ladder first': firstGift('ladder'),
  'sock first, then nothing': firstGift('odd-sock'),
  'key first, then nothing': firstGift('brass-key'),
  'sock then kite': reader([
    { when: asked(GAP, 3000), then: [gift('odd-sock')] },
    { when: during('sock-scarf', 9000), then: [gift('kite')] },
  ]),
  'key then ladder': reader([
    { when: asked(GAP, 3000), then: [gift('brass-key')] },
    { when: during('key-try', 9000), then: [gift('ladder')] },
  ]),
  'sock and key, then the timeout': reader([
    { when: asked(GAP, 2000), then: [gift('odd-sock')] },
    { when: during('sock-scarf', 8000), then: [gift('brass-key')] },
  ]),
  'the same wrong object twice': reader([
    { when: asked(GAP, 2000), then: [gift('odd-sock')] },
    { when: during('sock-scarf', 9000), then: [gift('odd-sock')] },
  ]),
  'something else during the lantern ask, then it again at the gap': reader([
    { when: asked(LANTERN, 3000), then: [gift('spool')] },
    { when: asked(GAP, 3000), then: [gift('spool')] },
  ]),
  'a keepsake from another story at the gap': firstGift(STRANGER.id),
  'a gift while nothing is asked': reader([{ when: during('shore-walk', 4000), then: [gift('kite')] }]),
  'holding an object through the whole gap ask': reader([{ when: asked(GAP, 500), then: [{ do: 'hold', on: true }] }]),
  'regrabbing over and over': (() => {
    let on = false;
    return (v) => {
      if (v.problem?.id !== GAP || Math.floor(v.problem.sinceMs / 2000) % 2 === (on ? 1 : 0)) return [];
      on = !on;
      return [{ do: 'hold', on }];
    };
  })(),
  'release in the same tick as the timeout': reader([
    { when: asked(GAP, 0), then: [{ do: 'hold', on: true }] },
    { when: asked(GAP, 29_950), then: [{ do: 'hold', on: false }] },
  ]),
};

const reports = Object.fromEntries(Object.entries(paths).map(([name, r]) => [name, simulate(spine, durationOf, r)]));

describe('episode 1, as data', () => {
  test('the spine passes the contract checks', () => {
    expect(checkSpine(spine, library)).toEqual([]);
  });
  test('every rule tag is in the vocabulary, and the drawer covers every solving tag', () => {
    const drawer = spine.scenes[1]!.objects.map((o) => o.defId);
    for (const rule of spine.scenes[1]!.problem!.rules.filter((r) => r.outcome === 'solved')) {
      expect(drawer.some((d) => rule.anyTags.some((t) => tags(d).includes(t)))).toBe(true);
    }
  });
  test('every cue the episode names is in the manifest', () => {
    const cues = new Set(manifest.cues.map((c) => c.id));
    const named = spine.scenes.flatMap((s) => s.beats.flatMap((b) => b.actions.flatMap((a) => (a.do === 'cue' ? [a.cue] : []))));
    expect(named.filter((c) => !cues.has(c))).toEqual([]);
  });
});

describe('every path through episode 1, simulated offline', () => {
  for (const [name, report] of Object.entries(reports)) {
    test(name, () => {
      expect(report.endedAtMs, 'ends').not.toBeNull();
      console.log(`${name}: ${(report.endedAtMs! / 60000).toFixed(2)} min, quiet ${report.longestQuietMs} ms`);
      expect(report.endedAtMs!, 'at least 5 minutes').toBeGreaterThanOrEqual(300_000);
      expect(report.endedAtMs!, 'at most 7 minutes').toBeLessThanOrEqual(420_000);
      expect(report.repeatedLines, 'no line repeats').toEqual([]);
      expect(report.longestQuietMs, `quiet at ${Math.round(report.quietAtMs / 1000)} s`).toBeLessThanOrEqual(8000);
      for (const g of report.gifts) {
        if (g.outcome.kind === 'repeat' || g.outcome.kind === 'aside') continue;
        expect(g.takeAfterMs, `${g.object} taken at once`).toBe(0);
        expect(g.consequenceAfterMs!, `${g.object} matters within 6 s`).toBeLessThanOrEqual(6000);
      }
    });
  }

  test('together they reach every beat', () => {
    const reached = new Set(Object.values(reports).flatMap((r) => r.beats));
    const all = spine.scenes.flatMap((s) => s.beats.map((b) => b.id));
    expect(all.filter((b) => !reached.has(b))).toEqual([]);
  });

  test('the same wrong gift twice is wordless the second time', () => {
    const kinds = reports['the same wrong object twice']!.gifts.map((g) => g.outcome.kind);
    expect(kinds).toEqual(['rule', 'repeat']);
  });

  test('a gift while nothing is asked is an aside and changes nothing', () => {
    const r = reports['a gift while nothing is asked']!;
    expect(r.gifts[0]!.outcome.kind).toBe('aside');
    expect(r.beats).toEqual(reports['nothing ever']!.beats);
  });

  test('holding defers the timeout by at most the grace', () => {
    const held = reports['holding an object through the whole gap ask']!;
    const none = reports['nothing ever']!;
    const delay = held.endedAtMs! - none.endedAtMs!;
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(HOLD_GRACE_MS + 100);
  });

  test('the dark path relights the lantern by courage, and both lantern paths end alike', () => {
    expect(reports['nothing ever']!.beats).toContain('lantern-fetch');
    expect(reports['eager: lantern, page and kite at once']!.beats).toContain('lantern-back');
    for (const r of Object.values(reports)) expect(r.beats.slice(-3)).toEqual(['lighthouse', 'the-beam', 'chapter-end']);
  });
});

describe('the scheduler', () => {
  test('a restored snapshot carries on exactly', () => {
    const a = createScheduler(spine, durationOf);
    for (let t = 0; t <= 40_000; t += 50) a.tick(t, false);
    a.gift(40_000, 'lantern', tags('lantern'), 'pip');
    const b = createScheduler(spine, durationOf, a.snapshot());
    for (let t = 40_050; t <= 90_000; t += 50) {
      a.tick(t, false);
      b.tick(t, false);
    }
    expect(b.snapshot()).toEqual(a.snapshot());
    expect(b.timeline()).toEqual(a.timeline());
  });

  test('a preempted beat applies nothing after its cut', () => {
    const s = createScheduler(spine, durationOf);
    for (let t = 0; t <= 30_000; t += 50) s.tick(t, false);
    s.gift(30_000, 'lantern', tags('lantern'), 'pip');
    const cut = s.snapshot().history.find((e) => e.cutMs !== null)!;
    const after = s.timeline().filter((i) => i.startMs >= cut.cutMs! && i.action.do === 'ask_reader');
    expect(after).toEqual([]);
  });
});
