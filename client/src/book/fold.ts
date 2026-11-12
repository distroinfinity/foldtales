/** How the book's rigid pieces turn on their hinges. Stage space: x right, y up, +z toward the reader. */

/**
 * The left half (cover and left page) turns about the spine. Closed, it lies upside down on
 * the right half; open, beside it. It swings up and over, never through the table.
 */
export const coverRotationZ = (open: number): number => -Math.PI * (1 - open);

/** A card turns about its hinge line: flat toward the reader with its painting face down, or standing. */
export const layerRotationX = (stand: number): number => (1 - stand) * (Math.PI / 2);

/** How far toward the reader a card reaches when it lies flat. It must stay on the page. */
export const flatReachZ = (hingeZ: number, heightM: number): number => hingeZ + heightM;

/** The horizontal texture range each half of a split layer uses. */
export function halfUv(side: 'left' | 'right', splitColumnPx: number, widthPx: number): [number, number] {
  const split = splitColumnPx / widthPx;
  return side === 'left' ? [0, split] : [split, 1];
}
