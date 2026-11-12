import type { ActingId, CastMember } from '@tabletop/contracts';

/** Characters step like stop-motion. The camera and your hands stay at full frame rate. */
export const POSES_PER_SECOND = 12;
const BLINK_EVERY_S = 4.1;
const BLINK_FOR_S = 0.17;
/** How long a new acting takes to settle in. */
const EASE_IN_MS = 350;

export interface ActingInput {
  acting: ActingId | null;
  localMs: number;
  target: string | null;
}

export interface PartPose {
  /** Clockwise degrees, as painted and approved. */
  deg: number;
  /** Rig pixels, y down. */
  px: [number, number];
  scaleX: number;
  scaleY: number;
}

export interface Pose {
  /** A head name from the rig, or null for a character without heads. */
  face: string | null;
  headDeg: number;
  headPx: [number, number];
  parts: Record<string, PartPose>;
  /** The whole body: a shake, a crouch, a hop. Rig pixels. */
  bodyPx: [number, number];
  bodyScaleY: number;
  /** Multiplies a carried light's glow. */
  glow: number;
  /** What the character is looking at, or null to simply face the reader. */
  lookAt: string | null;
  /** How far the card may turn toward the reader or its target. */
  yawLimitDeg: number;
}

export interface ActingOptions {
  /** The gust's strength now, 0 to 1. */
  gust: number;
  /** Offsets the blink and sway, so a cast doesn't move in unison. */
  seed: number;
  /** The heads this character's rig has. */
  heads: string[];
  /** Speaking now: the mouth swaps open and shut, at 12 poses a second. */
  talking?: boolean;
}

const step = (ms: number): number => Math.floor((ms / 1000) * POSES_PER_SECOND) / POSES_PER_SECOND;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const rest = (): PartPose => ({ deg: 0, px: [0, 0], scaleX: 1, scaleY: 1 });

const FACING_LIMIT_DEG = 25;
const LOOK_LIMIT_DEG = 40;
/** Looking up at you holds this long, then becomes glances while it waits. */
const LOOK_HOLD_MS = 3500;
const GLANCE_EVERY_MS = 5000;
const GLANCE_FOR_MS = 1800;

/** The pose for one character at one moment. Pure: the same inputs always give the same pose. */
export function actingPose(member: CastMember, input: ActingInput, showMs: number, options: ActingOptions): Pose {
  const t = step(showMs) + options.seed * 1.7;
  const local = step(input.localMs) * 1000;
  const u = clamp01(local / EASE_IN_MS);
  const { anatomy } = member;
  const has = (head: string): boolean => options.heads.includes(head);
  const headFor = (acting: ActingId): string | null => {
    const head = member.actingHeads[acting];
    return head && has(head) ? head : null;
  };

  const sway = Math.sin(t * 1.1);
  const breathe = Math.sin(t * 1.9);
  const flick = Math.sin(t * 2.7);
  const blinking = t % BLINK_EVERY_S < BLINK_FOR_S;
  const restFace = options.heads.length === 0 ? null : blinking && has('blink') ? 'blink' : 'forward';

  const parts: Record<string, PartPose> = {};
  const part = (name: string | null): PartPose | null => {
    if (!name) return null;
    parts[name] ??= rest();
    return parts[name];
  };

  const torso = part(anatomy.torso);
  if (torso) torso.scaleY = 1 + 0.008 * breathe;
  for (const arm of anatomy.arms) part(arm)!.deg = 2 * sway;
  const tail = part(anatomy.tail);
  if (tail) tail.deg = 5 * flick;
  const held = part(anatomy.held);
  if (held) held.deg = 2.2 * Math.sin(t * 2.2) + 9 * options.gust * Math.sin(t * 18);
  const flapping = input.acting === 'flutter' || input.acting === 'seek_light';
  const open = 0.68 + 0.3 * Math.sin(t * (flapping ? 16 : 7));
  anatomy.wings.forEach((wing, i) => {
    const w = part(wing)!;
    w.scaleX = i === 0 ? open : open * 0.96;
    w.deg = (i === 0 ? -5 : 5) * (1 - open);
  });

  const pose: Pose = {
    face: restFace,
    headDeg: 1.5 * sway,
    headPx: [0, 0],
    parts,
    bodyPx: [0, 0],
    bodyScaleY: 1,
    glow: 1 + 0.05 * Math.sin(t * 7),
    lookAt: null,
    yawLimitDeg: FACING_LIMIT_DEG,
  };

  switch (input.acting) {
    case 'scared': {
      pose.face = headFor('scared') ?? restFace;
      pose.bodyPx = [Math.sin(t * 34) * 2.6, 18 * u];
      pose.bodyScaleY = 1 - 0.04 * u;
      pose.headPx = [-4 * u, 26 * u];
      pose.headDeg = 5 * u;
      if (held) {
        held.px = [-22 * u, 18 * u];
        held.deg = 8 * Math.sin(t * 16) + 9 * options.gust * Math.sin(t * 18);
      }
      if (tail) tail.deg += 26 * u;
      pose.glow = 0.8 + 0.2 * Math.sin(t * 19);
      break;
    }
    case 'look': {
      const up = headFor('look');
      const glancing = local < LOOK_HOLD_MS || (local - LOOK_HOLD_MS) % GLANCE_EVERY_MS < GLANCE_FOR_MS;
      pose.face = glancing && up ? up : restFace === 'blink' ? 'blink' : restFace;
      if (glancing) pose.headDeg = -4 * clamp01(local / 400) + 1.2 * Math.sin(t * 1.3);
      pose.lookAt = input.target;
      pose.yawLimitDeg = local < LOOK_HOLD_MS ? LOOK_LIMIT_DEG : FACING_LIMIT_DEG + 10;
      break;
    }
    case 'raise': {
      if (held) {
        held.px = [0, -38 * u];
        held.deg = 2 * Math.sin(t * 3);
      }
      for (const arm of anatomy.arms) part(arm)!.deg = -18 * u;
      pose.headDeg = -2 * u;
      pose.glow = 1.1;
      break;
    }
    case 'hop': {
      // One small hop of relief: up, a breath in the air, and down onto the mark.
      const p = clamp01(local / 600);
      pose.bodyPx = [0, -Math.sin(Math.PI * p) * 34];
      pose.bodyScaleY = p < 0.12 || p > 0.9 ? 0.96 : 1.02;
      if (tail) tail.deg = 14 * Math.sin(Math.PI * p);
      break;
    }
    case 'turn': {
      pose.face = headFor('turn') ?? restFace;
      pose.lookAt = input.target;
      pose.yawLimitDeg = LOOK_LIMIT_DEG;
      if (held && anatomy.held && anatomy.arms.length > 1) held.px = [0, 50 * u];
      break;
    }
    case 'grumble': {
      pose.face = has('grumpy') && Math.floor(t * 12) % 7 < 4 ? (headFor('grumble') ?? restFace) : has('talk') ? 'talk' : restFace;
      pose.headPx = [0, 3];
      pose.headDeg = 3 * Math.sin(t * 5);
      if (held) held.px = [0, 50 * u];
      for (const arm of anatomy.arms) part(arm)!.px = [0, 27.5 * u];
      break;
    }
    case 'examine': {
      pose.face = headFor('examine') ?? restFace;
      pose.headDeg = 6 * u + 1.5 * Math.sin(t * 2);
      pose.headPx = [0, 6 * u];
      if (held) {
        held.deg = 10 * Math.sin(t * 4);
        held.px = [-10 * u, -12 * u];
      }
      pose.lookAt = input.target;
      break;
    }
    case 'reach':
    case 'take': {
      // Take reaches and draws back; reach holds out.
      const out = input.acting === 'take' ? Math.sin(Math.PI * clamp01(local / 800)) : u;
      for (const arm of anatomy.arms) part(arm)!.deg = -30 * out;
      pose.bodyPx = [-6 * out, 2 * out];
      pose.headDeg = 3 * out;
      pose.lookAt = input.target;
      break;
    }
    case 'flutter': {
      pose.bodyPx = [0, Math.sin(t * 14) * 8];
      break;
    }
    case 'seek_light': {
      // Darting at the light: quick, jittery, leaning in. Flight to it is the stage's job.
      pose.bodyPx = [Math.sin(t * 5.1) * 9, Math.sin(t * 6.7) * 7];
      pose.lookAt = input.target;
      pose.yawLimitDeg = LOOK_LIMIT_DEG;
      break;
    }
    default:
      break;
  }
  if (options.talking && pose.face && has('talk')) {
    const c = Math.floor(t * 12);
    if (Math.sin(c * 1.7) + Math.sin(c * 0.63) > -0.1) pose.face = 'talk';
    pose.headPx = [pose.headPx[0], pose.headPx[1] - 2 + 2 * Math.sin(t * 9)];
    pose.headDeg += 2 * Math.sin(t * 3.1);
  }
  return pose;
}
