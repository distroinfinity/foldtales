import type { ObjectDef, SceneProblem } from '@tabletop/contracts';
import type { ObjectState } from './objects.ts';

/**
 * The first-time hand-over cue. When a character asks for something, every thing that answers the
 * ask (each one the story has a scene for, right or funny) gets the same soft lamp-gold rim, so a
 * reader who missed the line still sees "hand one of these over", and never which one is "right".
 * It is strongest for a new reader and settles to a quiet hint once they've handed a few things over.
 */

const KEY = 'foldtales.handovers';
/** The rim never goes below this, however practised the reader: a hint, never gone. */
const SUBTLE = 0.4;
const STEP = 0.15;

/** How many things this reader has handed to a character, on this device. Never throws. */
export function readHandovers(store: Pick<Storage, 'getItem'> | null | undefined): number {
  try {
    const n = Number(store?.getItem(KEY) ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** One more thing handed over. Returns the new count. Never throws (storage may be blocked). */
export function noteHandover(store: Pick<Storage, 'getItem' | 'setItem'> | null | undefined): number {
  const n = readHandovers(store) + 1;
  try {
    store?.setItem(KEY, String(n));
  } catch {
    // Private window or blocked storage: the cue just stays strong.
  }
  return n;
}

/** The rim's strength for a reader who has handed `count` things over: 1 for a first-timer, settling to SUBTLE. */
export const cueStrength = (count: number): number => Math.max(SUBTLE, 1 - STEP * count);

/** Every tag the ask has a scene for: all its rules, solved and partial alike, so none is singled out. */
export const answerTags = (problem: Pick<SceneProblem, 'rules'>): Set<string> => new Set(problem.rules.flatMap((r) => r.anyTags));

/** Does this thing answer the ask? */
export const answers = (def: Pick<ObjectDef, 'tags'> | undefined, tags: ReadonlySet<string>): boolean => !!def && def.tags.some((t) => tags.has(t));

/**
 * Does this thing wear the ask's rim now? It must answer the ask, be within reach (an open drawer, an
 * open satchel, the page, the table or the room) and not already tried for this ask. Something carried
 * here from an earlier spread (a kite kept in the satchel) still counts: only this ask's tries rule it out.
 */
export function cued(
  o: Pick<ObjectState, 'id' | 'home' | 'grabbable'>,
  def: Pick<ObjectDef, 'tags'> | undefined,
  ask: { tags: ReadonlySet<string>; tried: readonly string[] },
  open: { drawer: boolean; satchel: boolean },
): boolean {
  const reachable = o.home.kind === 'drawer' ? open.drawer : o.home.kind === 'satchel' ? open.satchel : o.home.kind === 'page' || o.home.kind === 'table' || o.home.kind === 'room';
  return reachable && o.grabbable && !ask.tried.includes(o.id) && answers(def, ask.tags);
}

/** The browser's storage, or null where there is none (tests, workers, blocked). */
export const deviceStore = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
