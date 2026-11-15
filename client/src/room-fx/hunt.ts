/**
 * The treasure hunt, over its own time: the lamp's beam swells, sweeps the room once and a quarter,
 * slows, and stops on the place where the lost thing waits. A soft pool of light opens there and the
 * thing appears in it. Pure, so a resume lands in the same moment.
 */

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const easeOut = (v: number): number => 1 - (1 - v) ** 3;

const SWELL_MS = 900;
const SWEEP_FROM_MS = 600;
const SWEEP_MS = 4600;
/** How far round the beam goes before it settles on the place. */
const SWEEP_TURNS = 1.25;
/** When the pool opens and the thing shows in it. */
export const HUNT_REVEAL_MS = SWEEP_FROM_MS + SWEEP_MS - 300;
const SPOT_MS = 900;
/** Nobody fetched it: after this long it drifts back to the book along the beam. */
export const HUNT_RETURN_MS = 8000 + 20_000;
/** Once found, the hunt's beam fades over this long. */
export const HUNT_FADE_MS = 1500;

export interface HuntLook {
  /** Radians about up, in world space, from the lamp. */
  azimuth: number;
  /** 0 off, 1 full. */
  strength: number;
  /** The pool of light on the place, 0 to 1. */
  spot: number;
  /** Whether the thing shows yet. */
  revealed: boolean;
}

/** `target` is the world azimuth from the lamp to the place; `foundMs` how long ago it was picked up, if it was. */
export function huntAt(ms: number, target: number, foundMs: number | null): HuntLook {
  const sweep = easeOut(clamp01((ms - SWEEP_FROM_MS) / SWEEP_MS));
  const azimuth = target - SWEEP_TURNS * Math.PI * 2 * (1 - sweep);
  const fade = foundMs === null ? 1 : 1 - clamp01(foundMs / HUNT_FADE_MS);
  return {
    azimuth,
    strength: clamp01(ms / SWELL_MS) ** 2 * fade,
    spot: clamp01((ms - HUNT_REVEAL_MS) / SPOT_MS) * fade,
    revealed: ms >= HUNT_REVEAL_MS,
  };
}
