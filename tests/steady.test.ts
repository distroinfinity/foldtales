import type { Beat, StageAction } from '../contracts/src/index.ts';
import { describe, expect, it } from 'vitest';
import { CAST_SPACING_M, frontSpot, steadyBeat, type V3 } from '../client/src/storyteller/steady.ts';
import { createLiveScheduler } from '../client/src/storyteller/live.ts';

// The lamp's marks (client/public/show/manifest.json).
const LAMP: Record<string, V3> = { pip: [0.07, 0, -0.0175], wick: [-0.03, 0, -0.022], lamp: [-0.093, 0.07, -0.0925], 'moth-lamp': [-0.093, 0.175, -0.085], thimble: [0.11, 0, -0.01], stair: [-0.093, 0, -0.125], 'edge-step': [0.045, 0, 0.072] };
const markAt = (m: string) => LAMP[m] ?? null;
const beat = (...actions: StageAction[]): Beat => ({ id: 'b', source: 'director', sceneId: null, estSeconds: 3, actions, next: null, replaces: null });
const standing = () => new Map<string, V3>([['pip', LAMP.pip!], ['wick', LAMP.wick!], ['moth', LAMP.lamp!]]);

describe('the Storyteller keeps its cast on clear marks (owner, live test on prod 00dc376)', () => {
  it('a walk over to someone is a turn toward them: no side-step, no standing inside them', () => {
    const at = standing();
    const out = steadyBeat(beat({ do: 'move', withPrev: false, who: 'pip', to: 'cast:wick' }), at, markAt);
    expect(out.actions).toEqual([{ do: 'emote', withPrev: false, who: 'pip', acting: 'turn', target: 'cast:wick' }]);
    expect(at.get('pip')).toEqual(LAMP.pip);
  });

  it('feet stay on the floor: Wick is never walked up onto the lamp', () => {
    const at = standing();
    const out = steadyBeat(beat({ do: 'move', withPrev: false, who: 'wick', to: 'mark:lamp' }), at, markAt);
    expect(out.actions[0]!.do).toBe('emote');
    expect(at.get('wick')).toEqual(LAMP.wick);
  });

  it('never onto a mark someone else is standing at', () => {
    const at = standing();
    const out = steadyBeat(beat({ do: 'move', withPrev: false, who: 'wick', to: 'mark:pip' }, { do: 'place', withPrev: false, what: 'cast:moth', at: 'stair' }), at, markAt);
    expect(out.actions.map((a) => a.do)).toEqual(['emote', 'emote']);
  });

  it('a directed walk to a clear mark plays, and the next walk knows where they went', () => {
    const at = standing();
    const out = steadyBeat(beat({ do: 'move', withPrev: false, who: 'pip', to: 'mark:thimble' }, { do: 'move', withPrev: false, who: 'moth', to: 'mark:moth-lamp' }), at, markAt);
    expect(out.actions.map((a) => a.do)).toEqual(['move', 'move']);
    expect(at.get('pip')).toEqual(LAMP.thimble);
  });

  it('whatever the beats ask, nobody ends up inside anyone else', () => {
    const at = standing();
    const who = ['pip', 'wick'];
    const marks = Object.keys(LAMP);
    for (let i = 0; i < 60; i++) steadyBeat(beat({ do: 'move', withPrev: false, who: who[i % 2]!, to: `mark:${marks[(i * 7) % marks.length]}` }), at, markAt);
    const ps = [...at.values()];
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) expect(Math.abs(ps[i]![0] - ps[j]![0])).toBeGreaterThanOrEqual(CAST_SPACING_M);
  });

  it('the live scheduler steadies each beat as it starts', () => {
    const live = createLiveScheduler({ durationOf: () => 500, firstSet: 'the-lamp', entrances: () => [], markAt: (_s, m) => markAt(m), initial: standing });
    live.enqueue(beat({ do: 'move', withPrev: false, who: 'pip', to: 'cast:wick' }));
    live.tick(10_000, false);
    expect(live.beat('b').actions[0]!.do).toBe('emote');
  });
});

describe("the Storyteller's things land on the floor in front, at a free spot", () => {
  const cast = [LAMP.pip!, LAMP.wick!, LAMP.lamp!];
  it('in front of the cast, on the floor', () => {
    const [, y, z] = frontSpot([], cast);
    expect(y).toBe(0);
    expect(z).toBeGreaterThan(0.04);
  });
  it('two paintings never land on each other', () => {
    const a = frontSpot([], cast);
    const b = frontSpot([a], cast);
    const c = frontSpot([a, b], cast);
    expect(Math.abs(a[0] - b[0])).toBeGreaterThan(0.05);
    expect(new Set([a[0], b[0], c[0]]).size).toBe(3);
  });
});
