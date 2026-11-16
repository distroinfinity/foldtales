/**
 * "Hold to talk", as hands use it (Codex review of #52, P2; docs/plans/2026-11-16-hands-and-controls.md).
 * Pure, in the tab's own frame: x and y across its face, z out of the face toward the reader.
 *
 * - **Touch to press** is the way within reach, through the shared press arming (`press.ts`): the finger
 *   comes in from the front and pushes the paper down, a pinching hand never presses, and the press holds
 *   the tab until that finger lifts off it. Being near the tab, or pinching beside it, does nothing.
 * - **Look or point, and pinch** is the far fallback: with real gaze (VR Glasses) what you look at, else
 *   the pinching hand's own ray. It holds while the pinch lasts. A hand whose fingertip is already at the
 *   tab (touch reach) is touching, not pointing: its pinch chooses nothing, as on the book's cards.
 */
import { createPresser, type Side } from './press.ts';
import type { Vec3 } from './surface.ts';

export interface Ray {
  origin: Vec3;
  direction: Vec3;
}

export interface TalkHand {
  /** The index fingertip joint in the tab's frame, or null when the hand isn't tracked. */
  tip: Vec3 | null;
  pinching: boolean;
  /** The hand's pointing ray in the tab's frame, if it has one. */
  ray: Ray | null;
}

export type TalkHolder = { by: 'touch' | 'far'; hand: Side } | null;

export interface TalkStep {
  holder: TalkHolder;
  /** This frame's change: the tab was taken, or let go. */
  started: boolean;
  ended: boolean;
  /** How far the paper is pushed in, 0 to 1. */
  depth: number;
  /** A fingertip is hovering over it, or a far pointer is on it: its edge lights. */
  near: boolean;
}

/** Shallower than a card's: the tab lies on the real table, which stops the finger. */
export const TALK_TRAVEL_M = 0.006;
const TIP_RADIUS_M = 0.008;
/** Lifted this far above the resting face, the finger has let go. */
const LIFT_M = 0.012;
/** Slack round the tab for a far pointer, and how far a finger may slide off before it's let go. */
const POINT_MARGIN_M = 0.015;
const SLIDE_OFF_M = 0.02;

export function createTalkPress(size: { w: number; h: number }) {
  const presser = createPresser({ travelM: TALK_TRAVEL_M, fireAtM: TALK_TRAVEL_M * 0.66, hoverM: 0.05 });
  const button = { id: 'talk', x: 0, y: 0, w: size.w, h: size.h };
  let holder: TalkHolder = null;
  const wasPinching: Record<Side, boolean> = { left: false, right: false };

  const onFace = (p: Vec3, margin: number) => Math.abs(p.x) <= size.w / 2 + margin && Math.abs(p.y) <= size.h / 2 + margin;
  /** In front of the tab, close enough to be touching it rather than pointing from afar. */
  const inTouchReach = (tip: Vec3 | null) => !!tip && tip.z > -0.03 && tip.z < 0.1 && onFace(tip, 0.05);
  const points = (ray: Ray | null): boolean => {
    if (!ray || ray.direction.z >= 0 || ray.origin.z <= 0) return false;
    const t = -ray.origin.z / ray.direction.z;
    return onFace({ x: ray.origin.x + ray.direction.x * t, y: ray.origin.y + ray.direction.y * t, z: 0 }, POINT_MARGIN_M);
  };

  return {
    get holder(): TalkHolder {
      return holder;
    },
    /** The tab went away (or the story paused): whatever held it lets go, and nothing presses until fingers lift. */
    reset(): void {
      holder = null;
      presser.reset();
    },
    step(hands: Record<Side, TalkHand>, gaze: Ray | null): TalkStep {
      const before = holder;
      const pressed = presser.step([button], { left: { tip: hands.left.tip, pinching: hands.left.pinching }, right: { tip: hands.right.tip, pinching: hands.right.pinching } });
      let depth = pressed.depth.get('talk') ?? 0;
      let near = pressed.near.left === 'talk' || pressed.near.right === 'talk';

      if (holder?.by === 'touch') {
        const tip = hands[holder.hand].tip;
        const lifted = !tip || tip.z - TIP_RADIUS_M - TALK_TRAVEL_M > LIFT_M || !onFace(tip, SLIDE_OFF_M);
        if (lifted) holder = null;
        else depth = Math.max(depth, 1);
      } else if (holder?.by === 'far') {
        if (!hands[holder.hand].pinching) holder = null;
      }

      if (!before && !holder) {
        const press = pressed.fired.find((f) => f.id === 'talk');
        if (press) holder = { by: 'touch', hand: press.hand };
      }
      for (const side of ['left', 'right'] as const) {
        const hand = hands[side];
        const began = hand.pinching && !wasPinching[side];
        wasPinching[side] = hand.pinching;
        const pointer = gaze ?? hand.ray;
        const aimed = !inTouchReach(hand.tip) && points(pointer);
        if (aimed) near = true;
        if (!before && !holder && began && aimed) holder = { by: 'far', hand: side };
      }
      return { holder, started: !before && !!holder, ended: !!before && !holder, depth, near: near || !!holder };
    },
  };
}
export type TalkPress = ReturnType<typeof createTalkPress>;
