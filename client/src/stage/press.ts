/**
 * Touch to press: an index fingertip pushing a paper button. Pure, so every path is tested without a
 * headset (docs/plans/2026-11-16-hands-and-controls.md).
 *
 * Everything is in the button surface's own frame: x and y across the surface, z out of its face toward
 * the reader. A button's face rests `travelM` proud of the surface; the finger pushes it down to the
 * surface, and the press lands once it has gone `fireAtM` of that travel. The fingertip is a ball: the
 * joint sits about `tipRadiusM` behind the skin, so contact is measured from the skin, not the joint.
 *
 * A press only counts when the finger came in from the front (a hand passing up through the card from
 * behind, or sliding in from the side, presses nothing), and each touch presses once: the finger has to
 * come back off the face before the same hand can press again. A pinching hand never presses: pinch is
 * for holding things.
 */
import type { Vec3 } from './surface.ts';

export type Side = 'left' | 'right';

export interface PressButton {
  id: string;
  /** Centre and size on the surface. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PressOptions {
  /** How far the face moves before it meets the surface (Meta: about 7 mm). */
  travelM?: number;
  /** How much of the travel lands the press. */
  fireAtM?: number;
  /** Where the hover state starts, in front of the face. */
  hoverM?: number;
  /** The fingertip joint sits this far behind the skin. */
  tipRadiusM?: number;
  /** Slack round each button's edge, so a finger on the border still counts. */
  marginM?: number;
}

export interface PressHand {
  /** The index fingertip joint, already in the surface's frame. Null when the hand isn't tracked. */
  tip: Vec3 | null;
  /** True while the hand is pinching (thumb on index): a pinching hand never presses. */
  pinching?: boolean;
}

export interface PressFrame {
  /** The button a finger is hovering over or pushing, per hand. */
  near: Record<Side, string | null>;
  /** How far each button's face is pushed in, 0 to 1 (of the travel). Missing means at rest. */
  depth: Map<string, number>;
  /** Presses that landed this frame, in order. */
  fired: Array<{ id: string; hand: Side }>;
}

export const PRESS_TRAVEL_M = 0.007;
export const TIP_RADIUS_M = 0.008;

export function createPresser(options: PressOptions = {}) {
  const travel = options.travelM ?? PRESS_TRAVEL_M;
  const fireAt = options.fireAtM ?? travel * 0.7;
  const hover = options.hoverM ?? 0.04;
  const tipR = options.tipRadiusM ?? TIP_RADIUS_M;
  const margin = options.marginM ?? 0.004;
  /** The button each hand came in on from the front, and whether its press has landed. */
  const armed: Record<Side, string | null> = { left: null, right: null };
  const spent: Record<Side, boolean> = { left: false, right: false };

  const inside = (b: PressButton, p: Vec3, extra = 0) => Math.abs(p.x - b.x) <= b.w / 2 + margin + extra && Math.abs(p.y - b.y) <= b.h / 2 + margin + extra;

  return {
    /** Forget every touch in progress (the card changed under the finger): nothing presses until it lifts off. */
    reset(): void {
      for (const side of ['left', 'right'] as const) {
        armed[side] = null;
        spent[side] = true;
      }
    },
    step(buttons: readonly PressButton[], hands: Record<Side, PressHand>): PressFrame {
      const frame: PressFrame = { near: { left: null, right: null }, depth: new Map(), fired: [] };
      for (const side of ['left', 'right'] as const) {
        const { tip, pinching } = hands[side];
        if (!tip || pinching) {
          armed[side] = null;
          // A pinch that drifts onto a button doesn't press it when it opens there.
          spent[side] = !!tip;
          continue;
        }
        // The skin's distance in front of the resting face (negative once it's pushing).
        const skin = tip.z - tipR - travel;
        const over = buttons.find((b) => inside(b, tip));
        // Back off the face, or off the button, before this hand can press again.
        if (spent[side] && (skin > 0.003 || !buttons.some((b) => inside(b, tip, 0.01)))) spent[side] = false;
        if (spent[side]) {
          if (over && skin < hover) frame.near[side] = over.id;
          if (over && skin < 0) frame.depth.set(over.id, Math.max(frame.depth.get(over.id) ?? 0, Math.min(1, -skin / travel)));
          continue;
        }
        if (over && skin >= 0 && skin < hover) {
          // In front of the face: this is the button it's coming in on.
          armed[side] = over.id;
          frame.near[side] = over.id;
          continue;
        }
        const on = armed[side] ? buttons.find((b) => b.id === armed[side]) : undefined;
        if (on && skin < 0 && inside(on, tip, 0.006) && skin > -travel - 0.03) {
          frame.near[side] = on.id;
          const pushed = Math.min(1, -skin / travel);
          frame.depth.set(on.id, Math.max(frame.depth.get(on.id) ?? 0, pushed));
          if (-skin >= fireAt) {
            frame.fired.push({ id: on.id, hand: side });
            spent[side] = true;
            armed[side] = null;
          }
          continue;
        }
        // Off every button, too far away, or it came round from the side or behind.
        armed[side] = null;
      }
      return frame;
    },
  };
}
export type Presser = ReturnType<typeof createPresser>;
