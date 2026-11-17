import type { Vector3 } from '@iwsdk/core';
import type { Place } from '../room-fx/room-map.ts';

/** How far the lamp's ray runs with no wall in the way: the room dim's sphere, where its light lands. */
export const BEAM_REACH_M = 3;
/** Never shorter than this, so a wall right by the book still shows a ray leaving the lamp. */
const MIN_REACH_M = 0.5;
/** A little past a wall's edge still counts, so the ray doesn't overshoot at a corner. */
const EDGE_M = 0.3;
/** Turned toward you, the ray ends this far short of your eyes, so it never washes over your view... */
const HEAD_CLEAR_M = 0.3;
/** ...easing back to full length as it swings this far to either side of your head. */
const HEAD_NEAR_M = 0.25;
const HEAD_FAR_M = 0.6;

/**
 * Where the lamp's turning ray meets your room: the nearest real wall, window or door it crosses (level,
 * from the lamp, along `azimuth`: 0 toward +z, as the room dim reads it), else `BEAM_REACH_M`. Over
 * passthrough nothing hides a ray that runs on through a wall, so it stops there. Given your `head`, a ray
 * turned toward you ends short of your eyes.
 */
export function beamReach(lamp: Vector3, azimuth: number, places: readonly Place[], head: Vector3 | null = null): number {
  const dx = Math.sin(azimuth);
  const dz = Math.cos(azimuth);
  let best = BEAM_REACH_M;
  for (const p of places) {
    if (p.horizontal || (p.label !== 'wall' && p.label !== 'window' && p.label !== 'door')) continue;
    const facing = dx * p.normal.x + dz * p.normal.z;
    if (Math.abs(facing) < 1e-3) continue;
    const t = ((p.centre.x - lamp.x) * p.normal.x + (p.centre.z - lamp.z) * p.normal.z) / facing;
    if (t <= 0 || t >= best) continue;
    // Along the wall, level: is the crossing on it?
    const hx = lamp.x + dx * t - p.centre.x;
    const hz = lamp.z + dz * t - p.centre.z;
    const along = Math.abs(hx * p.normal.z - hz * p.normal.x);
    if (along <= p.sizeM[0] / 2 + EDGE_M) best = t;
  }
  if (head) {
    // Passing over you: it stops short of your eyes, easing in and out as it swings by.
    const ahead = (head.x - lamp.x) * dx + (head.z - lamp.z) * dz;
    const aside = Math.abs((head.x - lamp.x) * dz - (head.z - lamp.z) * dx);
    if (ahead > 0 && ahead < best && aside < HEAD_FAR_M) {
      const short = Math.max(MIN_REACH_M, ahead - HEAD_CLEAR_M);
      const k = Math.min(1, Math.max(0, (aside - HEAD_NEAR_M) / (HEAD_FAR_M - HEAD_NEAR_M)));
      best = short + (best - short) * k * k * (3 - 2 * k);
    }
  }
  return Math.max(MIN_REACH_M, best);
}
