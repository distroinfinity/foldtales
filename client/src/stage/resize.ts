/** The book's size range under your hands: a tray to a big desk. */
export const RESIZE_MIN = 0.6;
export const RESIZE_MAX = 1.3;
/** A soft tick each time the size crosses one of these steps. */
export const RESIZE_NOTCH = 0.05;

/** Stretching with two hands: the book scales with the distance between them. */
export function resizeScale(startScale: number, startDistM: number, distM: number): number {
  const scale = startScale * (distM / Math.max(0.01, startDistM));
  return Math.max(RESIZE_MIN, Math.min(RESIZE_MAX, scale));
}
