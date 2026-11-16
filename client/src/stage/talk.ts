import { DoubleSide, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Vector3 } from '@iwsdk/core';
import { Text } from 'troika-three-text';
import captionFont from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-500-normal.woff?url';
import type { ExtraTarget } from './controls.ts';
import type { HandSide } from './gestures.ts';

/**
 * The AI Storyteller's "Hold to talk": a paper button with a gold rim, lying on the table in front
 * of the book. Press it with a fingertip (or pinch it) and keep holding while you talk; it glows
 * once it's really listening; lift your finger when you're done.
 */

const INK = '#2B2420';
const REACH_UP_M = 0.05;

export interface TalkTabDeps {
  bookRoot: Object3D;
  /** The open page's height, and the book's closed (one-page) width and depth. */
  pageY: number;
  pageW: number;
  pageD: number;
  hold(): void;
  release(): void;
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
  let held: HandSide | null = null;
  let pressedBy: HandSide | null = null;
  const at = new Vector3();
  const local = new Vector3();
  /** A fingertip on the button: within its edges (and a little over), and touching or nearly. */
  const onButton = (tip: Vector3, margin: number, height: number) => {
    root.worldToLocal(local.copy(tip));
    return Math.abs(local.x) < W / 2 + margin && Math.abs(local.y) < H / 2 + margin && local.z < height && local.z > -0.03;
  };

  return {
    root,
    setShown(on: boolean): void {
      root.visible = on;
      if (!on && (held || pressedBy)) {
        held = null;
        pressedBy = null;
        deps.release();
      }
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
    /** Pressed with a fingertip: held while the finger rests on it, let go when it lifts away. */
    frame(tips: Record<HandSide, Vector3 | null>): void {
      if (!root.visible) return;
      if (pressedBy) {
        const tip = tips[pressedBy];
        if (!tip || !onButton(tip, 0.02, 0.045)) {
          pressedBy = null;
          if (!held) deps.release();
        }
        return;
      }
      if (held) return;
      for (const side of ['right', 'left'] as const) {
        const tip = tips[side];
        if (tip && onButton(tip, 0.006, 0.022)) {
          pressedBy = side;
          console.info(`talk: pressed with ${side} fingertip`);
          deps.hold();
          return;
        }
      }
    },
    targets(): ExtraTarget[] {
      if (!root.visible) return [];
      face.getWorldPosition(at);
      return [
        {
          proxy: { id: 'talk-tab', position: { x: at.x, y: at.y, z: at.z }, radiusM: 0.042, reachUpM: REACH_UP_M },
          onGrab: (hand) => {
            if (pressedBy) return;
            held = hand;
            console.info(`talk: held with ${hand}`);
            deps.hold();
          },
          onRelease: () => {
            if (!held) return;
            held = null;
            deps.release();
          },
          onCancel: () => {
            if (!held) return;
            held = null;
            deps.release();
          },
        },
      ];
    },
  };
}
export type TalkTab = ReturnType<typeof createTalkTab>;
