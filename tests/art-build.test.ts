import { describe, expect, test } from 'vitest';
import { packAtlas, padToBlocks, premultiply, toBlock } from '../tools/art-build.ts';

describe('the atlas packer', () => {
  const sizes = [
    { name: 'coat', w: 466, h: 682 },
    { name: 'head', w: 308, h: 394 },
    { name: 'arm', w: 172, h: 303 },
    { name: 'tail', w: 234, h: 275 },
    { name: 'lantern', w: 138, h: 286 },
  ];

  test('every piece gets a place, none overlap, with a gutter between them', () => {
    const atlas = packAtlas(sizes, 8, 2048);
    const rects = Object.values(atlas.rects);
    expect(rects).toHaveLength(sizes.length);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const apart = a.x + a.w + 8 <= b.x || b.x + b.w + 8 <= a.x || a.y + a.h + 8 <= b.y || b.y + b.h + 8 <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  test('pieces keep their exact size, and the sheet is in whole compression blocks', () => {
    const atlas = packAtlas(sizes, 8, 2048);
    expect(atlas.rects.coat).toMatchObject({ w: 466, h: 682 });
    expect(atlas.width % 4).toBe(0);
    expect(atlas.height % 4).toBe(0);
    for (const r of Object.values(atlas.rects)) {
      expect(r.x + r.w).toBeLessThanOrEqual(atlas.width);
      expect(r.y + r.h).toBeLessThanOrEqual(atlas.height);
    }
  });

  test('refuses a sheet wider than the limit rather than making one the headset cannot load', () => {
    expect(() => packAtlas([{ name: 'huge', w: 5000, h: 10 }], 8, 4096)).toThrow();
  });
});

describe('baking the alpha', () => {
  test('premultiplies, so paper hidden under clear pixels cannot bleed into a filtered edge', () => {
    const rgba = new Uint8Array([200, 100, 50, 255, 240, 240, 230, 0, 100, 200, 60, 128]);
    expect([...premultiply(rgba)]).toEqual([200, 100, 50, 255, 0, 0, 0, 0, 50, 100, 30, 128]);
  });

  test('rounds a size up to whole compression blocks', () => {
    expect(toBlock(1173)).toBe(1176);
    expect(toBlock(1176)).toBe(1176);
  });

  test('pads on the top and right, keeping the picture at the bottom left for a Y-flipped encode', () => {
    const one = new Uint8Array([9, 9, 9, 255]);
    const padded = padToBlocks(one, 1, 1);
    expect([padded.width, padded.height]).toEqual([4, 4]);
    expect([...padded.rgba.subarray(3 * 4 * 4, 3 * 4 * 4 + 4)]).toEqual([9, 9, 9, 255]);
    expect(padded.rgba[3]).toBe(0);
  });
});
