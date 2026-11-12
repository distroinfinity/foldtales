import { describe, expect, test } from 'vitest';
import { arrivalAt, OPEN_AT_MS } from '../client/src/stage/arrival.ts';

describe('the found-surface moment', () => {
  test('the ember flies to the spot first, then the wash blooms', () => {
    const start = arrivalAt(0, true);
    expect(start.ember).toBeGreaterThan(0);
    expect(start.bloom).toBe(0);
    const later = arrivalAt(900, true);
    expect(later.ember).toBe(0);
    expect(later.bloom).toBeGreaterThan(0.3);
  });

  test('a confirmed table gets the printed line; a provisional spot never does', () => {
    expect(arrivalAt(1600, true).words).toBeGreaterThan(0.9);
    for (let ms = 0; ms < 6000; ms += 100) expect(arrivalAt(ms, false).words).toBe(0);
  });

  test('the book drops in after the bloom and lands before the book opens', () => {
    const before = arrivalAt(1000, true);
    expect(before.bookVisible).toBe(false);
    const landing = arrivalAt(1700, true);
    expect(landing.bookVisible).toBe(true);
    expect(landing.drop).toBeGreaterThan(0);
    const landed = arrivalAt(OPEN_AT_MS - 1, true);
    expect(landed.drop).toBe(0);
    expect(landed.landed).toBe(true);
  });

  test('a provisional wash is quieter', () => {
    expect(arrivalAt(1500, false).bloom).toBeLessThan(arrivalAt(1500, true).bloom);
  });
});
