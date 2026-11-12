import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

/**
 * The art pipeline for the headset: every painted piece as a compressed KTX2 texture, with
 * each character's parts and heads packed into one atlas. Pure helpers are exported for tests;
 * `buildArtCache` does the encoding and keeps a cache keyed by each source's content.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Atlas {
  width: number;
  height: number;
  rects: Record<string, Rect>;
}

/** Compression works in 4×4 blocks. */
export const toBlock = (n: number): number => Math.ceil(n / 4) * 4;

/** Shelf-packs pieces at their exact size, tallest first, with a gutter so mips don't bleed between them. */
export function packAtlas(pieces: Array<{ name: string; w: number; h: number }>, gutter: number, maxSize: number): Atlas {
  const widest = Math.max(...pieces.map((p) => p.w));
  if (widest + 2 * gutter > maxSize) throw new Error(`a piece ${widest}px wide can't fit a ${maxSize}px atlas`);
  const area = pieces.reduce((sum, p) => sum + (p.w + gutter) * (p.h + gutter), 0);
  const width = toBlock(Math.min(maxSize, Math.max(widest + 2 * gutter, Math.ceil(Math.sqrt(area * 1.15)))));
  const sorted = [...pieces].sort((a, b) => b.h - a.h || b.w - a.w);
  const rects: Record<string, Rect> = {};
  let x = gutter;
  let y = gutter;
  let row = 0;
  for (const piece of sorted) {
    if (x + piece.w + gutter > width) {
      x = gutter;
      y += row + gutter;
      row = 0;
    }
    rects[piece.name] = { x, y, w: piece.w, h: piece.h };
    x += piece.w + gutter;
    row = Math.max(row, piece.h);
  }
  const height = toBlock(y + row + gutter);
  if (height > maxSize) throw new Error(`the atlas needs ${height}px, over ${maxSize}px`);
  return { width, height, rects };
}

/** Bakes premultiplied alpha into RGBA bytes: compressed textures can't be premultiplied on upload. */
export function premultiply(rgba: Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3]!;
    out[i] = Math.round((rgba[i]! * a) / 255);
    out[i + 1] = Math.round((rgba[i + 1]! * a) / 255);
    out[i + 2] = Math.round((rgba[i + 2]! * a) / 255);
    out[i + 3] = a;
  }
  return out;
}

export interface ArtIndex {
  v: 1;
  /** One compressed file per source, keyed by art path. */
  files: Record<string, { ktx2: string; size: [number, number]; texSize: [number, number]; premultiplied: boolean }>;
  /** One atlas per character folder. Rects are in pixels, top-left origin. */
  atlases: Record<string, { ktx2: string; size: [number, number]; rects: Record<string, Rect> }>;
}

const GUTTER = 8;
const MAX_ATLAS = 4096;

function pngsUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pngsUnder(path);
    return entry.name.endsWith('.png') ? [path] : [];
  });
}

const posix = (path: string): string => path.split(sep).join('/');

async function encode(rgba: Uint8Array, width: number, height: number, hasAlpha: boolean): Promise<Uint8Array> {
  const { encodeToKTX2 } = await import('ktx2-encoder');
  // The pixels are already decoded, so the "decoder" just hands them over.
  return encodeToKTX2(new Uint8Array(1), {
    imageDecoder: async () => ({ width, height, data: rgba }),
    isUASTC: true,
    isYFlip: true,
    uastcLDRQualityLevel: 2,
    needSupercompression: true,
    generateMipmap: true,
    isPerceptual: true,
    isSetKTX2SRGBTransferFunc: true,
    enableRDO: hasAlpha ? false : true,
  } as never);
}

/** Reads a PNG as RGBA. */
async function readRgba(path: string): Promise<{ rgba: Uint8Array; width: number; height: number; hasAlpha: boolean }> {
  const sharp = (await import('sharp')).default;
  const image = sharp(readFileSync(path));
  const meta = await image.metadata();
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8Array(data), width: info.width, height: info.height, hasAlpha: !!meta.hasAlpha };
}

/**
 * Pads with clear pixels to whole blocks, on the top and right. Encoded Y-flipped, the picture then
 * sits at u 0..w/W, v 0..h/H, the same convention a PNG texture uses, and the pad is never sampled.
 */
export function padToBlocks(rgba: Uint8Array, width: number, height: number): { rgba: Uint8Array; width: number; height: number } {
  const w = toBlock(width);
  const h = toBlock(height);
  if (w === width && h === height) return { rgba, width, height };
  const out = new Uint8Array(w * h * 4);
  const top = h - height;
  for (let y = 0; y < height; y++) out.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), (top + y) * w * 4);
  return { rgba: out, width: w, height: h };
}

/**
 * Encodes every PNG in the named art folders. Character folders (`cast/*`) become one atlas each.
 * Results are cached in `cacheDir` by the hash of their sources, so a rebuild only encodes what changed.
 */
export async function buildArtCache({ artRoot, folders, cacheDir, log = () => undefined }: { artRoot: string; folders: string[]; cacheDir: string; log?: (line: string) => void }): Promise<ArtIndex> {
  const index: ArtIndex = { v: 1, files: {}, atlases: {} };
  mkdirSync(cacheDir, { recursive: true });
  const write = (rel: string, bytes: Uint8Array) => {
    const out = join(cacheDir, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, bytes);
  };
  const cached = (rel: string, hash: string) => existsSync(join(cacheDir, `${rel}.${hash}`));
  const mark = (rel: string, hash: string) => write(`${rel}.${hash}`, new Uint8Array());

  for (const folder of folders) {
    const files = pngsUnder(join(artRoot, folder)).sort();
    if (folder.startsWith('cast/')) {
      const hash = createHash('sha256');
      for (const file of files) hash.update(posix(relative(artRoot, file))).update(readFileSync(file));
      const key = hash.digest('hex').slice(0, 16);
      const rel = `ktx2/${folder}.ktx2`;
      const sources = await Promise.all(files.map(async (file) => ({ name: posix(relative(join(artRoot, folder), file)), ...(await readRgba(file)) })));
      const atlas = packAtlas(sources.map((s) => ({ name: s.name, w: s.width, h: s.height })), GUTTER, MAX_ATLAS);
      if (!cached(rel, key)) {
        log(`encoding atlas ${folder} (${atlas.width}×${atlas.height})`);
        const sheet = new Uint8Array(atlas.width * atlas.height * 4);
        for (const source of sources) {
          const r = atlas.rects[source.name]!;
          const pre = premultiply(source.rgba);
          for (let y = 0; y < r.h; y++) sheet.set(pre.subarray(y * r.w * 4, (y + 1) * r.w * 4), ((r.y + y) * atlas.width + r.x) * 4);
        }
        write(rel, await encode(sheet, atlas.width, atlas.height, true));
        mark(rel, key);
      }
      index.atlases[folder] = { ktx2: rel, size: [atlas.width, atlas.height], rects: atlas.rects };
      continue;
    }
    for (const file of files) {
      const artPath = posix(relative(artRoot, file));
      const rel = `ktx2/${artPath.replace(/\.png$/, '.ktx2')}`;
      const bytes = readFileSync(file);
      const key = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
      const source = await readRgba(file);
      if (!cached(rel, key)) {
        log(`encoding ${artPath}`);
        const pre = source.hasAlpha ? premultiply(source.rgba) : source.rgba;
        const padded = padToBlocks(pre, source.width, source.height);
        write(rel, await encode(padded.rgba, padded.width, padded.height, source.hasAlpha));
        mark(rel, key);
      }
      index.files[artPath] = { ktx2: rel, size: [source.width, source.height], texSize: [toBlock(source.width), toBlock(source.height)], premultiplied: source.hasAlpha };
    }
  }
  write('ktx2.json', new TextEncoder().encode(JSON.stringify(index)));
  return index;
}
