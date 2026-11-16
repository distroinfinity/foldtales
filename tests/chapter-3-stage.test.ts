import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { Vector3 } from '@iwsdk/core';
import { Spine, type Beat, type StageAction } from '../contracts/src/index.ts';
import { markOf } from '../client/src/show/manifest.ts';
import { manifest, playTo, playUntil, stage, type Harness } from './stage-harness.ts';

// Chapter 3's own beats, played on the stage frame by frame (slow on a busy machine, as in light-up).
vi.setConfig({ testTimeout: 60_000 });

const episode = (file: string) => Spine.parse(JSON.parse(readFileSync(new URL(`../client/public/show/${file}`, import.meta.url), 'utf8')));

/** The landing spread cut down to Moth's beacon: Pip on the steps and Moth over the water, where the spread has them by then, then the real beacon-moth and calling beats. */
function mothBeacon(file: string): Spine {
  const real = episode(file).scenes[1]!;
  const beat = (id: string) => structuredClone(real.beats.find((b) => b.id === id)!) as Beat;
  const A = (a: object) => a as StageAction;
  const turn: Beat = { id: 'in', source: 'authored', sceneId: real.id, estSeconds: 1, actions: [A({ do: 'place', withPrev: false, what: 'cast:pip', at: 'pip-step' }), A({ do: 'place', withPrev: true, what: 'cast:moth', at: 'moth-landing' })], next: 'beacon-moth', replaces: null };
  const end: Beat = { id: 'end', source: 'authored', sceneId: real.id, estSeconds: 3, actions: [A({ do: 'wait', withPrev: false, seconds: 3 })], next: null, replaces: null };
  return Spine.parse({
    v: 1,
    id: 'chapter-3-beacon',
    title: 'The beacon',
    premise: "A test of chapter 3's Moth beacon.",
    source: 'authored',
    targetSeconds: { min: 1, max: 600 },
    scenes: [{ id: real.id, setId: real.setId, summary: 'The beacon', objects: [{ id: 'lantern', defId: 'lantern', origin: 'set' }], problem: null, entry: 'in', beats: [turn, beat('beacon-moth'), { ...beat('calling'), next: 'end' }, end] }],
    bridges: [],
  });
}

/** Book-local positions: the lantern on the page, and Moth's card (its lift carries a flier's height). */
const bookLocal = (s: Harness, o: { getWorldPosition(v: Vector3): Vector3 }) => s.view.root.worldToLocal(o.getWorldPosition(new Vector3()));
const lantern = (s: Harness) => bookLocal(s, s.root.getObjectByName('object:lantern')!);
const moth = (s: Harness) => bookLocal(s, s.puppets.get('moth')!.lift);

describe.each(['episode-3.json', 'episode-3.page-hunt.json'])("chapter 3's Moth beacon (%s)", (file) => {
  test('Moth comes to Pip, flies up with the light, holds it at the light-high mark, and brings it back down', () => {
    const set = mothBeacon(file).scenes[0]!.setId;
    const hi = markOf(manifest, set, 'light-high')!;
    const home = markOf(manifest, set, 'moth-landing')!;
    const s = stage(mothBeacon(file));
    playUntil(s, 'beacon-moth');
    expect(s.objects.get('lantern')!.home).toEqual({ kind: 'carried', cast: 'pip' });
    // Moth flies down beside Pip while he asks, so from the moment the lantern leaves his paw until it is
    // back, Moth is never farther from it than standing at Pip's side (cast spacing 4.5 cm).
    let worst = 0;
    while (s.runtime.scheduler.current().beatId !== 'end' && s.clock.ms < 60_000) {
      playTo(s, s.clock.ms + 50);
      if (s.objects.get('lantern')!.home.kind === 'page') worst = Math.max(worst, lantern(s).distanceTo(moth(s)));
      if (s.runtime.scheduler.current().beatId === 'calling' && s.objects.get('lantern')!.home.kind === 'page') {
        // Up high: the lantern at the landing's light-high, and Moth right there with it.
        expect(s.objects.get('lantern')!.home).toMatchObject({ kind: 'page', at: hi });
        expect(moth(s).distanceTo(lantern(s))).toBeLessThan(0.002);
      }
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThan(0.05);
    // Back down: the lantern in Pip's paw, Moth home at its landing mark.
    playTo(s, s.clock.ms + 2000);
    expect(s.objects.get('lantern')!.home).toEqual({ kind: 'carried', cast: 'pip' });
    expect(moth(s).toArray().map((n) => +n.toFixed(3))).toEqual([home[0], +(home[1] + bookLocal(s, s.actors.get('moth')!).y).toFixed(3), home[2]]);
  });
});
