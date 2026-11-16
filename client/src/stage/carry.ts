import type { ObjectState } from '../objects/objects.ts';

/**
 * What the chapter before kept, put in the satchel as this chapter starts. Things the stage already
 * holds (every library prop is on it, often away or hidden) move into the satchel, visible and
 * grabbable; only ids the stage doesn't have yet are returned, to be added.
 */
export function carryIntoSatchel(states: readonly ObjectState[], carried: readonly string[]): { states: ObjectState[]; reveal: string[]; missing: string[] } {
  const wanted = new Set(carried);
  const reveal: string[] = [];
  const next = states.map((s) => {
    if (!wanted.has(s.id)) return s;
    reveal.push(s.id);
    return { ...s, home: { kind: 'satchel' as const }, grabbable: true };
  });
  const have = new Set(states.map((s) => s.id));
  return { states: next, reveal, missing: carried.filter((id) => !have.has(id)) };
}
