import { describe, expect, test } from 'vitest';
import type { RoomEffect, StageAction } from '../contracts/src/index.ts';
import { BOAT_HOME_MS, boatAt } from '../client/src/room-fx/sea.ts';
import { roomAt } from '../client/src/room-fx/state.ts';

const room = (effect: RoomEffect, startMs: number) => ({ action: { do: 'room', withPrev: false, effect, what: null, at: null } as StageAction, startMs });

describe("boat-home, chapter 2's signature peak", () => {
  test('the boat turns for home only once it is circling on the sea, and the sea going out ends it', () => {
    expect(roomAt([room('sea', 0), room('boat-home', 5000)], 9000).boatHomeMs).toBeNull();
    const home = roomAt([room('sea', 0), room('boat', 5000), room('boat-home', 60_000)], 64_000);
    expect(home.boatHomeMs).toBe(4000);
    expect(roomAt([room('sea', 0), room('boat', 5000), room('boat-home', 60_000), room('sea-off', 70_000)], 71_000).boatHomeMs).toBeNull();
  });

  test('it leaves its circle where it was, sails to the water\'s inner edge on the book\'s side, and fades there', () => {
    const turn = 41_000;
    const start = boatAt(turn, 0, { x: 0, z: -0.6 });
    expect(start).toEqual({ ...boatAt(turn, null, null), alpha: 1 });
    const mid = boatAt(turn + BOAT_HOME_MS / 2, BOAT_HOME_MS / 2, { x: 0, z: -0.6 });
    expect(mid.alpha).toBe(1);
    const end = boatAt(turn + BOAT_HOME_MS, BOAT_HOME_MS, { x: 0, z: -0.6 });
    expect(end.alpha).toBe(0);
    expect(end.x).toBeCloseTo(0, 5);
    expect(end.z).toBeCloseTo(-1.02, 5);
  });

  test('with no book to sail to, it fades where it turned; a resume lands in the same place', () => {
    const end = boatAt(50_000, BOAT_HOME_MS, null);
    expect(end).toEqual({ ...boatAt(50_000 - BOAT_HOME_MS, null, null), alpha: 0 });
    expect(boatAt(52_000, 3000, { x: 1, z: 0 })).toEqual(boatAt(52_000, 3000, { x: 1, z: 0 }));
  });
});
