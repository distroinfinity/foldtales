import type { Beat, StageAction } from '@tabletop/contracts';

/**
 * The AI Storyteller's stage manners (owner, live test on prod 00dc376: "they do random movement
 * left and right… the two painted elements are floating in the air and mixed with the lighthouse").
 * The story is written live, so its stage directions are kept to what reads well on a pop-up page:
 *
 * - The cast keeps its marks. A walk "over to someone" is a turn toward them instead (it was a
 *   4.5 cm side-step that read as drifting, and stood characters inside one another). A walk to a
 *   mark happens only when that mark is clear of everyone else and right for the walker: feet stay
 *   on the floor, and wings stay in the air.
 * - Things placed on the page land on the floor in front of the cast, at a free spot, never at a
 *   mark meant for a character, on a railing, or inside the set.
 *
 * Chapters never come through here: they keep their authored blocking.
 */

export type V3 = [number, number, number];

/** Two characters closer than this, side to side, stand in each other. */
export const CAST_SPACING_M = 0.06;
/** Above this, a mark is in the air (a flyer's), not on the floor. */
const AIR_M = 0.03;
/** Things placed on the page: the floor's front strip, nearest the middle first. */
const FRONT_Z = 0.06;
const FRONT_X = [0.035, -0.045, 0.11, -0.12, 0.17, -0.18] as const;
/** Two things on the page closer than this overlap. */
const THING_SPACING_M = 0.055;

const flying = (p: V3) => p[1] > AIR_M;

/**
 * A live beat with its walks kept to the cast's marks, as it starts. `at` holds where everyone
 * stands now, and is updated with the walks and placings that are kept.
 */
export function steadyBeat(beat: Beat, at: Map<string, V3>, markAt: (markId: string) => V3 | null): Beat {
  let changed = false;
  const actions = beat.actions.map((a): StageAction => {
    const walk = a.do === 'move' ? { who: a.who, mark: a.to.startsWith('mark:') ? a.to.slice(5) : null } : a.do === 'place' && a.what.startsWith('cast:') ? { who: a.what.slice(5), mark: a.at } : null;
    if (!walk) return a;
    const to = walk.mark ? markAt(walk.mark) : null;
    const from = at.get(walk.who);
    const clear = !!to && [...at].every(([id, p]) => id === walk.who || Math.abs(p[0] - to[0]) >= CAST_SPACING_M);
    // A placing of someone not yet on the page stands them there, if it's clear.
    if (to && clear && (!from || flying(from) === flying(to))) {
      at.set(walk.who, to);
      return a;
    }
    changed = true;
    const target = a.do === 'move' && !a.to.startsWith('mark:') ? a.to : null;
    return { do: 'emote', withPrev: a.withPrev, who: walk.who, acting: target ? 'turn' : 'idle', target };
  });
  return changed ? { ...beat, actions } : beat;
}

/** Where a thing put on the page lands: the floor's front strip, clear of the cast and of the other things. */
export function frontSpot(things: readonly V3[], cast: readonly V3[]): V3 {
  const clearOf = (x: number) => things.every((t) => Math.hypot(t[0] - x, t[2] - FRONT_Z) >= THING_SPACING_M) && cast.every((c) => flying(c) || Math.abs(c[0] - x) >= CAST_SPACING_M * 0.5);
  const x = FRONT_X.find(clearOf) ?? FRONT_X.find((x) => things.every((t) => Math.hypot(t[0] - x, t[2] - FRONT_Z) >= THING_SPACING_M)) ?? FRONT_X[0];
  return [x, 0, FRONT_Z];
}
