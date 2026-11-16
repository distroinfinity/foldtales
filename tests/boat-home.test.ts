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

  test("it leaves its circle where it was, sails to the water's inner edge on the book's side, and fades there", () => {
    const sailed = 41_000;
    expect(boatAt(sailed, 0, { x: 0, z: -0.6 })).toEqual({ ...boatAt(sailed, null, null), alpha: 1 });
    expect(boatAt(sailed + BOAT_HOME_MS / 2, BOAT_HOME_MS / 2, { x: 0, z: -0.6 }).alpha).toBe(1);
    const end = boatAt(sailed + BOAT_HOME_MS, BOAT_HOME_MS, { x: 0, z: -0.6 });
    expect(end.alpha).toBe(0);
    expect(end.x).toBeCloseTo(0, 5);
    expect(end.z).toBeCloseTo(-1.02, 5);
  });

  test('story time decides where it is, so a pause of any length, or a restore, lands it in the same place', () => {
    const items = [room('sea', 0), room('boat', 5000), room('boat-home', 60_000)];
    // The same story moment, reached after a short evening and after a long pause with the book shut.
    const story = roomAt(items, 64_000);
    const a = boatAt(story.boatMs!, story.boatHomeMs, { x: 0.2, z: -0.5 });
    const b = boatAt(roomAt(items, 64_000).boatMs!, roomAt(items, 64_000).boatHomeMs, { x: 0.2, z: -0.5 });
    expect(b).toEqual(a);
    // It left its arc where the arc had brought it by then, in story time.
    const left = boatAt(roomAt(items, 60_000).boatMs!, null, { x: 0.2, z: -0.5 });
    expect(boatAt(roomAt(items, 60_000).boatMs!, 0, { x: 0.2, z: -0.5 })).toEqual({ ...left, alpha: 1 });
  });

  test('it stays in front of you, wherever the book is: never more than 55 degrees off the way to the book, sailing or coming home', () => {
    for (const deg of [0, 40, 90, 135, 180, 250, 315]) {
      const toward = { x: Math.sin((deg * Math.PI) / 180) * 0.6, z: -Math.cos((deg * Math.PI) / 180) * 0.6 };
      for (let ms = 0; ms <= 120_000; ms += 1500) {
        for (const home of [null, 3000, BOAT_HOME_MS]) {
          const p = boatAt(ms, home, toward);
          const off = Math.acos(Math.min(1, (p.x * toward.x + p.z * toward.z) / (Math.hypot(p.x, p.z) * 0.6)));
          expect(off, `book at ${deg} deg, ${ms} ms, home ${home}`).toBeLessThanOrEqual((55 * Math.PI) / 180 + 1e-6);
        }
      }
    }
  });

  test('with no book to sail to, it fades where it turned', () => {
    expect(boatAt(50_000, BOAT_HOME_MS, null)).toEqual({ ...boatAt(50_000 - BOAT_HOME_MS, null, null), alpha: 0 });
  });
});
