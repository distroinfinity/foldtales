import type { Unfold } from '../show/cues.ts';

const COVER_SHARE = 0.4;
/** While shut, the house lights come partway back up, like an intermission. */
const SHUT_DIM = 0.45;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * How open your hands have left the book, from 0 (shut) to 1 (open), as hinge angles. Closing
 * folds the cards front to back, then the cover comes over; opening is the reverse.
 */
export function controlFold(amount: number, cards: number): Unfold {
  const a = clamp01(amount);
  const span = (1 - COVER_SHARE) / Math.max(1, cards);
  return {
    dim: SHUT_DIM + (1 - SHUT_DIM) * a,
    cover: clamp01(a / COVER_SHARE),
    layers: Array.from({ length: cards }, (_, i) => clamp01((a - COVER_SHARE - i * span) / span)),
  };
}

/** The book is never more open than either the show or your hands have it. A landing overshoot survives. */
export function combineUnfold(show: Unfold, hands: Unfold): Unfold {
  return {
    dim: Math.min(show.dim, hands.dim),
    cover: Math.min(show.cover, hands.cover),
    layers: show.layers.map((l, i) => {
      const h = hands.layers[i] ?? 1;
      return h >= 1 ? l : Math.min(l, h);
    }),
  };
}

/**
 * How open the cover is while you swing it, from where you grabbed it. Relative, so a pinch a few
 * centimetres above the edge (your fingers stop on the real table) doesn't jump the cover.
 * Angles are your hand's about the spine: pi lying open on the left, 0 laid over on the right.
 */
export function dragCover(start: { amount: number; angle: number }, angle: number): number {
  return clamp01(start.amount + (angle - start.angle) / Math.PI);
}
