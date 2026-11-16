import { describe, expect, it } from 'vitest';
import { createSelectGate, dispatchUntilChanged } from '../client/src/stage/select-gate.ts';

const now = (over: Partial<{ cardShowing: boolean; generation: number; grabbedNear: boolean }> = {}) => ({ cardShowing: true, generation: 3, grabbedNear: false, ...over });

describe('what a look-and-pinch may choose', () => {
  it('takes what it was on when the pinch started, even if the gaze moves before release', () => {
    const g = createSelectGate();
    g.start('right', { id: 'again', generation: 3 });
    // (looking at Put the book away by now)
    expect(g.select('right', now())).toEqual({ kind: 'card', choice: { id: 'again', generation: 3 } });
  });

  it('chooses nothing if the card changed since the pinch started (ribbon too)', () => {
    const g = createSelectGate();
    g.start('gaze', { id: 'contents', generation: 2 });
    expect(g.select('gaze', now())).toEqual({ kind: 'none' });
    g.start('gaze', { id: 'ribbon', generation: 2 });
    expect(g.select('gaze', now())).toEqual({ kind: 'none' });
    g.start('gaze', { id: 'ribbon', generation: 3 });
    expect(g.select('gaze', now())).toEqual({ kind: 'ribbon' });
  });

  it('never reaches the story behind a standing card (review PR #26, finding 3)', () => {
    const g = createSelectGate();
    g.start('left', null);
    expect(g.select('left', now({ cardShowing: true }))).toEqual({ kind: 'none' });
    g.start('left', null);
    expect(g.select('left', now({ cardShowing: false }))).toEqual({ kind: 'story' });
  });

  it('a pinch held across a card opening chooses nothing until it is let go', () => {
    const g = createSelectGate();
    g.start('right', { id: 'carry-on', generation: 3 });
    g.cancelAll();
    // Released without the story behind it answering, and without the old choice.
    expect(g.select('right', now({ cardShowing: false }))).toEqual({ kind: 'none' });
    g.end('right');
    g.start('right', null);
    expect(g.select('right', now({ cardShowing: false }))).toEqual({ kind: 'story' });
  });

  it('a hand that grabbed something within reach chose that, not what it looked at', () => {
    const g = createSelectGate();
    g.start('left', { id: 'put-away', generation: 3 });
    expect(g.select('left', now({ grabbedNear: true }))).toEqual({ kind: 'none' });
  });

  it('a frame’s other events are dropped once one of them cancels (review PR #26, finding 2)', () => {
    let generation = 0;
    const handled: string[] = [];
    // Left releases the ribbon (the menu opens and cancels everything); right's queued drag must not re-take the character.
    dispatchUntilChanged(['left:release:ribbon', 'right:drag:cast'], () => generation, (e) => {
      handled.push(e);
      if (e === 'left:release:ribbon') generation++;
    });
    expect(handled).toEqual(['left:release:ribbon']);
  });
});
