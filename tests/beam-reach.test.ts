import { describe, expect, test } from 'vitest';
import { Vector3 } from '@iwsdk/core';
import { BEAM_REACH_M, beamReach } from '../client/src/light/beam-reach.ts';
import type { Place } from '../client/src/room-fx/room-map.ts';

const wall = (centre: [number, number, number], normal: [number, number, number], widthM = 4, label: Place['label'] = 'wall'): Place => ({
  id: `${label}-0`,
  label,
  raw: label,
  centre: new Vector3(...centre),
  normal: new Vector3(...normal),
  sizeM: [widthM, 2.5],
  outline: [],
  horizontal: false,
  standIn: false,
});

describe("the lamp's ray stops at your wall", () => {
  const lamp = new Vector3(0, 0.9, -0.5);
  // A wall 2 m ahead of the lamp (toward -z), facing back into the room.
  const ahead = wall([0, 1.2, -2.5], [0, 0, 1]);

  test('runs out to the wall it points at', () => {
    expect(beamReach(lamp, Math.PI, [ahead])).toBeCloseTo(2, 5);
  });

  test('a wall behind the lamp, or off to one side of its line, does not stop it', () => {
    expect(beamReach(lamp, 0, [ahead])).toBe(BEAM_REACH_M);
    const narrow = wall([3, 1.2, -2.5], [0, 0, 1], 1);
    expect(beamReach(lamp, Math.PI, [narrow])).toBe(BEAM_REACH_M);
  });

  test('the nearest wall wins; windows and doors count, the floor does not', () => {
    const near = wall([0, 1.2, -1.5], [0, 0, 1], 1, 'window');
    const floor = { ...wall([0, 0, -1], [0, 1, 0]), label: 'floor' as const, horizontal: true };
    expect(beamReach(lamp, Math.PI, [ahead, near, floor])).toBeCloseTo(1, 5);
  });

  test('turned toward you, it stops short of your eyes, and runs full length again as it swings past', () => {
    const head = new Vector3(0, 1.2, 0.1);
    // Straight at you: 0.6 m away, so it ends 0.3 m short.
    expect(beamReach(lamp, 0, [], head)).toBeCloseTo(0.3, 5);
    // Leaning in close, your eyes still win over the shortest ray.
    expect(beamReach(lamp, 0, [], new Vector3(0, 1.2, -0.1))).toBeCloseTo(0.1, 5);
    // A little to one side, it eases back out.
    const partway = beamReach(lamp, 0.6, [], head);
    expect(partway).toBeGreaterThan(0.3);
    expect(partway).toBeLessThan(BEAM_REACH_M);
    // Well to the side, or turned away, your head doesn't matter.
    expect(beamReach(lamp, Math.PI / 2, [], head)).toBe(BEAM_REACH_M);
    expect(beamReach(lamp, Math.PI, [ahead], head)).toBeCloseTo(2, 5);
  });

  test('no room read: the room dim\'s 3 m; a wall at the book still shows a ray leaving the lamp', () => {
    expect(beamReach(lamp, 1, [])).toBe(BEAM_REACH_M);
    expect(beamReach(lamp, Math.PI, [wall([0, 1.2, -0.6], [0, 0, 1])])).toBe(0.5);
  });
});
