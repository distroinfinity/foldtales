import content from './page-content.json';

/**
 * Every picture the page shows, fetched and decoded before the page reveals itself, so nothing
 * pops in while you scroll. The order puts the hero first.
 */
export const WEB_ART: string[] = content.art;

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
