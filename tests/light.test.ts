import { describe, expect, test } from 'vitest';
import { dimAlpha, dimRing, MAX_DIM } from '../client/src/light/dim.ts';

describe('house lights down', () => {
  test('the room edges reach about 80% dark (raised from 68% after the first headset session)', () => {
    expect(MAX_DIM).toBeCloseTo(0.8);
    const ring = dimRing(0.6, 0.42);
    expect(dimAlpha(Math.PI / 2, 1, ring)).toBeCloseTo(MAX_DIM, 2);
  });

  test('a warm pool stays light around the book', () => {
    const ring = dimRing(0.6, 0.42);
    expect(dimAlpha(0, 1, ring)).toBeLessThan(0.15);
  });

  test('looking at the book, most of the room in view is properly dark, not half-lit', () => {
    // The first headset session: a 0.29 m book about 0.47 m away, and the room 30° off it still looked lit.
    const ring = dimRing(0.47, 0.29);
    expect(dimAlpha((30 * Math.PI) / 180, 1, ring)).toBeGreaterThan(0.6);
  });

  test('it rises smoothly, never a hard edge', () => {
    const ring = dimRing(0.6, 0.42);
    let last = dimAlpha(0, 1, ring);
    for (let a = 0; a <= Math.PI / 2; a += 0.02) {
      const v = dimAlpha(a, 1, ring);
      expect(v - last).toBeLessThan(0.08);
      last = v;
    }
  });

  test('the edge of the pool spans at least 15°, so it reads as falling light, not a ring', () => {
    const ring = dimRing(0.47, 0.29);
    expect(ring.outer - ring.inner).toBeGreaterThanOrEqual((15 * Math.PI) / 180);
  });

  test('a nearer book keeps a wider pool', () => {
    expect(dimRing(0.45, 0.42).inner).toBeGreaterThan(dimRing(0.8, 0.42).inner);
  });

  test('nothing dims before the show asks', () => {
    expect(dimAlpha(Math.PI / 2, 0, dimRing(0.6, 0.42))).toBe(0);
  });

  test('the falloff can be tuned, for adjusting it live in the headset', () => {
    expect(dimRing(0.47, 0.29, 0.5).outer - dimRing(0.47, 0.29, 0.5).inner).toBeCloseTo(0.5);
  });
});
