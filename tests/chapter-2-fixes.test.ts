import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { Vector3, type ShaderMaterial } from '@iwsdk/core';
import { Spine } from '../contracts/src/index.ts';
import type { RuntimeSnapshot } from '../client/src/show/runtime.ts';
import { manifest, playTo, playUntil, stage, type Harness } from './stage-harness.ts';

// Whole-stage plays, frame by frame.
vi.setConfig({ testTimeout: 90_000 });

const chapter2 = Spine.parse(JSON.parse(readFileSync(new URL('../client/public/show/episode-2.json', import.meta.url), 'utf8')));
const mark = (set: string, id: string) => manifest.sets.find((s) => s.id === set)!.marks.find((m) => m.id === id)!.position as [number, number, number];

/** The beam on your walls: where it comes from and how strong. And whether the book's cone shows (only the treasure hunt's, as on main). */
function beam(s: Harness) {
  const u = (s.dim.mesh.material as ShaderMaterial).uniforms;
  const shaft = s.view.root.getObjectByName('beam')!;
  return { strength: u.uBeamStrength!.value as number, lamp: (u.uLamp!.value as Vector3).clone(), coneShown: shaft.visible };
}
const lanternAt = (s: Harness) => s.objects.worldOf('lantern', new Vector3());
/** Chapter 2's stage as the host starts it: Pip carrying his lantern (startingObjects). */
function chapter2Stage(): Harness {
  const s = stage(chapter2);
  s.objects.send('lantern', { kind: 'carried', cast: 'pip' }, 0);
  return s;
}

/** Hands the reader's `id` to Pip while the light ask is open. */
function give(s: Harness, id: string) {
  playUntil(s, 'light-ask');
  playTo(s, s.clock.ms + 3000);
  s.objects.send(id, { kind: 'hand', side: 'right' }, 0);
  expect(s.runtime.gift(id, 'pip')).not.toBeNull();
  return s;
}

describe("a keeper's light held up high is the lamp: chapter 1's beam turns round your room from it, with no new look", () => {
  test.each([
    ['nobody helps: Moth carries it', (s: Harness) => s, 'high-moth'],
    ['the kite takes it up', (s: Harness) => give(s, 'kite'), 'high-kite'],
    ['the ladder holds it up', (s: Harness) => give(s, 'ladder'), 'high-ladder'],
  ])('%s', (_label, help, branch) => {
    const s = help(chapter2Stage());
    playUntil(s, branch);
    playUntil(s, 'she-sees');
    playTo(s, s.clock.ms + 1500);
    const up = beam(s);
    expect(up.strength).toBeGreaterThan(0.9);
    expect(up.lamp.distanceTo(lanternAt(s))).toBeLessThan(1e-6);
    expect(up.coneShown).toBe(false);

    // Restored at this moment, the light is still up and the beam still comes from it.
    const after = stage(chapter2);
    after.runtime.restore(JSON.parse(JSON.stringify(s.runtime.snapshot())) as RuntimeSnapshot, s.clock.ms);
    after.frame(16);
    const back = beam(after);
    expect(back.strength).toBeGreaterThan(0.9);
    expect(back.lamp.distanceTo(lanternAt(after))).toBeLessThan(1e-6);

    // Brought down, the beam goes back to the lighthouse on the headland.
    playUntil(s, 'page-two');
    const down = beam(s);
    expect(down.lamp.distanceTo(lanternAt(s))).toBeGreaterThan(0.01);
  });
});

describe('Moth goes up with the light he carries, and comes back down with it', () => {
  test('on the silent path', () => {
    const s = playUntil(chapter2Stage(), 'she-sees');
    const at = s.actors.get('moth')!.position;
    const high = mark('shore-path', 'moth-high');
    expect(Math.hypot(at.x - high[0], at.z - high[2])).toBeLessThan(0.005);
    // Just above the light he holds.
    const light = mark('shore-path', 'light-high');
    expect(high[1]).toBeGreaterThan(light[1]);
    playUntil(s, 'page-two');
    const follow = mark('shore-path', 'moth-follow');
    const now = s.actors.get('moth')!.position;
    expect(Math.hypot(now.x - follow[0], now.z - follow[2])).toBeLessThan(0.005);
  });
});

describe("chapter 1's keepsakes stay in your satchel through chapter 2", () => {
  test('a carried kite and spool are not laid on the shore, and are still yours at the end', () => {
    const s = chapter2Stage();
    s.objects.send('kite', { kind: 'satchel' }, 0);
    s.objects.send('spool', { kind: 'satchel' }, 0);
    playUntil(s, 'light-ask');
    expect(s.objects.get('kite')!.home.kind).toBe('satchel');
    expect(s.objects.get('spool')!.home.kind).toBe('satchel');
    playUntil(s, 'the-rocks');
    expect(s.objects.get('kite')!.home.kind).toBe('satchel');
    expect(s.objects.get('spool')!.home.kind).toBe('satchel');
  });

  test("without them, the shore's own kite and spool are laid on the sand as before", () => {
    const s = playUntil(chapter2Stage(), 'light-ask');
    expect(s.objects.get('kite')!.home.kind).toBe('page');
    expect(s.objects.get('spool')!.home.kind).toBe('page');
  });
});
