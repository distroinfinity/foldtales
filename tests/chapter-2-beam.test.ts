import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { Vector3, type ShaderMaterial } from '@iwsdk/core';
import { Spine } from '../contracts/src/index.ts';
import type { RuntimeSnapshot } from '../client/src/show/runtime.ts';
import { BEAM_REACH_M } from '../client/src/light/beam-reach.ts';
import { playTo, playUntil, sets, spine as chapter1, stage, type Harness } from './stage-harness.ts';

// Whole-stage plays, frame by frame.
vi.setConfig({ testTimeout: 60_000 });

const chapter2 = Spine.parse(JSON.parse(readFileSync(new URL('../client/public/show/episode-2.json', import.meta.url), 'utf8')));

/** What the room's beam is doing now: its strength on your walls, where it pivots, and the lamp painted on the showing spread. */
function beam(s: Harness, setId: string) {
  const u = (s.dim.mesh.material as ShaderMaterial).uniforms;
  const anchor = sets.find((x) => x.id === setId)!.spec.anchors.lighthouseLamp!.position as [number, number, number];
  const painted = s.view.root.localToWorld(new Vector3(anchor[0], s.view.pageY + anchor[1], anchor[2]));
  return { strength: u.uBeamStrength!.value as number, lamp: (u.uLamp!.value as Vector3).clone(), painted, azimuth: u.uBeamAz!.value as number };
}

/** The ray you can see (b323be9 had dropped it outside the hunt): from the lamp, along the light on your walls, out to them. */
function ray(s: Harness, a: ReturnType<typeof beam>) {
  const pivot = s.view.root.getObjectByName('beam')!;
  expect(pivot.visible).toBe(true);
  expect(pivot.getWorldPosition(new Vector3()).distanceTo(a.lamp)).toBeLessThan(1e-4);
  const along = pivot.getWorldDirection(new Vector3());
  expect(Math.hypot(along.x - Math.sin(a.azimuth), along.z - Math.cos(a.azimuth))).toBeLessThan(1e-3);
  // With no room read, it runs the room dim's 3 m.
  const cone = pivot.children[0]!;
  const lengthM = (cone.getWorldScale(new Vector3()).x * 0.45);
  expect(lengthM).toBeCloseTo(BEAM_REACH_M, 2);
}

function sweeps(s: Harness, setId: string) {
  const a = beam(s, setId);
  expect(a.strength).toBeGreaterThan(0.9);
  // From the lamp as drawn on this spread.
  expect(a.lamp.distanceTo(a.painted)).toBeLessThan(1e-6);
  ray(s, a);
  // And it turns round the room.
  playTo(s, s.clock.ms + 1750);
  const b = beam(s, setId);
  expect(Math.abs(b.azimuth - a.azimuth)).toBeGreaterThan(1);
}

describe("chapter 2's lamp sweeps your room as chapter 1's does", () => {
  test("chapter 1's opening: the lamp's ray leaves the gallery's great lamp, as soon as the book is open", () => {
    const s = playUntil(stage(), 'opening');
    sweeps(playTo(s, s.clock.ms + 6000), 'the-lamp');
  });

  test("chapter 3's frosted lamp, at its opening", () => {
    const chapter3 = Spine.parse(JSON.parse(readFileSync(new URL('../client/public/show/episode-3.json', import.meta.url), 'utf8')));
    const s = playUntil(stage(chapter3), 'opening');
    sweeps(playTo(s, s.clock.ms + 6000), 'the-lamp-snow');
  });

  test("chapter 1's lighthouse at the gap, for comparison", () => {
    const s = playUntil(stage(), 'lighthouse');
    // The beam comes once Pip's light has lit the lamp, about 28 s into the beat.
    sweeps(playTo(s, s.clock.ms + 31_000), 'the-gap');
  });

  test.each([
    ['at the lamp, once the book is open', 'opening', 6000, 'the-lamp'],
    ['at the lamp, while the sea comes in', 'sea-in', 4000, 'the-lamp'],
    ['on the water', 'the-water', 4000, 'shore-path'],
    ['at the landing', 'the-rocks', 4000, 'the-landing'],
    ['as the boat comes home', 'homecoming', 4000, 'the-landing'],
  ])('%s', (_label, beat, afterMs, setId) => {
    const s = playUntil(stage(chapter2), beat);
    sweeps(playTo(s, s.clock.ms + afterMs), setId);
  });

  test('resumed from a saved place on the lamp spread, the beam is back', () => {
    const before = playUntil(stage(chapter2), 'trim');
    const snapshot = JSON.parse(JSON.stringify(before.runtime.snapshot())) as RuntimeSnapshot;
    const after = stage(chapter2);
    after.runtime.restore(snapshot, before.clock.ms);
    after.frame(16);
    sweeps(after, 'the-lamp');
  });
});
