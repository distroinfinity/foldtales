import { DoubleSide, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, SRGBColorSpace, TextureLoader, Vector3 } from '@iwsdk/core';
import { Text } from 'troika-three-text';
import captionFont from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-500-normal.woff?url';
import type { ExtraTarget } from './controls.ts';
import type { HandSide } from './gestures.ts';

/**
 * The AI Storyteller's "Hold to talk": the book's gold tab, lying at the near edge of the right
 * page beside the ribbon, with the words printed on a scrap of the page. Pinch and hold it to
 * talk; it lifts while you hold, and glows once it's really listening; let go when you're done.
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
  const loader = new TextureLoader();
  const paper = loader.load('./art/book/paper-tag.png');
  paper.colorSpace = SRGBColorSpace;

  const root = new Object3D();
  root.name = 'talk-tab';
  root.visible = false;
  // On the right page's near edge, left of the ribbon, standing up toward you a little like a pop-up tab.
  root.position.set(deps.pageW * 0.55, deps.pageY + 0.004, deps.pageD / 2 - 0.02);
  root.rotation.x = -Math.PI / 2 + 0.6;
  deps.bookRoot.add(root);

  // One button: a piece of the book's paper with a gold rim, and the words printed on it.
  const W = 0.078;
  const H = 0.03;
  const rimMaterial = new MeshBasicMaterial({ color: '#D4A23E', transparent: true, opacity: 0.85, side: DoubleSide, toneMapped: false });
  const rim = new Mesh(new PlaneGeometry(W + 0.005, H + 0.005), rimMaterial);
  rim.renderOrder = 500;
  root.add(rim);
  const face = new Mesh(new PlaneGeometry(W, H), new MeshBasicMaterial({ map: paper, side: DoubleSide, toneMapped: false }));
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
  const at = new Vector3();

  return {
    root,
    setShown(on: boolean): void {
      root.visible = on;
      if (!on && held) {
        held = null;
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
    targets(): ExtraTarget[] {
      if (!root.visible) return [];
      face.getWorldPosition(at);
      return [
        {
          proxy: { id: 'talk-tab', position: { x: at.x, y: at.y, z: at.z }, radiusM: 0.042, reachUpM: REACH_UP_M },
          onGrab: (hand) => {
            held = hand;
            console.info(`talk: held with ${hand}`);
            deps.hold();
          },
          onRelease: () => {
            held = null;
            deps.release();
          },
          onCancel: () => {
            held = null;
            deps.release();
          },
        },
      ];
    },
  };
}
export type TalkTab = ReturnType<typeof createTalkTab>;
