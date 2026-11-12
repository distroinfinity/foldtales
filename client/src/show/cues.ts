/** Each cue's look over its own time, as pure functions. Timings are `art/m1-proof.html`'s approved ones. */

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const easeInOut = (v: number): number => (v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2);
/** Rises past 1 and settles back: a pop-up landing. */
const overshoot = (v: number): number => (v === 0 ? 0 : 1 + 2.2 * (v - 1) ** 3 + 1.2 * (v - 1) ** 2);

export interface Unfold {
  /** House lights: 0 is your room as it is, 1 is fully down. */
  dim: number;
  /** 0 closed, 1 lying open. */
  cover: number;
  /** One per card in stack order, 0 flat, 1 standing, briefly past 1 as it lands. */
  layers: number[];
}

const DIM_MS = 2000;
const COVER_FROM_MS = 600;
const COVER_MS = 1800;
const RISE_FROM_MS = 2500;
const RISE_STAGGER_MS = 280;
const RISE_MS = 600;

export function unfoldAt(ms: number, cards: number): Unfold {
  return {
    dim: clamp01(ms / DIM_MS),
    cover: easeInOut(clamp01((ms - COVER_FROM_MS) / COVER_MS)),
    layers: Array.from({ length: cards }, (_, i) => overshoot(clamp01((ms - RISE_FROM_MS - i * RISE_STAGGER_MS) / RISE_MS))),
  };
}

/** When the last card has landed. */
export const unfoldEndMs = (cards: number): number => RISE_FROM_MS + (cards - 1) * RISE_STAGGER_MS + RISE_MS;

export interface Gust {
  /** 0 calm, 1 at its peak. */
  strength: number;
  /** Each leaf's progress across the spread, or null when it isn't in the air. */
  leaves: Array<number | null>;
}

const GUST_MS = 1600;
const LEAF_MS = 1500;
const LEAF_STAGGER_MS = 250;

export function gustAt(ms: number): Gust {
  const g = clamp01(ms / GUST_MS);
  return {
    strength: g > 0 && g < 1 ? Math.sin(g * Math.PI) : 0,
    leaves: [0, 1].map((i) => {
      const p = clamp01((ms - i * LEAF_STAGGER_MS) / LEAF_MS);
      return p > 0 && p < 1 ? p : null;
    }),
  };
}

export interface LightOut {
  lit: boolean;
  /** 0 none, rising through 1 as it clears. */
  smoke: number;
}

const SMOKE_MS = 1800;

export function lightOutAt(ms: number): LightOut {
  const s = clamp01(ms / SMOKE_MS);
  return { lit: false, smoke: s > 0 && s < 1 ? s : 0 };
}

/** One full turn of the lighthouse lamp. */
export const BEAM_TURN_MS = 7000;
const BEAM_SWELL_MS = 900;

export interface Beam {
  /** Radians about up, in the book's frame: 0 points straight at the reader. */
  azimuth: number;
  /** 0 off, 1 full. */
  strength: number;
}

/** The relit lamp's beam: it swells in pointing at you, then turns steadily round the room. */
export function beamAt(ms: number): Beam {
  return { azimuth: (ms / BEAM_TURN_MS) * Math.PI * 2, strength: clamp01(ms / BEAM_SWELL_MS) ** 2 };
}
