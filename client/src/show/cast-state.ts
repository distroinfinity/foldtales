import { MOVE_MS } from '@tabletop/contracts';
import type { Timed } from './schedule.ts';

export type V3 = [number, number, number];

export interface CastPlace {
  /** Where the character stands now, in stage metres (on the page, y up). */
  at: V3;
  /** Show time it appeared on this spread, for its pop-up. */
  since: number;
  /** Walking from one mark to another: 0 to 1, or null when standing. */
  walk: { progress: number; from: V3; to: V3 } | null;
  /** A crossing cue carrying it, with its kind and progress. */
  crossing: { kind: string; progress: number; from: V3; to: V3; localMs: number } | null;
}

export interface CastStateInput {
  timeline: Timed[];
  ms: number;
  /** Only actions from this time on belong to the spread showing now. */
  sceneStartMs: number;
  /** Who stands where before anything moves them on this spread. */
  initial: Map<string, V3>;
  mark(id: string): V3 | null;
  /** What each crossing cue does: its kind, and the mark it ends at. */
  crossing(cueId: string): { kind: string; to: string; who: string; durationMs: number } | null;
}

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Who is on the spread and where, as a pure function of the timeline and the clock. `place`
 * stands a character on a mark, `move` walks it there over MOVE_MS, and a crossing cue carries
 * one over the gap to the cue's mark. A new spread starts from its own placements.
 */
export function castAt({ timeline, ms, sceneStartMs, initial, mark, crossing }: CastStateInput): Map<string, CastPlace> {
  const places = new Map<string, CastPlace>();
  for (const [id, at] of initial) places.set(id, { at, since: sceneStartMs > 0 ? sceneStartMs : -Infinity, walk: null, crossing: null });
  const resolve = (target: string, who: string): V3 | null => {
    if (target.startsWith('mark:')) return mark(target.slice(5));
    if (target.startsWith('cast:')) {
      const other = places.get(target.slice(5));
      if (!other) return null;
      const self = places.get(who)?.at ?? other.at;
      const side = self[0] >= other.at[0] ? 1 : -1;
      return [other.at[0] + side * 0.045, other.at[1], other.at[2]];
    }
    return null;
  };

  for (const item of timeline) {
    if (item.startMs < sceneStartMs || item.startMs > ms) continue;
    const a = item.action;
    if (a.do === 'place' && a.what.startsWith('cast:')) {
      const who = a.what.slice(5);
      const at = mark(a.at);
      if (at) places.set(who, { at, since: item.startMs, walk: null, crossing: null });
    } else if (a.do === 'move') {
      const place = places.get(a.who);
      const to = resolve(a.to, a.who);
      if (!place || !to) continue;
      const end = Math.min(item.endMs, item.startMs + MOVE_MS);
      const t = end <= item.startMs ? 1 : Math.min(1, (ms - item.startMs) / (end - item.startMs));
      const from = place.at;
      const at = lerp(from, to, ease(t));
      places.set(a.who, { ...place, at, walk: t < 1 ? { progress: t, from, to } : null, crossing: null });
    } else if (a.do === 'cue') {
      const c = crossing(a.cue);
      if (!c) continue;
      const place = places.get(c.who);
      const to = mark(c.to);
      if (!place || !to) continue;
      const local = ms - item.startMs;
      const t = Math.min(1, local / Math.max(1, c.durationMs));
      const from = place.crossing?.from ?? place.at;
      places.set(c.who, { ...place, at: t < 1 ? place.at : to, walk: null, crossing: t < 1 ? { kind: c.kind, progress: t, from, to, localMs: local } : null });
    }
  }
  return places;
}
