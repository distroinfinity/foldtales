import { describe, expect, test } from 'vitest';
import { createTalkPress, TALK_TRAVEL_M, type TalkHand } from '../client/src/stage/talk-press.ts';

/**
 * Hold to talk is touch-to-press, through the shared press arming (Codex review of #52, P2): a
 * fingertip pushing the paper from the front holds it until it lifts; a hand near the tab, or a
 * pinch beside it, never opens the microphone. Far away, a look (VR Glasses) or a pointing hand
 * with a pinch holds it while the pinch lasts, except for a hand already at the tab.
 */

const SIZE = { w: 0.078, h: 0.03 };
const TIP_R = 0.008;
/** A fingertip joint whose skin is `skin` metres in front of the resting face (negative is pushing). */
const at = (skin: number, x = 0, y = 0) => ({ x, y, z: skin + TIP_R + TALK_TRAVEL_M });
const idle: TalkHand = { tip: null, pinching: false, ray: null };
const hands = (left: Partial<TalkHand> = {}, right: Partial<TalkHand> = {}) => ({ left: { ...idle, ...left }, right: { ...idle, ...right } });
/** A ray from 40 cm up and 30 cm back, aimed at (x, y) on the tab's face. */
const aimedAt = (x = 0, y = 0) => {
  const origin = { x, y: y - 0.3, z: 0.4 };
  const d = { x: 0, y: 0.3, z: -0.4 };
  const len = Math.hypot(d.x, d.y, d.z);
  return { origin, direction: { x: d.x / len, y: d.y / len, z: d.z / len } };
};

/** Brings one hand's fingertip down onto the tab from the front, frame by frame. */
function pressDown(t: ReturnType<typeof createTalkPress>, side: 'left' | 'right', extra: Partial<TalkHand> = {}) {
  const steps = [0.03, 0.01, 0.002, -0.002, -0.005];
  return steps.map((skin) => t.step(side === 'left' ? hands({ tip: at(skin), ...extra }) : hands({}, { tip: at(skin), ...extra }), null));
}

describe('Hold to talk: touch to press', () => {
  for (const side of ['left', 'right'] as const) {
    test(`a ${side} fingertip pushing the paper from the front holds it, and lifting lets go`, () => {
      const t = createTalkPress(SIZE);
      const frames = pressDown(t, side);
      expect(frames.filter((f) => f.started)).toHaveLength(1);
      expect(t.holder).toEqual({ by: 'touch', hand: side });
      // Resting on it while talking: still held.
      for (let i = 0; i < 5; i++) expect(t.step(side === 'left' ? hands({ tip: at(-0.004) }) : hands({}, { tip: at(-0.004) }), null).ended).toBe(false);
      const lifted = t.step(side === 'left' ? hands({ tip: at(0.03) }) : hands({}, { tip: at(0.03) }), null);
      expect(lifted.ended).toBe(true);
      expect(t.holder).toBeNull();
    });
  }

  test('a hand merely near the tab, hovering over it, opens nothing', () => {
    const t = createTalkPress(SIZE);
    for (const skin of [0.04, 0.02, 0.01, 0.004, 0.002, 0.004, 0.02]) {
      const f = t.step(hands({}, { tip: at(skin) }), null);
      expect(f.started).toBe(false);
    }
    expect(t.holder).toBeNull();
  });

  test('a pinching hand never presses, even pushed right onto the paper', () => {
    const t = createTalkPress(SIZE);
    expect(pressDown(t, 'right', { pinching: true }).some((f) => f.started)).toBe(false);
    expect(t.holder).toBeNull();
  });

  test('a pinch beside the tab (where the old grab target answered) opens nothing', () => {
    const t = createTalkPress(SIZE);
    // Fingers 3 cm above the tab and 2 cm to its side, pinching and releasing, with the hand's ray pointing anywhere.
    for (const pinching of [false, true, true, false, true]) {
      const f = t.step(hands({}, { tip: { x: SIZE.w / 2 + 0.02, y: 0, z: 0.03 }, pinching, ray: aimedAt() }), null);
      expect(f.started).toBe(false);
    }
  });

  test('a finger coming up from behind the tab, or sliding in from the side, presses nothing', () => {
    const t = createTalkPress(SIZE);
    for (const skin of [-0.03, -0.02, -0.01, -0.005]) expect(t.step(hands({}, { tip: at(skin) }), null).started).toBe(false);
    const u = createTalkPress(SIZE);
    for (const x of [0.12, 0.08, 0.05, 0.0]) expect(u.step(hands({}, { tip: at(-0.004, x) }), null).started).toBe(false);
  });

  test('one press per touch: after letting go, the same hand presses again only after lifting off', () => {
    const t = createTalkPress(SIZE);
    pressDown(t, 'right');
    t.step(hands({}, { tip: at(0.03) }), null);
    expect(pressDown(t, 'right').filter((f) => f.started)).toHaveLength(1);
  });

  test('while one hand holds it, the other can’t take it over', () => {
    const t = createTalkPress(SIZE);
    pressDown(t, 'right');
    for (const skin of [0.03, 0.01, 0.002, -0.004]) t.step(hands({ tip: at(skin, 0.02) }, { tip: at(-0.004) }), null);
    expect(t.holder).toEqual({ by: 'touch', hand: 'right' });
  });
});

describe('Hold to talk: the far fallback', () => {
  test('pointing a hand at the tab from afar and pinching holds it while the pinch lasts', () => {
    const t = createTalkPress(SIZE);
    const far = { tip: { x: 0, y: -0.3, z: 0.4 }, ray: aimedAt() };
    expect(t.step(hands({}, { ...far, pinching: false }), null).near).toBe(true);
    expect(t.step(hands({}, { ...far, pinching: true }), null).started).toBe(true);
    expect(t.holder).toEqual({ by: 'far', hand: 'right' });
    expect(t.step(hands({}, { ...far, pinching: true }), null).ended).toBe(false);
    expect(t.step(hands({}, { ...far, pinching: false }), null).ended).toBe(true);
  });

  test('a pinch that began elsewhere and drifts onto the tab doesn’t take it', () => {
    const t = createTalkPress(SIZE);
    t.step(hands({ tip: { x: 0, y: -0.3, z: 0.4 }, pinching: true, ray: aimedAt(0.3) }), null);
    expect(t.step(hands({ tip: { x: 0, y: -0.3, z: 0.4 }, pinching: true, ray: aimedAt() }), null).started).toBe(false);
  });

  test('a hand already at the tab is touching, not pointing: its pinch chooses nothing', () => {
    const t = createTalkPress(SIZE);
    const atTab = { tip: { x: 0, y: 0, z: 0.05 }, ray: aimedAt() };
    t.step(hands(atTab), null);
    expect(t.step(hands({ ...atTab, pinching: true }), null).started).toBe(false);
  });

  test('VR Glasses: where you look, with either hand’s pinch, holds it; looking away from it chooses nothing', () => {
    for (const side of ['left', 'right'] as const) {
      const t = createTalkPress(SIZE);
      const look = aimedAt();
      const far = { tip: { x: 0.2, y: -0.2, z: 0.3 }, ray: aimedAt(0.4) };
      t.step(side === 'left' ? hands(far) : hands({}, far), look);
      const f = t.step(side === 'left' ? hands({ ...far, pinching: true }) : hands({}, { ...far, pinching: true }), look);
      expect(f.started).toBe(true);
      expect(t.holder).toEqual({ by: 'far', hand: side });
    }
    const away = createTalkPress(SIZE);
    away.step(hands({}, { tip: { x: 0.2, y: -0.2, z: 0.3 } }), aimedAt(0.4));
    expect(away.step(hands({}, { tip: { x: 0.2, y: -0.2, z: 0.3 }, pinching: true }), aimedAt(0.4)).started).toBe(false);
  });

  test('when the tab goes away, whatever held it lets go, and nothing presses until fingers lift', () => {
    const t = createTalkPress(SIZE);
    pressDown(t, 'right');
    t.reset();
    expect(t.holder).toBeNull();
    expect(t.step(hands({}, { tip: at(-0.005) }), null).started).toBe(false);
  });
});
