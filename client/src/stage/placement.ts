import { fallbackSpot, pickSurface, type Hit, type Vec3 } from './surface.ts';

export interface PlacementInput {
  head: Vec3 | null;
  /** Already flattened with `horizontalForward`. */
  forward: Vec3 | null;
  hits: Hit[];
}

export interface PlacementDecision {
  state: 'searching' | 'fallback' | 'placed';
  moveTo: Vec3 | null;
  surface: 'hit_test' | 'fallback' | null;
}

const DEADLINE_MS = 5000;
const HOLD_MS = 500;
const HOLD_HEIGHT_M = 0.02;
const HOLD_REACH_M = 0.1;

/** One placement per session. The deadline is fixed from the first step, so unsteady hits can't postpone it. */
export function createPlacement(): { step(nowMs: number, input: PlacementInput): PlacementDecision } {
  let startedMs: number | null = null;
  let state: PlacementDecision['state'] = 'searching';
  let holding: { point: Vec3; sinceMs: number } | null = null;

  const stay = (): PlacementDecision => ({ state, moveTo: null, surface: null });

  return {
    step(nowMs, { head, forward, hits }) {
      if (state === 'placed') return stay();
      startedMs ??= nowMs;

      const surface = head ? pickSurface(hits, head) : null;
      if (!surface) {
        holding = null;
      } else if (
        !holding ||
        Math.abs(surface.y - holding.point.y) > HOLD_HEIGHT_M ||
        Math.hypot(surface.x - holding.point.x, surface.z - holding.point.z) > HOLD_REACH_M
      ) {
        holding = { point: surface, sinceMs: nowMs };
      }

      if (surface && holding && nowMs - holding.sinceMs >= HOLD_MS) {
        state = 'placed';
        return { state, moveTo: surface, surface: 'hit_test' };
      }
      if (state === 'searching' && nowMs - startedMs >= DEADLINE_MS && head && forward) {
        state = 'fallback';
        return { state, moveTo: fallbackSpot(head, forward), surface: 'fallback' };
      }
      return stay();
    },
  };
}
