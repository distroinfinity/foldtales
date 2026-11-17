import type { Vector3 } from '@iwsdk/core';
import type { Place } from '../room-fx/room-map.ts';

/** How far the lamp's ray runs with no wall in the way: the room dim's sphere, where its light lands. */
export const BEAM_REACH_M = 3;
/** Never shorter than this, so a wall right by the book still shows a ray leaving the lamp. */
const MIN_REACH_M = 0.5;
/** A little past a wall's edge still counts, so the ray doesn't overshoot at a corner. */
const EDGE_M = 0.3;

/**
 * Where the lamp's turning ray meets your room: the nearest real wall, window or door it crosses (level,
 * from the lamp, along `azimuth`: 0 toward +z, as the room dim reads it), else `BEAM_REACH_M`. Over
 * passthrough nothing hides a ray that runs on through a wall, so it stops there.
 */
export function beamReach(lamp: Vector3, azimuth: number, places: readonly Place[]): number {
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
  return Math.max(MIN_REACH_M, best);
}
