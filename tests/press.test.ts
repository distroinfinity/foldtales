import { describe, expect, it } from 'vitest';
import { createPresser, PRESS_TRAVEL_M, TIP_RADIUS_M, type PressHand } from '../client/src/stage/press.ts';

const button = { id: 'carry-on', x: 0, y: 0, w: 0.07, h: 0.045 };
const other = { id: 'contents', x: 0, y: -0.06, w: 0.07, h: 0.045 };
const buttons = [button, other];
/** The fingertip joint `skinMm` millimetres in front of the button's resting face (negative: pushing in). */
const at = (skinMm: number, x = 0, y = 0): PressHand => ({ tip: { x, y, z: PRESS_TRAVEL_M + TIP_RADIUS_M + skinMm / 1000 } });
const none: PressHand = { tip: null };

describe('touch to press', () => {
  it('a fingertip coming in from the front presses once, partway through its travel', () => {
    const p = createPresser();
    expect(p.step(buttons, { left: none, right: at(30) }).near.right).toBe('carry-on');
    expect(p.step(buttons, { left: none, right: at(-2) }).fired).toEqual([]);
    const pushed = p.step(buttons, { left: none, right: at(-5.5) });
    expect(pushed.fired).toEqual([{ id: 'carry-on', hand: 'right' }]);
    expect(pushed.depth.get('carry-on')).toBeGreaterThan(0.7);
    // Held down, or pushed further: still one press.
    expect(p.step(buttons, { left: none, right: at(-7) }).fired).toEqual([]);
    expect(p.step(buttons, { left: none, right: at(-3) }).fired).toEqual([]);
  });

  it('lifting off the face lets the same finger press again', () => {
    const p = createPresser();
    p.step(buttons, { left: none, right: at(20) });
    expect(p.step(buttons, { left: none, right: at(-6) }).fired).toHaveLength(1);
    p.step(buttons, { left: none, right: at(10) });
    expect(p.step(buttons, { left: none, right: at(-6) }).fired).toHaveLength(1);
  });

  it('a hand coming up through the card from behind presses nothing', () => {
    const p = createPresser();
    expect(p.step(buttons, { left: none, right: at(-25) }).fired).toEqual([]);
    expect(p.step(buttons, { left: none, right: at(-6) }).fired).toEqual([]);
  });

  it('sliding in from the side at the card presses nothing', () => {
    const p = createPresser();
    p.step(buttons, { left: none, right: at(-6, 0.2, 0) });
    expect(p.step(buttons, { left: none, right: at(-6, 0, 0) }).fired).toEqual([]);
  });

  it('a pinching hand never presses: pinch is for holding things', () => {
    const p = createPresser();
    p.step(buttons, { left: none, right: { ...at(20), pinching: true } });
    expect(p.step(buttons, { left: none, right: { ...at(-6), pinching: true } }).fired).toEqual([]);
    // Opening the pinch while it's on the button doesn't press it either.
    expect(p.step(buttons, { left: none, right: at(-6) }).fired).toEqual([]);
  });

  it('either hand presses, and each presses its own button', () => {
    const p = createPresser();
    p.step(buttons, { left: at(20, 0, -0.06), right: at(20) });
    const f = p.step(buttons, { left: at(-6, 0, -0.06), right: at(-6) });
    expect(f.fired).toEqual([
      { id: 'contents', hand: 'left' },
      { id: 'carry-on', hand: 'right' },
    ]);
  });

  it('a card changing under a finger (reset) presses nothing until the finger lifts', () => {
    const p = createPresser();
    p.step(buttons, { left: none, right: at(20) });
    p.step(buttons, { left: none, right: at(-2) });
    p.reset();
    expect(p.step(buttons, { left: none, right: at(-6) }).fired).toEqual([]);
    p.step(buttons, { left: none, right: at(15) });
    expect(p.step(buttons, { left: none, right: at(-6) }).fired).toHaveLength(1);
  });

  it('the gap between buttons presses nothing', () => {
    const p = createPresser();
    const gapY = (button.y - button.h / 2 + other.y + other.h / 2) / 2;
    p.step(buttons, { left: none, right: at(20, 0, gapY) });
    expect(p.step(buttons, { left: none, right: at(-6, 0, gapY) }).fired).toEqual([]);
  });
});
