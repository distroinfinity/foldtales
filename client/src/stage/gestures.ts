import type { Vec3 } from './surface.ts';

export interface HandFrame {
  tracked: boolean;
  /** Between the thumb and index tips. */
  pinchPoint: Vec3;
  /** Distance between the thumb and index tips. */
  pinchGapM: number;
}

export interface Proxy {
  id: string;
  position: Vec3;
  /** At least 32 mm, so every target is 64 mm across. */
  radiusM: number;
  /** An edge you can pinch anywhere along, from a to b. `position` is then unused. */
  segment?: { a: Vec3; b: Vec3 };
  /**
   * How far straight up the target reaches. Fingertips stop on the real table, so a pinch at a page
   * lying on it lands a few centimetres above: anywhere in that column counts as on the target.
   */
  reachUpM?: number;
}

export type HandSide = 'left' | 'right';

export type GestureEvent =
  | { kind: 'near' | 'grab' | 'release' | 'cancel'; id: string; hand: HandSide }
  | { kind: 'drag'; id: string; hand: HandSide; point: Vec3 };

/** Closes under 15 mm, opens over 30 mm, so a held pinch doesn't flicker. */
const PINCH_ON_M = 0.015;
const PINCH_OFF_M = 0.03;
const MIN_RADIUS_M = 0.032;


/** The nearest point of a proxy to a hand: its centre, or the closest point along its edge. */
export function closestOn(proxy: Proxy, point: Vec3): Vec3 {
  if (!proxy.segment) return proxy.position;
  const { a, b } = proxy.segment;
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const len2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z || 1;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * ab.x + (point.y - a.y) * ab.y + (point.z - a.z) * ab.z) / len2));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
}

/** How far a hand is from a proxy, counting the column above it as touching. */
function reach(proxy: Proxy, point: Vec3): number {
  const c = closestOn(proxy, point);
  const up = point.y - c.y;
  const dy = up > 0 ? Math.max(0, up - (proxy.reachUpM ?? 0)) : up;
  return Math.hypot(point.x - c.x, dy, point.z - c.z);
}

/** Pinch-to-grab on the book's controls. One hand owns a control until it lets go or loses tracking. */
export function createGestures() {
  const pinched: Record<HandSide, boolean> = { left: false, right: false };
  const holding: Record<HandSide, string | null> = { left: null, right: null };

  function nearest(point: Vec3, proxies: Proxy[], other: string | null): Proxy | null {
    let best: Proxy | null = null;
    let bestD = Infinity;
    for (const proxy of proxies) {
      if (proxy.id === other) continue;
      const d = reach(proxy, point);
      if (d <= Math.max(MIN_RADIUS_M, proxy.radiusM) && d < bestD) {
        best = proxy;
        bestD = d;
      }
    }
    return best;
  }

  return {
    held: (side: HandSide): string | null => holding[side],
    step(hands: Record<HandSide, HandFrame | null>, proxies: Proxy[]): GestureEvent[] {
      const events: GestureEvent[] = [];
      for (const side of ['left', 'right'] as const) {
        const handFrame = hands[side];
        const other = holding[side === 'left' ? 'right' : 'left'];
        if (!handFrame || !handFrame.tracked) {
          if (holding[side]) events.push({ kind: 'cancel', id: holding[side]!, hand: side });
          holding[side] = null;
          pinched[side] = false;
          continue;
        }
        const was = pinched[side];
        const now = was ? handFrame.pinchGapM < PINCH_OFF_M : handFrame.pinchGapM < PINCH_ON_M;
        pinched[side] = now;
        const held = holding[side];
        if (held) {
          if (now) events.push({ kind: 'drag', id: held, hand: side, point: handFrame.pinchPoint });
          else {
            events.push({ kind: 'release', id: held, hand: side });
            holding[side] = null;
          }
          continue;
        }
        const target = nearest(handFrame.pinchPoint, proxies, other);
        if (!target) continue;
        if (now && !was) {
          holding[side] = target.id;
          events.push({ kind: 'grab', id: target.id, hand: side });
        } else if (!now) {
          events.push({ kind: 'near', id: target.id, hand: side });
        }
      }
      return events;
    },
  };
}
