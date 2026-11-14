/**
 * The web page's art: the book's real pieces, resized to WebP, and each character composed once from its rig.
 * Run from the repo root: `node tools/web-art.ts`. Writes client/public/web/. No credits, no generation.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ART = 'art';
const OUT = 'client/public/web';
mkdirSync(OUT, { recursive: true });

type Part = { file: string; x: number; y: number; z: number; scale: number; pivot?: [number, number]; rotation?: number; mirrored?: boolean };
type Rig = { parts: Record<string, Part>; head?: { x: number; y: number; z: number; scale: number; offsets: Record<string, [number, number]>; files: string }; chinShadow?: { x: number; y: number; width: number; height: number; z: number } };

const webp = (q = 82) => ({ quality: q, effort: 5 });

async function resized(src: string, out: string, width: number, q?: number): Promise<void> {
  await sharp(join(ART, src)).resize({ width, withoutEnlargement: true }).webp(webp(q)).toFile(join(OUT, out));
}

/** One layer of a character, placed relative to the point between its feet. */
type Placed = { buf: Buffer; x: number; y: number; z: number; w: number; h: number };

async function place(file: string, x: number, y: number, z: number, scale: number, opts: { rotation?: number; flip?: boolean; pivot?: [number, number] } = {}): Promise<Placed> {
  const meta = await sharp(file).metadata();
  const w = Math.round(meta.width! * scale);
  const h0 = Math.round(meta.height! * scale);
  let img = sharp(file).resize({ width: w });
  if (opts.flip) img = img.flop();
  if (!opts.rotation) {
    const buf = await img.png().toBuffer();
    return { buf, x, y, z, w, h: h0 };
  }
  const buf = await sharp(await img.png().toBuffer()).rotate(opts.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const m = await sharp(buf).metadata();
  // Turn about the rig's pivot, not the image's centre: find where the pivot went, and put it back.
  const [pu, pv] = opts.pivot ?? [50, 50];
  const px = (opts.flip ? 100 - pu : pu) / 100 * w;
  const py = pv / 100 * h0;
  const vx = px - w / 2;
  const vy = py - h0 / 2;
  const t = (opts.rotation * Math.PI) / 180;
  const nx = m.width! / 2 + vx * Math.cos(t) - vy * Math.sin(t);
  const ny = m.height! / 2 + vx * Math.sin(t) + vy * Math.cos(t);
  return { buf, x: x + px - nx, y: y + py - ny, z, w: m.width!, h: m.height! };
}

async function compose(name: string, layers: Placed[], height: number): Promise<void> {
  const minX = Math.min(...layers.map((l) => l.x));
  const minY = Math.min(...layers.map((l) => l.y));
  const maxX = Math.max(...layers.map((l) => l.x + l.w));
  const maxY = Math.max(...layers.map((l) => l.y + l.h));
  const pad = 8;
  const canvas = sharp({ create: { width: Math.ceil(maxX - minX) + pad * 2, height: Math.ceil(maxY - minY) + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const sorted = [...layers].sort((a, b) => a.z - b.z);
  const composed = await canvas
    .composite(sorted.map((l) => ({ input: l.buf, left: Math.round(l.x - minX + pad), top: Math.round(l.y - minY + pad) })))
    .png()
    .toBuffer();
  await sharp(composed).resize({ height, withoutEnlargement: true }).webp(webp(86)).toFile(join(OUT, `${name}.webp`));
  // Where the feet stand, as a share of the image, so the page can stand the card on its mark.
  const footX = (0 - minX + pad) / (maxX - minX + pad * 2);
  console.log(`${name}.webp  feet at ${footX.toFixed(3)} across`);
}

function chinShadow(c: NonNullable<Rig['chinShadow']>): Placed {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}"><defs><radialGradient id="g"><stop offset="0" stop-color="rgb(38,26,34)" stop-opacity=".5"/><stop offset=".72" stop-color="rgb(38,26,34)" stop-opacity="0"/></radialGradient></defs><ellipse cx="${c.width / 2}" cy="${c.height / 2}" rx="${c.width / 2}" ry="${c.height / 2}" fill="url(#g)"/></svg>`;
  return { buf: Buffer.from(svg), x: c.x, y: c.y, z: c.z, w: c.width, h: c.height };
}

async function character(who: string, name: string, head: string | null, swap: Record<string, string | null> = {}, height = 640): Promise<void> {
  const rig = JSON.parse(readFileSync(join(ART, 'cast', who, 'rig.json'), 'utf8')) as Rig;
  const layers: Placed[] = [];
  for (const [id, p] of Object.entries(rig.parts)) {
    const file = id in swap ? swap[id] : p.file;
    if (file === null) continue;
    const path = join(ART, 'cast', who, file!);
    layers.push(await place(path, p.x, p.y, p.z, p.scale, { rotation: p.rotation, pivot: p.pivot }));
    if (p.mirrored) {
      // The far wing: the same piece, flipped about the body's centre line.
      const w = Math.round((await sharp(path).metadata()).width! * p.scale);
      layers.push(await place(path, -(p.x + w), p.y, p.z - 0.5, p.scale, { rotation: p.rotation ? -p.rotation : undefined, flip: true, pivot: p.pivot }));
    }
  }
  if (rig.chinShadow) layers.push(chinShadow(rig.chinShadow));
  if (rig.head && head) {
    const h = rig.head;
    const o = h.offsets[head] ?? [0, 0];
    layers.push(await place(join(ART, 'cast', who, h.files.replace('<name>', head)), h.x + o[0] * h.scale, h.y + o[1] * h.scale, h.z, h.scale));
  }
  await compose(name, layers, height);
}

// The cover, and two spreads' layers.
await resized('book/cover-front.png', 'cover.webp', 900, 84);
for (const f of ['ground.png', 'layer-1-sky-night.png', 'layer-1-sky.png', 'layer-2-headland.png', 'layer-3-dunes.png', 'layer-4-foreground.png']) {
  await resized(`sets/shore-path/${f}`, `shore-${f.replace('.png', '.webp')}`, 1600);
}
for (const f of ['ground.png', 'lamp-sky.png', 'lamp-room.png', 'lamp-lit.png', 'far-railing.png', 'near-ledge.png']) {
  await resized(`sets/the-lamp/${f}`, `lamp-${f.replace('.png', '.webp')}`, f === 'lamp-lit.png' ? 520 : 1600);
}
await resized('fx/smoke.png', 'smoke.webp', 200);
for (const o of ['kite', 'spool', 'brass-key']) await resized(`objects/${o}/${o}.png`, `object-${o}.webp`, 360);

// The cast, composed from their rigs at rest.
await character('pip', 'pip-lit', 'forward');
await character('pip', 'pip-scared', 'scared', { lantern: 'parts/lantern-out.png' });
await character('pip', 'pip-up', 'up', { lantern: null });
await character('pip', 'pip-talk', 'talk');
await character('wick', 'wick', 'forward');
await character('moth', 'moth', null, {}, 420);
// The lantern alone, lit and out, for handing back.
await resized('cast/pip/parts/lantern.png', 'lantern-lit.webp', 260);
await resized('cast/pip/parts/lantern-out.png', 'lantern-out.webp', 260);
console.log('web art written to', OUT);
