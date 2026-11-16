import { DoubleSide, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Vector3 } from '@iwsdk/core';
import { Text } from 'troika-three-text';
import captionFont from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-500-normal.woff?url';
import type { HandSide } from './gestures.ts';
import { createTalkPress, TALK_TRAVEL_M, type Ray } from './talk-press.ts';

/**
 * The AI Storyteller's "Hold to talk": a paper button with a gold rim, lying on the table in front
 * of the book. Press it with a fingertip and keep it down while you talk; it glows once it's really
 * listening; lift your finger when you're done. From further away (or on VR Glasses), look or point at
 * it and pinch, and hold the pinch. A pinch beside it, or a hand merely near it, never opens the
 * microphone: there's no grab target here (Codex review of #52, P2; `talk-press.ts`).
 */

const INK = '#2B2420';

export interface TalkTabDeps {
  bookRoot: Object3D;
  /** The open page's height, and the book's closed (one-page) width and depth. */
  pageY: number;
  pageW: number;
  pageD: number;
  hold(): void;
  release(): void;
  /** A press landed (the paper "tock"): hands have no haptics. */
  pressed?(): void;
}

/** One hand, in the world: its index fingertip, whether it's pinching, and its pointing ray. */
export interface TalkHandWorld {
  tip: Vector3 | null;
  pinching: boolean;
  ray: { origin: Vector3; direction: Vector3 } | null;
}

export function createTalkTab(deps: TalkTabDeps) {
  const root = new Object3D();
  root.name = 'talk-tab';
  root.visible = false;
  // On the table just in front of the book, under the right page: pressed with a fingertip, the
  // finger stops on the real table, and it never covers the page's words.
  root.position.set(deps.pageW * 0.5, 0.002, deps.pageD / 2 + 0.035);
  root.rotation.x = -Math.PI / 2;
  deps.bookRoot.add(root);

  // One button: a clean-cut piece of the book's paper (no deckle: it read as torn in the headset) with a gold rim, and the words printed on it.
  const W = 0.078;
  const H = 0.03;
  const rimMaterial = new MeshBasicMaterial({ color: '#D4A23E', transparent: true, opacity: 0.85, side: DoubleSide, toneMapped: false });
  const rim = new Mesh(new PlaneGeometry(W + 0.005, H + 0.005), rimMaterial);
  rim.renderOrder = 500;
  root.add(rim);
  const face = new Mesh(new PlaneGeometry(W, H), new MeshBasicMaterial({ color: '#F6EFE2', side: DoubleSide, toneMapped: false }));
  face.position.z = 0.0004;
  face.renderOrder = 501;
  root.add(face);
  const label = new Text();
  label.text = 'Hold to talk';
  label.font = captionFont;
  label.fontSize = 0.011;
  label.color = INK;
  label.anchorX = 'center';
  label.anchorY = 'middle';
  label.position.z = 0.0009;
  label.sync();
  root.add(label);
  const tab = root;

  let state: 'idle' | 'opening' | 'listening' | 'sending' = 'idle';
  const press = createTalkPress({ w: W, h: H });
  const faceZ = face.position.z;
  const labelZ = label.position.z;
  const a = new Vector3();
  const b = new Vector3();
  /** A point in the tab's frame. */
  const toLocal = (v: Vector3 | null) => (v ? root.worldToLocal(a.copy(v)).clone() : null);
  /** A ray in the tab's frame. */
  const rayToLocal = (ray: { origin: Vector3; direction: Vector3 } | null): Ray | null => {
    if (!ray) return null;
    const o = root.worldToLocal(a.copy(ray.origin)).clone();
    const d = root.worldToLocal(b.copy(ray.origin).add(ray.direction)).sub(o).normalize();
    return { origin: o, direction: d };
  };
  const letGo = () => {
    if (press.holder) deps.release();
    press.reset();
  };

  return {
    root,
    setShown(on: boolean): void {
      root.visible = on;
      if (!on) letGo();
    },
    /** The ears' state: lifts while held, glows gold when listening. */
    setState(next: 'idle' | 'opening' | 'listening' | 'sending'): void {
      state = next;
      tab.scale.setScalar(next === 'listening' ? 1.1 : next === 'idle' ? 1 : 1.04);
      rimMaterial.opacity = next === 'listening' ? 1 : 0.85;
      rimMaterial.color.set(next === 'listening' ? '#F2C25A' : '#D4A23E');
      label.text = next === 'listening' ? 'Listening… let go' : next === 'opening' ? 'Wait for the glow…' : next === 'sending' ? 'Sending…' : 'Hold to talk';
      label.sync();
    },
    get state() {
      return state;
    },
    /** Who holds it now, and how: a pressed fingertip, or a far pinch. */
    get holder() {
      return press.holder;
    },
    /** Every frame: fingertips press it, a far look or point with a pinch holds it. */
    frame(hands: Record<HandSide, TalkHandWorld>, gaze: { origin: Vector3; direction: Vector3 } | null): void {
      if (!root.visible) return;
      root.updateWorldMatrix(true, false);
      const step = press.step(
        {
          left: { tip: toLocal(hands.left.tip), pinching: hands.left.pinching, ray: rayToLocal(hands.left.ray) },
          right: { tip: toLocal(hands.right.tip), pinching: hands.right.pinching, ray: rayToLocal(hands.right.ray) },
        },
        rayToLocal(gaze),
      );
      // The paper goes down with the finger, and its gold edge lights where a hand is on it.
      face.position.z = faceZ - step.depth * TALK_TRAVEL_M * 0.5;
      label.position.z = labelZ - step.depth * TALK_TRAVEL_M * 0.5;
      if (state === 'idle') rimMaterial.opacity = step.near ? 1 : 0.85;
      if (step.started && step.holder) {
        console.info(`talk: ${step.holder.by === 'touch' ? 'pressed with' : 'pinched from afar with'} ${step.holder.hand} hand`);
        deps.pressed?.();
        deps.hold();
      }
      if (step.ended) deps.release();
    },
    /** Where its face is, for the emulator and the review record. */
    position(): Vector3 | null {
      return root.visible ? face.getWorldPosition(new Vector3()) : null;
    },
  };
}
export type TalkTab = ReturnType<typeof createTalkTab>;
