import { describe, expect, test } from 'vitest';
import { combineUnfold, controlFold, dragCover } from '../client/src/stage/book-control.ts';
import { createGestures, type HandFrame } from '../client/src/stage/gestures.ts';
import { resizeScale, RESIZE_MIN, RESIZE_MAX } from '../client/src/stage/resize.ts';
import { createPauseControl } from '../client/src/show/pause.ts';
import { createShowClock } from '../client/src/show/clock.ts';
import { CHECKPOINT_VERSION, readCheckpoint, writeCheckpoint, type Checkpoint } from '../client/src/show/checkpoint.ts';
import { createSessionFlow } from '../client/src/stage/session-flow.ts';

describe('opening and closing the book by hand', () => {
  test('fully open: cover flat, every card standing', () => {
    expect(controlFold(1, 5)).toEqual({ dim: 1, cover: 1, layers: [1, 1, 1, 1, 1] });
  });

  test('closing folds the cards front to back first, then the cover', () => {
    const half = controlFold(0.7, 5);
    expect(half.cover).toBe(1);
    expect(half.layers[4]!).toBeLessThan(half.layers[0]!);
    const shut = controlFold(0, 5);
    expect(shut.cover).toBe(0);
    expect(shut.layers.every((l) => l === 0)).toBe(true);
  });

  test('the show can never be more open than your hands left the book', () => {
    const show = { dim: 1, cover: 1, layers: [1.04, 1, 1, 1, 1] };
    const combined = combineUnfold(show, controlFold(0.2, 5));
    expect(combined.cover).toBeLessThan(1);
    expect(combined.layers.every((l) => l === 0)).toBe(true);
  });

  test('house lights come partly back up while the book is shut', () => {
    expect(combineUnfold({ dim: 1, cover: 1, layers: [1] }, controlFold(0, 1)).dim).toBeLessThan(0.6);
  });
});

const far = { x: 0, y: 1, z: 1 };
const hand = (x: number, y: number, z: number, pinchM: number, tracked = true): HandFrame => ({ tracked, pinchPoint: { x, y, z }, pinchGapM: pinchM });
const proxies = [{ id: 'cover', position: { x: 0, y: 0, z: 0 }, radiusM: 0.032 }];

describe('pinch gestures on the book', () => {
  test('a pinch near a control grabs it, and releasing lets it go', () => {
    const g = createGestures();
    expect(g.step({ left: null, right: hand(0.01, 0, 0, 0.05) }, proxies)).toContainEqual({ kind: 'near', id: 'cover', hand: 'right' });
    expect(g.step({ left: null, right: hand(0.01, 0, 0, 0.008) }, proxies)).toContainEqual({ kind: 'grab', id: 'cover', hand: 'right' });
    expect(g.step({ left: null, right: hand(0.05, 0.02, 0, 0.012) }, proxies)).toContainEqual(expect.objectContaining({ kind: 'drag', id: 'cover' }));
    expect(g.step({ left: null, right: hand(0.05, 0.02, 0, 0.04) }, proxies)).toContainEqual({ kind: 'release', id: 'cover', hand: 'right' });
  });

  test('a pinch away from every control does nothing', () => {
    const g = createGestures();
    expect(g.step({ left: null, right: hand(far.x, far.y, far.z, 0.005) }, proxies).filter((e) => e.kind === 'grab')).toEqual([]);
  });

  test('targets are at least 64 mm across', () => {
    const g = createGestures();
    expect(g.step({ left: null, right: hand(0.03, 0, 0, 0.005) }, proxies)).toContainEqual({ kind: 'grab', id: 'cover', hand: 'right' });
  });

  test('one control has one hand: the other hand cannot take it mid-drag', () => {
    const g = createGestures();
    g.step({ left: null, right: hand(0, 0, 0, 0.005) }, proxies);
    const events = g.step({ left: hand(0, 0, 0, 0.005), right: hand(0, 0, 0, 0.005) }, proxies);
    expect(events.filter((e) => e.kind === 'grab')).toEqual([]);
  });

  test('losing tracking mid-drag cancels the grab', () => {
    const g = createGestures();
    g.step({ left: null, right: hand(0, 0, 0, 0.005) }, proxies);
    expect(g.step({ left: null, right: hand(0, 0, 0, 0.005, false) }, proxies)).toContainEqual({ kind: 'cancel', id: 'cover', hand: 'right' });
    expect(g.held('right')).toBeNull();
  });
});

describe('pausing', () => {
  const setup = () => {
    const clock = createShowClock();
    const calls: string[] = [];
    const pause = createPauseControl(clock, { suspend: () => calls.push('suspend'), resume: () => calls.push('resume'), log: (e) => calls.push(e) });
    return { clock, calls, pause };
  };

  test('the first reason pauses, and only the last one cleared resumes', () => {
    const { calls, pause } = setup();
    pause.set('ribbon', true);
    pause.set('book_closed', true);
    pause.set('ribbon', false);
    expect(calls).toEqual(['suspend', 'session.paused:ribbon']);
    pause.set('book_closed', false);
    expect(calls).toEqual(['suspend', 'session.paused:ribbon', 'resume', 'session.resumed']);
  });

  test('saying the same thing twice changes nothing', () => {
    const { calls, pause } = setup();
    pause.set('headset_off', true);
    pause.set('headset_off', true);
    pause.set('headset_off', false);
    pause.set('headset_off', false);
    expect(calls).toEqual(['suspend', 'session.paused:headset_off', 'resume', 'session.resumed']);
  });
});

describe('the checkpoint', () => {
  const store = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), data };
  };
  const checkpoint: Checkpoint = { v: CHECKPOINT_VERSION, savedAt: '2026-11-12T10:00:00.000Z', seriesId: 'flagship-1', beatId: 'opening', showMs: 7250, scale: 0.9, confirmed: true };

  const expected = { seriesId: 'flagship-1', beatId: 'opening', untilMs: 10_000 };
  const soon = Date.parse('2026-11-12T10:05:00.000Z');

  test('round-trips', () => {
    const s = store();
    writeCheckpoint(s, checkpoint);
    expect(readCheckpoint(s, soon, expected)).toEqual(checkpoint);
  });

  test('a checkpoint from another story or beat starts fresh, so a new build never seeks into the wrong moment', () => {
    const s = store();
    writeCheckpoint(s, checkpoint);
    expect(readCheckpoint(s, soon, { ...expected, seriesId: 'other' })).toBeNull();
    expect(readCheckpoint(s, soon, { ...expected, beatId: 'other' })).toBeNull();
  });

  test('once the opening has played out, a reload starts it again, so anyone you show it to sees it', () => {
    const s = store();
    writeCheckpoint(s, { ...checkpoint, showMs: 12_000 });
    expect(readCheckpoint(s, soon, expected)).toBeNull();
  });

  test('only a recent crash resumes: after half an hour the story starts again', () => {
    const s = store();
    writeCheckpoint(s, checkpoint);
    expect(readCheckpoint(s, Date.parse('2026-11-12T10:45:00.000Z'), expected)).toBeNull();
  });

  test('a checkpoint from another version, or garbage, starts fresh', () => {
    const s = store();
    s.setItem('tt.checkpoint', JSON.stringify({ ...checkpoint, v: 999 }));
    expect(readCheckpoint(s, soon, expected)).toBeNull();
    s.setItem('tt.checkpoint', '{nope');
    expect(readCheckpoint(s, soon, expected)).toBeNull();
  });


  test('storage that throws never breaks the show', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); }, removeItem: () => undefined };
    expect(() => writeCheckpoint(broken, checkpoint)).not.toThrow();
    expect(readCheckpoint(broken, 0, expected)).toBeNull();
  });
});

describe('edges you can pinch anywhere along', () => {
  const edge = [{ id: 'cover', position: { x: 0, y: 0, z: 0 }, radiusM: 0.032, segment: { a: { x: 0, y: 0, z: -0.15 }, b: { x: 0, y: 0, z: 0.15 } } }];

  test('a pinch near the far end of the cover edge still grabs it', () => {
    const g = createGestures();
    expect(g.step({ left: hand(0.01, 0, -0.14, 0.005), right: null }, edge)).toContainEqual({ kind: 'grab', id: 'cover', hand: 'left' });
  });

  test('beyond the end of the edge it does not', () => {
    const g = createGestures();
    expect(g.step({ left: hand(0, 0, -0.25, 0.005), right: null }, edge).filter((e) => e.kind === 'grab')).toEqual([]);
  });

  test('two hands can each hold a different edge', () => {
    const g = createGestures();
    const both = [...edge, { id: 'fore', position: { x: 0.4, y: 0, z: 0 }, radiusM: 0.032 }];
    g.step({ left: hand(0, 0, 0, 0.005), right: null }, both);
    expect(g.step({ left: hand(0, 0, 0, 0.005), right: hand(0.4, 0, 0, 0.005) }, both)).toContainEqual({ kind: 'grab', id: 'fore', hand: 'right' });
  });
});

describe('reaching a book that lies on a real table', () => {
  // Your fingertips stop on the wood, so a pinch at a page lying on the table lands a few cm above it.
  const onTable = [{ id: 'ribbon', position: { x: 0, y: 0, z: 0 }, radiusM: 0.032, reachUpM: 0.05 }];

  test('a pinch a few centimetres above a control still grabs it', () => {
    const g = createGestures();
    expect(g.step({ left: null, right: hand(0.01, 0.07, 0, 0.005) }, onTable)).toContainEqual({ kind: 'grab', id: 'ribbon', hand: 'right' });
  });

  test('but not from well above the book', () => {
    const g = createGestures();
    expect(g.step({ left: null, right: hand(0, 0.12, 0, 0.005) }, onTable).filter((e) => e.kind === 'grab')).toEqual([]);
  });

  test('and the reach is upward only: below the page is the table', () => {
    const g = createGestures();
    expect(g.step({ left: null, right: hand(0, -0.06, 0, 0.005) }, onTable).filter((e) => e.kind === 'grab')).toEqual([]);
  });
});

describe('swinging the cover from a grab above it', () => {
  // Angles about the spine: 1 is lying open on the left (pi), 0 is laid over on the right.
  const grabbedAbove = { amount: 1, angle: Math.atan2(0.05, -0.21) };

  test('grabbing the edge from above does not move the cover', () => {
    expect(dragCover(grabbedAbove, grabbedAbove.angle)).toBe(1);
  });

  test('swinging the hand over toward the right closes it', () => {
    expect(dragCover(grabbedAbove, 0.2)).toBeLessThan(0.5);
  });

  test('it never goes past open or shut', () => {
    expect(dragCover(grabbedAbove, Math.PI)).toBe(1);
    expect(dragCover({ amount: 0, angle: 0.3 }, 0)).toBe(0);
  });
});

describe('stretching the book with two hands', () => {
  test('pulling your hands apart grows it in proportion', () => {
    expect(resizeScale(0.8, 0.4, 0.5)).toBeCloseTo(1);
  });

  test('pushing them together shrinks it, but never below the smallest book', () => {
    expect(resizeScale(0.8, 0.4, 0.1)).toBe(RESIZE_MIN);
  });

  test('and never past the largest', () => {
    expect(resizeScale(1, 0.3, 0.9)).toBe(RESIZE_MAX);
  });

  test('the range is a tray to a big desk', () => {
    expect(RESIZE_MIN).toBeCloseTo(0.6);
    expect(RESIZE_MAX).toBeCloseTo(1.3);
  });
});

describe('leaving and coming back', () => {
  test('a first session places freely and opens the story', () => {
    const flow = createSessionFlow();
    expect(flow.begin(false)).toEqual({ shut: false });
    expect(flow.canPlace(false)).toBe(true);
    expect(flow.landed(false)).toEqual({ reopen: false });
  });

  test('leaving mid-story pauses it', () => {
    expect(createSessionFlow().end(true)).toEqual({ pause: true });
    expect(createSessionFlow().end(false)).toEqual({ pause: false });
  });

  test('coming back mid-story: the book arrives again, shut, at the new spot, then reopens and the story continues', () => {
    const flow = createSessionFlow();
    expect(flow.begin(true)).toEqual({ shut: true });
    expect(flow.canPlace(true)).toBe(true);
    expect(flow.landed(true)).toEqual({ reopen: true });
    // Once it has landed again, it stays put like any open book.
    expect(flow.canPlace(true)).toBe(false);
  });
});
