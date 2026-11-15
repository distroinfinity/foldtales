import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { Worker } from 'node:worker_threads';
import { ENCODE_SETTINGS, encodeKtx2 } from './ktx2-encode.ts';

/**
 * The art pipeline for the headset: every painted piece as a compressed KTX2 texture, with
 * each character's parts and heads packed into one atlas. Pure helpers are exported for tests;
 * `buildArtCache` does the encoding, on several threads, and keeps a content-addressed cache.
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

/**
 * Everything that changes an encoded texture besides its pixels. Part of every cache key, so a
 * change here (or a new encoder version) re-encodes everything, and nothing stale is reused.
 */
export const CACHE_SETTINGS = { cache: 2, gutter: GUTTER, maxAtlas: MAX_ATLAS, encode: ENCODE_SETTINGS } as const;

function pngsUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pngsUnder(path);
    return entry.name.endsWith('.png') ? [path] : [];
  });
}

const posix = (path: string): string => path.split(sep).join('/');

/** Reads a PNG as RGBA. */
async function readRgba(path: string): Promise<{ rgba: Uint8Array; width: number; height: number; hasAlpha: boolean }> {
  const sharp = (await import('sharp')).default;
  const image = sharp(readFileSync(path));
  const meta = await image.metadata();
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8Array(data), width: info.width, height: info.height, hasAlpha: !!meta.hasAlpha };
}

/** A PNG's size and whether it has alpha, without decoding its pixels. */
async function readMeta(path: string): Promise<{ width: number; height: number; hasAlpha: boolean }> {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(readFileSync(path)).metadata();
  return { width: meta.width!, height: meta.height!, hasAlpha: !!meta.hasAlpha };
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

/** A texture's cache key: the settings, what it's built from (names and bytes), and how. */
export function cacheKey(kind: 'file' | 'atlas', sources: Array<{ name: string; bytes: Uint8Array }>): string {
  const hash = createHash('sha256').update(JSON.stringify(CACHE_SETTINGS)).update(`\n${kind}\n`);
  for (const source of sources) hash.update(`${source.name}\n`).update(source.bytes).update('\n');
  return hash.digest('hex').slice(0, 32);
}

/** Where a key's encoded bytes live. A blob is only ever written whole (see `writeBlob`), so one that exists is good. */
export const blobPath = (cacheDir: string, key: string): string => join(cacheDir, 'blobs', `${key}.ktx2`);

export function hasBlob(cacheDir: string, key: string): boolean {
  return (statSync(blobPath(cacheDir, key), { throwIfNoEntry: false })?.size ?? 0) > 0;
}

/** Written to a temporary name, then renamed, so an interrupted build never leaves half a texture under a key. */
export function writeBlob(cacheDir: string, key: string, bytes: Uint8Array): void {
  const path = blobPath(cacheDir, key);
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, bytes);
  renameSync(temp, path);
}

interface Pool {
  encode(rgba: Uint8Array, width: number, height: number, hasAlpha: boolean): Promise<Uint8Array>;
  close(): Promise<void>;
}

/** Encoder threads, one job each at a time. Falls back to this thread if threads can't start. */
function encoderPool(size: number): Pool {
  let workers: Worker[] = [];
  try {
    workers = Array.from({ length: size }, () => new Worker(new URL('./ktx2-worker.ts', import.meta.url)));
  } catch {
    workers = [];
  }
  if (workers.length === 0) return { encode: encodeKtx2, close: async () => undefined };
  const idle = [...workers];
  const waiting: Array<(w: Worker) => void> = [];
  let nextId = 0;
  const take = (): Promise<Worker> => (idle.length > 0 ? Promise.resolve(idle.pop()!) : new Promise((resolve) => waiting.push(resolve)));
  const give = (worker: Worker) => {
    const next = waiting.shift();
    if (next) next(worker);
    else idle.push(worker);
  };
  return {
    async encode(rgba, width, height, hasAlpha) {
      const worker = await take();
      const id = nextId++;
      try {
        return await new Promise<Uint8Array>((resolve, reject) => {
          const onMessage = (reply: { id: number; bytes?: Uint8Array; error?: string }) => {
            if (reply.id !== id) return;
            worker.off('message', onMessage);
            worker.off('error', onError);
            if (reply.bytes) resolve(new Uint8Array(reply.bytes));
            else reject(new Error(reply.error ?? 'encode failed'));
          };
          const onError = (cause: Error) => {
            worker.off('message', onMessage);
            reject(cause);
          };
          worker.on('message', onMessage);
          worker.once('error', onError);
          worker.postMessage({ id, rgba, width, height, hasAlpha }, [rgba.buffer as ArrayBuffer]);
        });
      } finally {
        give(worker);
      }
    },
    close: async () => {
      await Promise.all(workers.map((w) => w.terminate()));
    },
  };
}

/** Runs jobs with at most `limit` in flight, so only that many decoded images are in memory at once. */
async function inParallel<T>(items: T[], limit: number, run: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async (): Promise<void> => {
    while (next < items.length) await run(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane));
}

/**
 * Encodes every PNG in the named art folders. Character folders (`cast/*`) become one atlas each.
 *
 * The cache is content-addressed: each texture's bytes are stored under a key made from the cache
 * settings and its sources' names and bytes (`blobs/<key>.ktx2`). Changing a source and changing it
 * back, a missing blob, an interrupted build or a new encoder setting can't serve the wrong bytes.
 * `ktx2/` is then filled from the blobs on every build (the names the site serves), and blobs no
 * longer used are removed.
 */
export async function buildArtCache({
  artRoot,
  folders,
  cacheDir,
  log = () => undefined,
  threads = Math.max(1, Math.min(8, availableParallelism() - 1)),
}: {
  artRoot: string;
  folders: string[];
  cacheDir: string;
  log?: (line: string) => void;
  threads?: number;
}): Promise<ArtIndex> {
  const index: ArtIndex = { v: 1, files: {}, atlases: {} };
  mkdirSync(cacheDir, { recursive: true });
  // `book` holds `book/drawer` too: each file is encoded once, whichever folder lists it first.
  const seen = new Set<string>();
  const outputs = new Map<string, string>(); // served name -> key
  const jobs: Array<{ key: string; label: string; pixels: () => Promise<{ rgba: Uint8Array; width: number; height: number; hasAlpha: boolean }> }> = [];

  for (const folder of folders) {
    const files = pngsUnder(join(artRoot, folder))
      .sort()
      .filter((file) => !seen.has(file));
    files.forEach((file) => seen.add(file));
    if (folder.startsWith('cast/')) {
      const sources = await Promise.all(files.map(async (file) => ({ file, name: posix(relative(join(artRoot, folder), file)), bytes: readFileSync(file), ...(await readMeta(file)) })));
      const atlas = packAtlas(sources.map((s) => ({ name: s.name, w: s.width, h: s.height })), GUTTER, MAX_ATLAS);
      const key = cacheKey('atlas', sources);
      const rel = `ktx2/${folder}.ktx2`;
      outputs.set(rel, key);
      index.atlases[folder] = { ktx2: rel, size: [atlas.width, atlas.height], rects: atlas.rects };
      if (!hasBlob(cacheDir, key))
        jobs.push({
          key,
          label: `atlas ${folder} (${atlas.width}×${atlas.height})`,
          pixels: async () => {
            const sheet = new Uint8Array(atlas.width * atlas.height * 4);
            for (const source of sources) {
              const { rgba } = await readRgba(source.file);
              const r = atlas.rects[source.name]!;
              const pre = premultiply(rgba);
              for (let y = 0; y < r.h; y++) sheet.set(pre.subarray(y * r.w * 4, (y + 1) * r.w * 4), ((r.y + y) * atlas.width + r.x) * 4);
            }
            return { rgba: sheet, width: atlas.width, height: atlas.height, hasAlpha: true };
          },
        });
      continue;
    }
    for (const file of files) {
      const artPath = posix(relative(artRoot, file));
      const rel = `ktx2/${artPath.replace(/\.png$/, '.ktx2')}`;
      const bytes = readFileSync(file);
      const meta = await readMeta(file);
      const key = cacheKey('file', [{ name: artPath, bytes }]);
      outputs.set(rel, key);
      index.files[artPath] = { ktx2: rel, size: [meta.width, meta.height], texSize: [toBlock(meta.width), toBlock(meta.height)], premultiplied: meta.hasAlpha };
      if (!hasBlob(cacheDir, key))
        jobs.push({
          key,
          label: artPath,
          pixels: async () => {
            const source = await readRgba(file);
            const pre = source.hasAlpha ? premultiply(source.rgba) : source.rgba;
            const padded = padToBlocks(pre, source.width, source.height);
            return { ...padded, hasAlpha: source.hasAlpha };
          },
        });
    }
  }

  if (jobs.length > 0) {
    log(`encoding ${jobs.length} textures on ${threads} threads`);
    const pool = encoderPool(threads);
    try {
      await inParallel(jobs, threads, async (job) => {
        log(`encoding ${job.label}`);
        const { rgba, width, height, hasAlpha } = await job.pixels();
        writeBlob(cacheDir, job.key, await pool.encode(rgba, width, height, hasAlpha));
      });
    } finally {
      await pool.close();
    }
  }

  // The served names, always rewritten from the blobs, so they can't drift from the index.
  rmSync(join(cacheDir, 'ktx2'), { recursive: true, force: true });
  for (const [rel, key] of outputs) {
    mkdirSync(dirname(join(cacheDir, rel)), { recursive: true });
    copyFileSync(blobPath(cacheDir, key), join(cacheDir, rel));
  }
  const used = new Set([...outputs.values()].map((key) => `${key}.ktx2`));
  for (const name of existsSync(join(cacheDir, 'blobs')) ? readdirSync(join(cacheDir, 'blobs')) : []) if (!used.has(name)) rmSync(join(cacheDir, 'blobs', name), { force: true });
  writeFileSync(join(cacheDir, 'ktx2.json'), JSON.stringify(index));
  return index;
}
