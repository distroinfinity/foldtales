/**
 * The installable page's icons, cut from the book's cover: the gilt lighthouse on the night-navy
 * cloth. No new paint. Run from the repo root: `node tools/pwa-icons.ts`.
 *
 * - `icon-192.png`, `icon-512.png`: the emblem, close.
 * - `icon-512-maskable.png`: wider, so the emblem sits inside the central 80% a mask may keep.
 */
import sharp from 'sharp';

const COVER = 'art/book/cover-front.png';
const OUT = 'client/public/icons';
/** The emblem's centre, as a share of the cover's width and height (measured on the cover). */
const CENTRE = { x: 0.5122, y: 0.7711 };

const { width, height } = await sharp(COVER).metadata();
const cut = async (share: number, size: number, file: string) => {
  const side = Math.round(width! * share);
  const left = Math.round(width! * CENTRE.x - side / 2);
  const top = Math.round(height! * CENTRE.y - side / 2);
  await sharp(COVER).extract({ left, top, width: side, height: side }).resize(size, size, { kernel: 'lanczos3' }).flatten({ background: '#1F2A44' }).png({ compressionLevel: 9 }).toFile(`${OUT}/${file}`);
};
await cut(0.36, 192, 'icon-192.png');
await cut(0.36, 512, 'icon-512.png');
await cut(0.47, 512, 'icon-512-maskable.png');
console.log(`icons from ${COVER} (${width}×${height}) into ${OUT}`);
