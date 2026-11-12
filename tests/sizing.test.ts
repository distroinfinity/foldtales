import { describe, expect, test } from 'vitest';
import { chooseScale, minTextSizeM, footprint, settleOnTable } from '../client/src/stage/sizing.ts';

const head = { x: 0, y: 1.2, z: 0 };
const spotAt = (z: number) => ({ x: 0, y: 0.75, z });

describe('tray to desk sizing', () => {
  test('a desk within reach gets the book at full size', () => {
    expect(chooseScale({ head, spot: spotAt(-0.38), plane: null })).toMatchObject({ scale: 1, fits: true });
  });

  test('a far spot steps the book down so its far corners stay within reach', () => {
    const near = chooseScale({ head, spot: spotAt(-0.38), plane: null }).scale;
    const far = chooseScale({ head, spot: spotAt(-0.46), plane: null }).scale;
    expect(far).toBeLessThan(near);
    expect(far).toBeGreaterThanOrEqual(0.7);
  });

  test('a small tray from the scanned plane gets a smaller book that fits on it', () => {
    const tray = [{ x: -0.2, z: -0.18 }, { x: 0.2, z: -0.18 }, { x: 0.2, z: -0.5 }, { x: -0.2, z: -0.5 }];
    const result = chooseScale({ head, spot: spotAt(-0.34), plane: tray });
    expect(result.scale).toBeLessThan(1);
    expect(result.fits).toBe(true);
    for (const corner of footprint(spotAt(-0.34), head, result.scale)) {
      expect(Math.abs(corner.x)).toBeLessThanOrEqual(0.2 + 1e-9);
    }
  });

  test('when even the smallest book cannot fit, it opens at the smallest and says so', () => {
    const scrap = [{ x: -0.05, z: -0.3 }, { x: 0.05, z: -0.3 }, { x: 0.05, z: -0.4 }, { x: -0.05, z: -0.4 }];
    expect(chooseScale({ head, spot: spotAt(-0.35), plane: scrap })).toMatchObject({ scale: 0.7, fits: false });
  });

  test('the footprint faces the reader: its width runs across your view', () => {
    const corners = footprint(spotAt(-0.4), head, 1);
    const xs = corners.map((c) => c.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.42, 3);
  });
});

describe('text stays legible after scaling', () => {
  test('at least 1° at its real distance', () => {
    const size = minTextSizeM(0.012, 0.7, 0.65);
    expect(size * 0.7).toBeGreaterThanOrEqual(0.65 * Math.tan(Math.PI / 180) - 1e-9);
  });

  test('a full-size book keeps the authored size when that is already enough', () => {
    expect(minTextSizeM(0.012, 1, 0.6)).toBe(0.012);
  });
});

describe('settling onto the table you meant', () => {
  // The owner's coffee table, seen from a low seat: its near edge is 0.3 m in front of you.
  const seat = { x: 0, y: 0.92, z: 0 };
  const coffee = { y: 0.412, outline: [{ x: -0.5, z: -0.3 }, { x: 0.5, z: -0.3 }, { x: 0.5, z: -0.95 }, { x: -0.5, z: -0.95 }] };
  const inside = (c: { x: number; z: number }) => c.x >= -0.5 - 1e-9 && c.x <= 0.5 + 1e-9 && c.z <= -0.3 + 1e-9 && c.z >= -0.95 - 1e-9;

  test('a hit on the rim, just off the near edge, slides the whole book onto the top', () => {
    const settled = settleOnTable({ head: seat, spot: { x: 0, y: 0.43, z: -0.27 }, tables: [coffee], userScale: null });
    expect(settled.table).toBe(coffee);
    expect(footprint(settled.spot, seat, settled.scale).every(inside)).toBe(true);
    // As near you as it can be: only as far in as the book and its pulled-out drawer need.
    expect(settled.spot.z).toBeGreaterThan(-0.3 - (0.315 * settled.scale) / 2 - 0.122 * settled.scale - 0.03);
  });

  test('it rests at the table top, not the hit height', () => {
    expect(settleOnTable({ head: seat, spot: { x: 0, y: 0.43, z: -0.27 }, tables: [coffee], userScale: null }).spot.y).toBeCloseTo(0.412, 3);
  });

  test('a spot already well on the table stays where it is', () => {
    const settled = settleOnTable({ head: seat, spot: { x: 0, y: 0.412, z: -0.62 }, tables: [coffee], userScale: null });
    expect(settled.spot.x).toBeCloseTo(0, 3);
    expect(settled.spot.z).toBeCloseTo(-0.62, 3);
  });

  test('a table at another height, or across the room, is not the one you meant', () => {
    const shelf = { ...coffee, y: 0.74 };
    const far = { y: 0.412, outline: coffee.outline.map((c) => ({ x: c.x + 2, z: c.z })) };
    const settled = settleOnTable({ head: seat, spot: { x: 0, y: 0.43, z: -0.27 }, tables: [shelf, far], userScale: null });
    expect(settled.table).toBeNull();
    expect(settled.spot).toEqual({ x: 0, y: 0.43, z: -0.27 });
  });

  test('a size you chose by hand is kept, and still lands on the top', () => {
    const settled = settleOnTable({ head: seat, spot: { x: 0, y: 0.43, z: -0.27 }, tables: [coffee], userScale: 0.8 });
    expect(settled.scale).toBe(0.8);
    expect(footprint(settled.spot, seat, 0.8).every(inside)).toBe(true);
  });

  test('a table beyond easy reach still gets the largest book that fits on its top, not the smallest', () => {
    const far = { y: 0.412, outline: [{ x: -0.5, z: -0.55 }, { x: 0.5, z: -0.55 }, { x: 0.5, z: -1.2 }, { x: -0.5, z: -1.2 }] };
    const settled = settleOnTable({ head: seat, spot: { x: 0, y: 0.43, z: -0.52 }, tables: [far], userScale: null });
    expect(settled.fits).toBe(false);
    expect(settled.scale).toBe(1);
    expect(footprint(settled.spot, seat, 1).every((c) => c.z <= -0.55 + 1e-9 && c.z >= -1.2)).toBe(true);
  });
});
