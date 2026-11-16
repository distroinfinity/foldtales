import { describe, expect, test, vi } from 'vitest';
import type { Spine, StageAction } from '../contracts/src/index.ts';
import type { RuntimeSnapshot } from '../client/src/show/runtime.ts';
import { markOf } from '../client/src/show/manifest.ts';
import { stageLook } from '../client/src/paint/card-material.ts';
import { manifest, playTo, playUntil, stage, type Harness } from './stage-harness.ts';

// These play the whole stage frame by frame: 3–9 s each on a busy machine, past vitest's 5 s
// default. A longer limit for this file only, as in handover and resume; what each test checks is unchanged.
vi.setConfig({ testTimeout: 30_000 });

/** What the reader sees of the lantern: lit painting, glow, the pool of light, and the one in Pip's paw. */
const seen = (s: Harness) => {
  const object = s.root.getObjectByName('object:lantern')!;
  return {
    lit: object.getObjectByName('lit')?.visible ?? false,
    glow: object.getObjectByName('glow')?.visible ?? false,
    pool: stageLook.poolStrength.value > 0,
    inPaw: s.puppets.get('pip')!.root.getObjectByName('lantern')!.visible,
  };
};

const hi = markOf(manifest, 'shore-path', 'light-high')!;

/** One spread on the shore: Pip takes what lifts his light, it goes up, then comes down. */
function lifting(what: 'kite' | 'ladder' | 'moth'): Spine {
  const A = (a: object) => a as StageAction;
  const up = what === 'moth' ? [A({ do: 'cue', withPrev: false, cue: 'light-up', target: 'cast:moth' }), A({ do: 'move', withPrev: true, who: 'moth', to: 'mark:light-high' })] : [A({ do: 'use', withPrev: false, who: 'pip', object: what, on: null, problem: null }), A({ do: 'cue', withPrev: false, cue: 'light-up', target: `object:${what}` })];
  return {
    v: 1,
    id: 'chapter-light',
    title: 'Light up',
    premise: 'A test of the light going up high.',
    source: 'authored',
    targetSeconds: { min: 1, max: 600 },
    scenes: [
      {
        id: 'water',
        setId: 'shore-path',
        summary: 'Up high',
        objects: [
          { id: 'lantern', defId: 'lantern', origin: 'set' },
          { id: 'kite', defId: 'kite', origin: 'drawer' },
          { id: 'ladder', defId: 'ladder', origin: 'drawer' },
        ],
        problem: null,
        entry: 'up',
        beats: [
          { id: 'up', source: 'authored', sceneId: 'water', estSeconds: 8, actions: [A({ do: 'place', withPrev: false, what: 'cast:moth', at: 'moth-near' }), ...up, A({ do: 'wait', withPrev: false, seconds: 3 })], next: 'down', replaces: null },
          { id: 'down', source: 'authored', sceneId: 'water', estSeconds: 6, actions: [A({ do: 'cue', withPrev: false, cue: 'light-down', target: null }), A({ do: 'wait', withPrev: false, seconds: 3 })], next: 'end', replaces: null },
          { id: 'end', source: 'authored', sceneId: 'water', estSeconds: 2, actions: [A({ do: 'cue', withPrev: false, cue: 'chapter-end', target: null })], next: null, replaces: null },
        ],
      },
    ],
    bridges: [],
  };
}

describe('the light goes up high, and comes back down', () => {
  test.each(['kite', 'ladder', 'moth'] as const)('with the %s: up, settled, restored, and back in the paw', (what) => {
    // Before: in Pip's paw. Up by 1.6 s at the latest; down starts at 7.8 s at the earliest.
    const before = seen(playTo(stage(lifting(what)), 500));
    expect(before.inPaw).toBe(true);
    const s = playTo(stage(lifting(what)), 7000);
    const lantern = s.objects.get('lantern')!.home;
    expect(lantern).toMatchObject({ kind: 'page', at: [hi[0], hi[1], hi[2]] });
    if (what !== 'moth') {
      const held = s.objects.get(what)!.home;
      expect(held.kind).toBe('page');
      if (held.kind === 'page') expect(what === 'kite' ? held.at[1] > hi[1] : held.at[1] === 0).toBe(true);
    }
    // A place saved while it's up comes back up.
    const saved = s.runtime.snapshot();
    const again = stage(lifting(what));
    again.runtime.restore(structuredClone(saved) as RuntimeSnapshot, s.clock.ms);
    playTo(again, s.clock.ms + 50);
    expect(again.objects.get('lantern')!.home).toEqual(lantern);
    // Up high it's still lit, with its glow and its pool, and the same after a restore.
    expect(seen(again)).toEqual({ lit: true, glow: true, pool: true, inPaw: false });
    playTo(s, 7050);
    expect(seen(s)).toEqual({ lit: true, glow: true, pool: true, inPaw: false });
    // Then it comes down: the lantern in Pip's paw, the kite or ladder at his feet, and the beat after plays.
    playUntil(s, 'end');
    expect(s.objects.get('lantern')!.home).toEqual({ kind: 'carried', cast: 'pip' });
    // Back down, it looks as it did before it went up.
    playTo(s, s.clock.ms + 1500);
    expect(seen(s)).toEqual(before);
    if (what !== 'moth') expect(s.objects.get(what)!.home).toMatchObject({ kind: 'page', at: [expect.any(Number), 0, expect.any(Number)] });
  });
});

test("chapter 3's beacon: the kite kept in the satchel comes out to Pip and carries the light up", () => {
  const spine = lifting('kite');
  const up = spine.scenes[0]!.beats[0]!;
  // Borrowed from the satchel by a place, not handed over by the reader.
  up.actions = up.actions.map((a) => (a.do === 'use' ? ({ do: 'place', withPrev: false, what: 'object:kite', at: 'water-edge' } as StageAction) : a));
  const s = stage(spine);
  s.objects.send('kite', { kind: 'satchel' }, 0);
  playTo(s, 300);
  expect(s.objects.get('kite')!.home.kind).toBe('satchel');
  playTo(s, 7000);
  expect(s.objects.get('lantern')!.home).toMatchObject({ kind: 'page', at: [hi[0], hi[1], hi[2]] });
  const kite = s.objects.get('kite')!.home;
  expect(kite.kind === 'page' && kite.at[1] > hi[1]).toBe(true);
});

test("on the landing (chapter 3's beacon): the kite from the satchel carries the light up to the landing's own light-high", () => {
  const landingHi = markOf(manifest, 'the-landing', 'light-high')!;
  const spine = lifting('kite');
  const scene = spine.scenes[0]!;
  scene.setId = 'the-landing';
  scene.beats[0]!.actions = scene.beats[0]!.actions.map((a) =>
    a.do === 'use' ? ({ do: 'place', withPrev: false, what: 'object:kite', at: 'pip-step' } as StageAction) : a.do === 'place' && a.what === 'cast:moth' ? ({ ...a, at: 'moth-landing' } as StageAction) : a,
  );
  const s = stage(spine);
  s.objects.send('kite', { kind: 'satchel' }, 0);
  playTo(s, 7000);
  expect(s.objects.get('lantern')!.home).toMatchObject({ kind: 'page', at: [landingHi[0], landingHi[1], landingHi[2]] });
  playTo(s, 11_000);
  expect(s.objects.get('lantern')!.home).toEqual({ kind: 'carried', cast: 'pip' });
});
