import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { BookSpec, SetSpec } from '../client/src/book/spec.ts';
import { coverRotationZ, flatReachZ, halfUv, layerRotationX } from '../client/src/book/fold.ts';

const json = (path: string) => JSON.parse(readFileSync(new URL(`../art/${path}`, import.meta.url), 'utf8'));
const book = BookSpec.parse(json('book/book.json'));
const set = SetSpec.parse(json('sets/shore-path/set.json'));

describe('the art specs', () => {
  test('the book and the set parse as the art wrote them', () => {
    expect(book.openSizeM).toEqual([0.42, 0.315]);
    expect(set.layers).toHaveLength(4);
  });

  test('every layer, and the standing character, fits on the page when folded flat', () => {
    const nearEdge = book.openSizeM[1] / 2;
    for (const layer of set.layers) expect(flatReachZ(layer.hinge[0][2], layer.sizeM[1]), layer.id).toBeLessThanOrEqual(nearEdge);
    const mark = set.marks[0]!;
    const manifest = JSON.parse(readFileSync(new URL('../client/public/show/manifest.json', import.meta.url), 'utf8'));
    const standing = manifest.cast.find((c: { member: { id: string } }) => c.member.id === mark.id).member.heightM;
    expect(flatReachZ(mark.position[2], standing)).toBeLessThanOrEqual(nearEdge);
  });

  test('the stack names every layer once', () => {
    for (const layer of set.layers) expect(set.stack.topToBottom.filter((id) => id === layer.id)).toHaveLength(1);
  });
});

describe('fold geometry', () => {
  test('the cover lies on the pages when closed and beside them when open', () => {
    expect(coverRotationZ(0)).toBeCloseTo(-Math.PI);
    expect(coverRotationZ(1)).toBeCloseTo(0);
  });

  test('a card lies flat toward the reader, face down, and stands upright', () => {
    expect(layerRotationX(0)).toBeCloseTo(Math.PI / 2);
    expect(layerRotationX(1)).toBeCloseTo(0);
    expect(layerRotationX(1.05)).toBeLessThan(0);
  });

  test('a layer splits at its column into the two pages', () => {
    expect(halfUv('left', 1360, 2720)).toEqual([0, 0.5]);
    expect(halfUv('right', 1360, 2720)).toEqual([0.5, 1]);
  });
});
