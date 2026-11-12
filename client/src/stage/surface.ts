export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Hit {
  position: Vec3;
  /** The Y of the surface's normal: 1 is facing straight up. */
  normalY: number;
}

const MIN_NORMAL_Y = 0.9;
const REACH_M = 0.6;
const MIN_TABLE_Y = 0.35;
const BELOW_EYES_M = 0.1;
const MIN_EYE_DISTANCE_M = 0.5;
const GROUP_HEIGHT_M = 0.03;
const GROUP_REACH_M = 0.2;
const MIN_GROUP = 3;
const FALLBACK_AHEAD_M = 0.55;
const FALLBACK_BELOW_M = 0.4;

const horizontal = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

function usable(p: Vec3, head: Vec3): boolean {
  return (
    horizontal(p, head) <= REACH_M &&
    p.y > MIN_TABLE_Y &&
    p.y < head.y - BELOW_EYES_M &&
    Math.hypot(p.x - head.x, p.y - head.y, p.z - head.z) >= MIN_EYE_DISTANCE_M
  );
}

/** Hits joined through neighbours, so two patches at one height stay two surfaces. */
function connectedGroups(points: Vec3[]): Vec3[][] {
  const unseen = new Set(points);
  const groups: Vec3[][] = [];
  for (const start of points) {
    if (!unseen.delete(start)) continue;
    const group = [start];
    for (let i = 0; i < group.length; i++) {
      const from = group[i]!;
      for (const other of unseen) {
        if (Math.abs(other.y - from.y) <= GROUP_HEIGHT_M && horizontal(other, from) <= GROUP_REACH_M) {
          unseen.delete(other);
          group.push(other);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length;

/** The point on the highest reachable surface that was actually hit nearest that surface's middle. */
export function pickSurface(hits: Hit[], head: Vec3): Vec3 | null {
  const points = hits.filter((hit) => hit.normalY >= MIN_NORMAL_Y && usable(hit.position, head)).map((hit) => hit.position);
  const groups = connectedGroups(points).filter((group) => group.length >= MIN_GROUP);
  if (groups.length === 0) return null;
  const highest = groups.reduce((best, group) => (mean(group.map((p) => p.y)) > mean(best.map((p) => p.y)) ? group : best));
  const middle = { x: mean(highest.map((p) => p.x)), y: 0, z: mean(highest.map((p) => p.z)) };
  return highest.reduce((best, p) => (horizontal(p, middle) < horizontal(best, middle) ? p : best));
}

/** Which way you're facing, flat. Looking straight down, the top of your head points the way your face does. */
export function horizontalForward(forward: Vec3, up: Vec3): Vec3 {
  const source = Math.hypot(forward.x, forward.z) >= 0.2 ? forward : up;
  const length = Math.hypot(source.x, source.z) || 1;
  return { x: source.x / length, y: 0, z: source.z / length };
}

export function fallbackSpot(head: Vec3, forward: Vec3): Vec3 {
  const flat = horizontalForward(forward, forward);
  return { x: head.x + flat.x * FALLBACK_AHEAD_M, y: head.y - FALLBACK_BELOW_M, z: head.z + flat.z * FALLBACK_AHEAD_M };
}

/**
 * Hit-test directions in viewer space (z forward is -1): two rows, about 42° and 51° below your gaze.
 * Seated at a desk and looking straight ahead, both rows land within reach, so the table counts without
 * having to look down at it.
 */
export function placementRays(): Vec3[] {
  const near = [-0.15, -0.09, -0.03, 0.03, 0.09, 0.15].map((x) => ({ x, y: -1.25, z: -1 }));
  const far = [-0.3, -0.18, -0.06, 0.06, 0.18, 0.3].map((x) => ({ x, y: -0.9, z: -1 }));
  return [...near, ...far];
}
