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

describe('the compressed art cache', async () => {
  const { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const sharp = (await import('sharp')).default;
  const { buildArtCache, blobPath, cacheKey, CACHE_SETTINGS } = await import('../tools/art-build.ts');

  const png = (rgb: [number, number, number], alpha = false) =>
    sharp({ create: { width: 24, height: 20, channels: alpha ? 4 : 3, background: alpha ? { r: rgb[0], g: rgb[1], b: rgb[2], alpha: 0.5 } : { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer();
  const root = mkdtempSync(join(tmpdir(), 'tt-art-'));
  const art = join(root, 'art');
  const put = async (path: string, rgb: [number, number, number], alpha = false) => {
    mkdirSync(join(art, path, '..'), { recursive: true });
    writeFileSync(join(art, path), await png(rgb, alpha));
  };
  await put('sets/a/ground.png', [200, 10, 10]);
  await put('cast/pip/body.png', [10, 200, 10], true);
  await put('cast/pip/head.png', [10, 10, 200], true);
  const folders = ['sets/a', 'cast/pip'];
  const served = (cache: string, rel: string) => readFileSync(join(cache, rel));

  test('a change, then a revert, serves each version its own bytes', async () => {
    const cache = join(root, 'c1');
    await buildArtCache({ artRoot: art, folders, cacheDir: cache, threads: 2 });
    const first = served(cache, 'ktx2/sets/a/ground.ktx2');
    await put('sets/a/ground.png', [10, 200, 200]);
    await buildArtCache({ artRoot: art, folders, cacheDir: cache, threads: 2 });
    const changed = served(cache, 'ktx2/sets/a/ground.ktx2');
    expect(changed.equals(first)).toBe(false);
    await put('sets/a/ground.png', [200, 10, 10]);
    await buildArtCache({ artRoot: art, folders, cacheDir: cache, threads: 2 });
    expect(served(cache, 'ktx2/sets/a/ground.ktx2').equals(first)).toBe(true);
  }, 120_000);

  test('a missing blob is encoded again, and unused blobs are removed', async () => {
    const cache = join(root, 'c2');
    const index = await buildArtCache({ artRoot: art, folders, cacheDir: cache, threads: 2 });
    expect(Object.keys(index.atlases)).toEqual(['cast/pip']);
    const blobs = readdirSync(join(cache, 'blobs'));
    expect(blobs).toHaveLength(2);
    rmSync(join(cache, 'blobs', blobs[0]!));
    writeFileSync(join(cache, 'blobs', 'stale.ktx2'), 'old');
    await buildArtCache({ artRoot: art, folders, cacheDir: cache, threads: 2 });
    expect(readdirSync(join(cache, 'blobs')).sort()).toEqual([...blobs].sort());
  }, 120_000);

  test('the key covers the settings and every source of an atlas', () => {
    const a = { name: 'body.png', bytes: new Uint8Array([1, 2, 3]) };
    const b = { name: 'head.png', bytes: new Uint8Array([4]) };
    expect(cacheKey('atlas', [a, b])).not.toBe(cacheKey('atlas', [a, { ...b, bytes: new Uint8Array([5]) }]));
    expect(cacheKey('atlas', [a, b])).not.toBe(cacheKey('file', [a, b]));
    expect(JSON.stringify(CACHE_SETTINGS)).toContain('"encoder"');
    expect(JSON.stringify(CACHE_SETTINGS)).toContain('"uastcLDRQualityLevel":2');
  });

  test('threads give the same bytes as one thread', async () => {
    const one = join(root, 'one');
    const many = join(root, 'many');
    await buildArtCache({ artRoot: art, folders, cacheDir: one, threads: 1 });
    await buildArtCache({ artRoot: art, folders, cacheDir: many, threads: 3 });
    for (const rel of ['ktx2/sets/a/ground.ktx2', 'ktx2/cast/pip.ktx2']) expect(served(many, rel).equals(served(one, rel))).toBe(true);
    expect(existsSync(blobPath(many, 'nope'))).toBe(false);
    rmSync(root, { recursive: true, force: true });
  }, 120_000);
});
