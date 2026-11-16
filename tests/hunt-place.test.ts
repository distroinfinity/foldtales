import { describe, expect, test } from 'vitest';
import { Vector3 } from '@iwsdk/core';
import { createRoomMap } from '../client/src/room-fx/room-map.ts';
import { huntPlace } from '../client/src/room-fx/hunt.ts';

// The room hunt hides the lost thing where you'd look (PR #45 review, finding 2): in front of you,
// toward the book, never behind you or on the seat you're in. Rooms here are Space Setup planes
// fed through the real room map, as the headset gives them.

interface Top {
  label: string;
  at: [number, number, number];
  size: [number, number];
}

/** A Space Setup frame with these horizontal tops (each a rectangle round its centre). */
function frameOf(tops: Top[]) {
  const planes = new Set(
    tops.map((t) => ({
      semanticLabel: t.label,
      orientation: 'horizontal',
      polygon: [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z]) => ({ x: (x! * t.size[0]) / 2, y: 0, z: (z! * t.size[1]) / 2 })),
      planeSpace: { at: t.at },
    })),
  );
  const pose = (space: { at: [number, number, number] }) => ({ transform: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, space.at[0], space.at[1], space.at[2], 1] } });
  return { detectedPlanes: planes, getPose: pose } as unknown as XRFrame;
}

const head = new Vector3(0, 1.2, 0);
const book = new Vector3(0, 0.75, -0.5);
const floor: Top = { label: 'floor', at: [0, 0, 0], size: [6, 6] };
const bookTable: Top = { label: 'table', at: [0, 0.72, -0.55], size: [0.8, 0.5] };

function room(tops: Top[], at = head) {
  const map = createRoomMap();
  map.setBookAt(book);
  map.frame(frameOf(tops), {} as XRReferenceSpace, at, new Vector3(0, 0, -1));
  return map;
}

/** Where the thing ends up in the world, and how far ahead of you that is, toward the book. */
function hidden(map: ReturnType<typeof room>, at = head) {
  const spot = huntPlace(map, 'room:couch', at, book)!;
  const world = new Vector3(spot.place.centre.x + spot.offset[0], spot.place.centre.y, spot.place.centre.z + spot.offset[1]);
  const toward = new Vector3(book.x - at.x, 0, book.z - at.z).normalize();
  return { spot, world, ahead: (world.x - at.x) * toward.x + (world.z - at.z) * toward.z };
}

describe('where the room hunt hides the lost thing', () => {
  test('a couch behind you (the review case) is passed over for the floor ahead and to your right', () => {
    const couch: Top = { label: 'couch', at: [0, 0.45, 0.5], size: [1.6, 0.6] };
    const map = room([floor, bookTable, couch]);
    // The room map alone still names that couch: its own answer is unchanged.
    expect(map.resolve('room:couch', 'rest')?.label).toBe('couch');
    const { spot, world, ahead } = hidden(map);
    expect(spot.place.label).toBe('floor');
    expect(ahead).toBeGreaterThan(0.5);
    expect(world.x).toBeGreaterThan(0.5);
    expect(world.y).toBe(0);
    // Not under the table the book stands on.
    expect(Math.abs(world.x - bookTable.at[0]) <= bookTable.size[0] / 2 && Math.abs(world.z - bookTable.at[2]) <= bookTable.size[1] / 2).toBe(false);
  });

  test('the couch you are sitting on is never the hiding place, even when it reaches in front of you', () => {
    const seat: Top = { label: 'couch', at: [0, 0.45, 0.05], size: [1.8, 0.9] };
    const { spot, ahead } = hidden(room([floor, bookTable, seat]));
    expect(spot.place.label).toBe('floor');
    expect(ahead).toBeGreaterThan(0.5);
  });

  test('a couch across the room in front of you is used, at its middle, even with a nearer one behind you', () => {
    const behind: Top = { label: 'couch', at: [0, 0.45, 0.8], size: [1.6, 0.6] };
    const ahead: Top = { label: 'couch', at: [0.4, 0.45, -1.9], size: [1.6, 0.7] };
    const { spot, world } = hidden(room([floor, bookTable, behind, ahead]));
    expect(spot.place.label).toBe('couch');
    expect(spot.offset).toEqual([0, 0]);
    expect(world.distanceTo(new Vector3(0.4, 0.45, -1.9))).toBeLessThan(1e-9);
  });

  test('with no couch in front, the next kind down that is in front (a shelf) is used; the book table never is', () => {
    const behind: Top = { label: 'couch', at: [0, 0.45, 0.8], size: [1.6, 0.6] };
    const shelf: Top = { label: 'shelf', at: [-1.2, 1.0, -1.4], size: [0.8, 0.3] };
    expect(hidden(room([floor, bookTable, behind, shelf])).spot.place.label).toBe('shelf');
    // Only the book's table and the floor: the floor ahead, not beside the book.
    const { spot, ahead } = hidden(room([floor, bookTable]));
    expect(spot.place.label).toBe('floor');
    expect(ahead).toBeGreaterThan(0.5);
  });

  test('a top well off to your side or right beside you does not count as in front', () => {
    const side: Top = { label: 'couch', at: [2.0, 0.45, -0.2], size: [1.6, 0.6] };
    const close: Top = { label: 'bed', at: [0.3, 0.5, -0.4], size: [0.4, 0.4] };
    expect(hidden(room([floor, bookTable, side, close])).spot.place.label).toBe('floor');
  });

  test('with no Space Setup at all, it still lands ahead of you and to your right', () => {
    const { world, ahead } = hidden(room([]));
    expect(ahead).toBeGreaterThan(0.5);
    expect(world.x).toBeGreaterThan(0.5);
  });

  test('turned round, "in front" follows the book, not where you happen to look', () => {
    // You stand on the far side of the book, so the couch at z 0.5 is now in front of you.
    const there = new Vector3(0, 1.2, -1.2);
    const couch: Top = { label: 'couch', at: [0, 0.45, 0.5], size: [1.6, 0.6] };
    const { spot } = hidden(room([floor, bookTable, couch], there), there);
    expect(spot.place.label).toBe('couch');
  });
});
