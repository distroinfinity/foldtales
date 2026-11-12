import { describe, expect, test } from 'vitest';
import { createSuspender } from '../client/src/sound/suspender.ts';

/** An AudioContext whose state only changes when its promise settles, as the real one does. */
function lagging() {
  const calls: string[] = [];
  let state: 'running' | 'suspended' = 'running';
  const pending: Array<() => void> = [];
  return {
    calls,
    get state() { return state; },
    suspend: () => { calls.push('suspend'); return new Promise<void>((r) => pending.push(() => { state = 'suspended'; r(); })); },
    resume: () => { calls.push('resume'); return new Promise<void>((r) => pending.push(() => { state = 'running'; r(); })); },
    settle: () => { while (pending.length) pending.shift()!(); },
  };
}

describe('pausing the show bus', () => {
  test('a pause and an unpause within one frame still end running', () => {
    const ctx = lagging();
    const bus = createSuspender(ctx);
    bus.set(false);
    bus.set(true);
    ctx.settle();
    expect(ctx.calls).toEqual(['suspend', 'resume']);
    expect(ctx.state).toBe('running');
  });

  test('asking for the same state twice sends nothing new', () => {
    const ctx = lagging();
    const bus = createSuspender(ctx);
    bus.set(false);
    bus.set(false);
    expect(ctx.calls).toEqual(['suspend']);
  });

  test('a context that throws never reaches the show', () => {
    const bus = createSuspender({ suspend: () => Promise.reject(new Error('closed')), resume: () => Promise.reject(new Error('closed')) });
    expect(() => bus.set(false)).not.toThrow();
  });
});
