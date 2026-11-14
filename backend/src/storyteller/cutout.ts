import sharp from 'sharp';

/**
 * Cuts a painted object off flat magenta paper, in Node: the paper and its crimson shadows go
 * transparent, the magenta spill at the edge is pulled back, specks are dropped, and the result is
 * checked (one piece, clear of the border, a sensible size) before it can enter the story.
 */

export interface Cutout {
  png: Buffer;
  width: number;
  height: number;
  /** Share of the painted image the object covers. */
  coverage: number;
}

export type CutoutResult = { ok: true; cutout: Cutout } | { ok: false; reason: string };

const MAX_SIDE = 512;

export async function cutOut(image: Buffer): Promise<CutoutResult> {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (x: number, y: number) => (y * W + x) * 3;
  // The paper's colour, from the border: how magenta it is.
  const border: number[] = [];
  for (let x = 0; x < W; x += 8) border.push(px(x, 2), px(x, H - 3));
  for (let y = 0; y < H; y += 8) border.push(px(2, y), px(W - 3, y));
  const magentaness = (i: number) => {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const hi = Math.min(r, b);
    // Paper and its shadows: red and blue alike and well above green. Anything else is paint.
    return hi > g ? ((hi - g) / 255) * (1 - Math.abs(r - b) / 255) : 0;
  };
  const paper = border.map(magentaness).sort((a, b) => a - b)[Math.floor(border.length / 2)]!;
  if (paper < 0.35) return { ok: false, reason: 'the paper is not magenta' };

  const alpha = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = magentaness(px(x, y));
      // Fully paper at 70% of the paper's magenta and above, fully paint at 30% and below.
      alpha[y * W + x] = Math.max(0, Math.min(1, (paper * 0.7 - m) / (paper * 0.4)));
    }
  }
  // Keep the largest piece; drop specks.
  const label = new Int32Array(W * H).fill(-1);
  let best = -1;
  let bestSize = 0;
  const sizes: number[] = [];
  for (let start = 0; start < W * H; start++) {
    if (alpha[start]! < 0.5 || label[start] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % W;
      const y = (p - x) / W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && label[q] === -1 && alpha[q]! >= 0.5) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(size);
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
  }
  if (best < 0) return { ok: false, reason: 'nothing painted' };
  const coverage = bestSize / (W * H);
  if (coverage < 0.04 || coverage > 0.6) return { ok: false, reason: `covers ${(coverage * 100).toFixed(0)}% of the image` };
  // Grow the piece by a few pixels so its soft edge stays; everything else goes.
  let minX = W, minY = H, maxX = 0, maxY = 0;
  const keep = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    if (label[p] !== best) continue;
    const x = p % W;
    const y = (p - x) / W;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H) keep[yy * W + xx] = 1;
    }
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (minX < 6 || minY < 6 || maxX > W - 7 || maxY > H - 7) return { ok: false, reason: 'the paint touches the edge of the paper' };

  const pad = 8;
  const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad), x1 = Math.min(W - 1, maxX + pad), y1 = Math.min(H - 1, maxY + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y + y0) * W + (x + x0);
      const i = p * 3;
      const o = (y * w + x) * 4;
      const a = keep[p] ? alpha[p]! : 0;
      let r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
      // Pull the paper's magenta back out of the soft edge.
      if (a < 1) {
        const cap = Math.max(g, Math.min(r, b) * (1 - (1 - a) * 0.9));
        r = Math.min(r, Math.max(cap, r - (r - g) * (1 - a)));
        b = Math.min(b, Math.max(cap, b - (b - g) * (1 - a)));
      }
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = Math.round(a * 255);
    }
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const png = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .resize(Math.round(w * scale), Math.round(h * scale))
    .png()
    .toBuffer();
  return { ok: true, cutout: { png, width: Math.round(w * scale), height: Math.round(h * scale), coverage } };
}
