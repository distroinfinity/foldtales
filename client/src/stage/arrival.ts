/** The found-surface moment, as a pure function of the time since a spot was chosen. */

const EMBER_FLY_MS = 350;
const BLOOM_FROM_MS = 250;
const BLOOM_MS = 1100;
const WORDS_FROM_MS = 800;
const WORDS_MS = 600;
const DROP_FROM_MS = 1500;
const DROP_MS = 380;
/** When the book starts to open: a breath after it lands. */
export const OPEN_AT_MS = DROP_FROM_MS + DROP_MS + 700;
/** A provisional spot gets a smaller, fainter wash. */
const PROVISIONAL_BLOOM = 0.7;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const easeOut = (v: number): number => 1 - (1 - v) ** 3;

export interface Arrival {
  /** The ember's remaining flight to the spot, 1 at the start, 0 when it has landed. */
  ember: number;
  /** The wash's size, 0 to 1. */
  bloom: number;
  /** "Your theater will play here", 0 to 1. Only on a confirmed table. */
  words: number;
  bookVisible: boolean;
  /** How far the book still has to fall, 1 at the top, 0 on the table. */
  drop: number;
  landed: boolean;
}

export function arrivalAt(ms: number, confirmed: boolean): Arrival {
  const fly = clamp01(ms / EMBER_FLY_MS);
  const dropT = clamp01((ms - DROP_FROM_MS) / DROP_MS);
  return {
    ember: fly < 1 ? 1 - fly : 0,
    bloom: easeOut(clamp01((ms - BLOOM_FROM_MS) / BLOOM_MS)) * (confirmed ? 1 : PROVISIONAL_BLOOM),
    words: confirmed ? clamp01((ms - WORDS_FROM_MS) / WORDS_MS) : 0,
    bookVisible: ms >= DROP_FROM_MS,
    drop: ms >= DROP_FROM_MS ? 1 - dropT * dropT : 1,
    landed: dropT >= 1,
  };
}
