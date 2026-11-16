/**
 * The treasure hunt, over its own time: the lamp's beam swells, sweeps the room once and a quarter,
 * slows, and stops on the place where the lost thing waits. A soft pool of light opens there and the
 * thing appears in it. Pure, so a resume lands in the same moment.
 */

import { Vector3 } from '@iwsdk/core';
import { distanceToOutline, insideOutline, type Place, type RoomMap } from './room-map.ts';

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

/**
 * Where the hunt hides the lost thing (PR #45 review): somewhere you'd look, in front of you toward
 * the book where the story sends you, never behind you, on the book's own table, or on the seat or bed you're
 * on. The story's `room:` place (the couch) or the next kind down, if one qualifies; else the floor
 * ahead of you and to your right, where room-map's stand-in floor goes.
 */
/** At least this far ahead of you, toward the book, and no more than this far off that line. */
const AHEAD_MIN_M = 0.3;
const AHEAD_MAX_COS = Math.cos((70 * Math.PI) / 180);
/** A top this close to where you are (or under you) is the one you're sitting on or standing at. */
const OCCUPIED_M = 0.35;
const FALLBACK_AHEAD_M = 0.9;
const FALLBACK_SIDE_M = 0.7;

/** Flat, from you toward the book (straight ahead, −Z, when the two are on top of each other). */
function towardBook(head: Vector3, book: Vector3): Vector3 {
  const toward = new Vector3(book.x - head.x, 0, book.z - head.z);
  if (toward.lengthSq() < 1e-4) toward.set(0, 0, -1);
  return toward.normalize();
}

/** Whether a resting place is a fair hiding place: ahead of you, free, not the book's table. */
export function huntSpotOk(p: Place, head: Vector3, book: Vector3): boolean {
  if (!p.horizontal || p.label === 'floor' || p.label === 'ceiling') return false;
  const outlined = p.outline.length >= 3;
  if (outlined && insideOutline(book.x, book.z, p.outline)) return false;
  const near = outlined ? distanceToOutline(head.x, head.z, p.outline) : Math.hypot(p.centre.x - head.x, p.centre.z - head.z);
  if (near < OCCUPIED_M) return false;
  const toward = towardBook(head, book);
  const dx = p.centre.x - head.x;
  const dz = p.centre.z - head.z;
  const along = dx * toward.x + dz * toward.z;
  return along >= AHEAD_MIN_M && along >= AHEAD_MAX_COS * Math.hypot(dx, dz);
}

export function huntPlace(room: Pick<RoomMap, 'resolve' | 'below' | 'floorY'>, ref: string | null, head: Vector3, book: Vector3): { place: Place; offset: [number, number] } | null {
  const ok = (p: Place) => huntSpotOk(p, head, book);
  const place = room.resolve(ref, 'rest', undefined, ok);
  if (place && ok(place)) return { place, offset: [0, 0] };
  const toward = towardBook(head, book);
  const spot = new Vector3(head.x, room.floorY() + 0.02, head.z).addScaledVector(toward, FALLBACK_AHEAD_M).addScaledVector(new Vector3(-toward.z, 0, toward.x), FALLBACK_SIDE_M);
  const floor = room.below(spot);
  return floor ? { place: floor, offset: [spot.x - floor.centre.x, spot.z - floor.centre.z] } : null;
}
