import type { Vec3 } from './surface.ts';

export interface Vec2 {
  x: number;
  z: number;
}

/** The open book at reference size, and the reach rule: everything within 0.6 m, seated. */
const OPEN_W = 0.42;
const OPEN_D = 0.315;
const REACH_M = 0.6;
const SCALES = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7];
const MIN_SCALE = 0.7;

/** The open book's four corners on the table, turned to face the reader, at a scale. */
export function footprint(spot: Vec3, head: Vec3, scale: number): Vec2[] {
  const yaw = Math.atan2(head.x - spot.x, head.z - spot.z);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const hw = (OPEN_W * scale) / 2;
  const hd = (OPEN_D * scale) / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => ({ x: spot.x + x! * cos + z! * sin, z: spot.z - x! * sin + z! * cos }));
}

function inside(point: Vec2, polygon: Vec2[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.z > point.z !== b.z > point.z && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x) hit = !hit;
  }
  return hit;
}

export interface SizingInput {
  head: Vec3;
  spot: Vec3;
  /** The table's outline from a scanned plane, flattened to the floor plan. Null without one. */
  plane: Vec2[] | null;
}

/**
 * Tray to desk: the largest book whose whole open footprint is within reach, and on the
 * table when its outline is known. If even the smallest won't fit, the smallest opens and you
 * can slide it by the spine.
 */
export function chooseScale({ head, spot, plane }: SizingInput): { scale: number; fits: boolean } {
  const tolerance = 1e-6;
  for (const scale of SCALES) {
    const corners = footprint(spot, head, scale);
    const reachable = corners.every((c) => Math.hypot(c.x - head.x, c.z - head.z) <= REACH_M + tolerance);
    // On the plane, with a hair of slack for the outline's own precision.
    const onTable = !plane || corners.every((c) => inside(c, plane) || plane.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < 1e-6));
    if (reachable && onTable) return { scale, fits: true };
  }
  return { scale: MIN_SCALE, fits: false };
}

export interface Table {
  /** The scanned top's height. */
  y: number;
  /** Its outline, flattened to the floor plan. */
  outline: Vec2[];
}

/** A hit within this of a table's height, and this near its outline, means that table. */
const TABLE_HEIGHT_M = 0.05;
const TABLE_NEAR_M = 0.35;
const STEP_M = 0.01;

function distanceToOutline(point: Vec2, outline: Vec2[]): number {
  if (inside(point, outline)) return 0;
  let best = Infinity;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[j]!;
    const b = outline[i]!;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.z - a.z) * abz) / (abx * abx + abz * abz || 1)));
    best = Math.min(best, Math.hypot(point.x - (a.x + abx * t), point.z - (a.z + abz * t)));
  }
  return best;
}

export interface Settled {
  spot: Vec3;
  scale: number;
  fits: boolean;
  /** The scanned table the book now rests on, or null if none was near. */
  table: Table | null;
}

/**
 * The hit test can catch a table's rim or a lump in the room mesh, and leave half the book over the
 * floor. When a scanned table is right there, the book rests on its top instead: at its height, slid
 * in only as far as the whole open book needs, at the largest size that fits and stays in reach.
 */
export function settleOnTable({ head, spot, tables, userScale }: { head: Vec3; spot: Vec3; tables: Table[]; userScale: number | null }): Settled {
  let table: Table | null = null;
  let nearest = Infinity;
  for (const candidate of tables) {
    if (Math.abs(candidate.y - spot.y) > TABLE_HEIGHT_M) continue;
    const d = distanceToOutline(spot, candidate.outline);
    if (d <= TABLE_NEAR_M && d < nearest) {
      table = candidate;
      nearest = d;
    }
  }
  if (!table) {
    const chosen = chooseScale({ head, spot, plane: null });
    return { spot, scale: userScale ?? chosen.scale, fits: chosen.fits, table: null };
  }
  const { outline, y } = table;
  const centre = outline.reduce((c, p) => ({ x: c.x + p.x / outline.length, z: c.z + p.z / outline.length }), { x: 0, z: 0 });
  const span = Math.hypot(centre.x - spot.x, centre.z - spot.z);
  const dir = span > 0 ? { x: (centre.x - spot.x) / span, z: (centre.z - spot.z) / span } : { x: 0, z: 0 };
  const along = (d: number): Vec3 => ({ x: spot.x + dir.x * d, y, z: spot.z + dir.z * d });
  const onTop = (at: Vec3, scale: number): boolean => footprint(at, head, scale).every((c) => inside(c, outline) || distanceToOutline(c, outline) < 1e-6);
  const inReach = (at: Vec3, scale: number): boolean => footprint(at, head, scale).every((c) => Math.hypot(c.x - head.x, c.z - head.z) <= REACH_M + 1e-6);
  const scales = userScale ? [userScale] : SCALES;
  for (const scale of scales) {
    for (let d = 0; d <= span + 1e-9; d += STEP_M) {
      const at = along(d);
      if (onTop(at, scale) && inReach(at, scale)) return { spot: at, scale, fits: true, table };
    }
  }
  // Nothing both fits and stays in reach: the largest book that fits on the top, as near you as it
  // goes. You lean in, or stretch it smaller, rather than squint at a small one.
  for (const scale of scales) {
    for (let d = 0; d <= span + 1e-9; d += STEP_M) {
      const at = along(d);
      if (onTop(at, scale)) return { spot: at, scale, fits: false, table };
    }
  }
  return { spot: along(span), scale: userScale ?? MIN_SCALE, fits: false, table };
}

/** A printed line's size in the book's own units, so it stays at least 1° tall at its real distance. */
export function minTextSizeM(authoredM: number, scale: number, eyeDistanceM: number): number {
  const needed = (eyeDistanceM * Math.tan(Math.PI / 180)) / scale;
  return Math.max(authoredM, needed);
}
