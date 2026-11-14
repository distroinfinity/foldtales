/**
 * Every picture the page shows, fetched and decoded before the page reveals itself, so nothing
 * pops in while you scroll. The order puts the hero first.
 */
export const WEB_ART = [
  'room-tabletop.webp', 'cover.webp', 'room-flat-window.webp', 'room-flat-lamp.webp', 'room-flat-shelves.webp',
  'shore-ground.webp', 'shore-layer-1-sky-night.webp', 'shore-layer-2-headland.webp', 'shore-layer-3-dunes.webp', 'shore-layer-4-foreground.webp',
  'pip-lit.webp', 'pip-scared.webp', 'pip-up.webp', 'pip-talk.webp', 'lantern-lit.webp', 'lantern-out.webp', 'smoke.webp',
  'lamp-ground.webp', 'lamp-lamp-sky.webp', 'lamp-lamp-room.webp', 'lamp-far-railing.webp', 'lamp-near-ledge.webp', 'lamp-lamp-lit.webp',
  'wick.webp', 'moth.webp', 'object-kite.webp', 'object-spool.webp', 'object-brass-key.webp',
];

export const art = (file: string): string => `./web/${file}`;

/** Resolves once every picture is decoded, or after `capMs`, whichever comes first. */
export function preloadArt(capMs = 6000): Promise<void> {
  const all = Promise.all(
    WEB_ART.map(async (file) => {
      const img = new Image();
      img.src = art(file);
      try {
        await img.decode();
      } catch {
        // A missing picture shouldn't hold the page back.
      }
      kept.push(img);
    }),
  ).then(() => undefined);
  return Promise.race([all, new Promise<void>((resolve) => setTimeout(resolve, capMs))]);
}

/** Decoded images stay referenced, so the browser keeps them ready. */
const kept: HTMLImageElement[] = [];
