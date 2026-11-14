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
  const gold = loader.load('./art/book/tab-gold.png');
  gold.colorSpace = SRGBColorSpace;
  const paper = loader.load('./art/book/paper-tag.png');
  paper.colorSpace = SRGBColorSpace;

  const root = new Object3D();
  root.name = 'talk-tab';
  root.visible = false;
  // On the right page's near edge, left of the ribbon, lying flat.
  root.position.set(deps.pageW * 0.58, deps.pageY + 0.002, deps.pageD / 2 - 0.016);
  root.rotation.x = -Math.PI / 2;
  deps.bookRoot.add(root);

  const tabMaterial = new MeshBasicMaterial({ map: gold, transparent: true, side: DoubleSide, toneMapped: false });
  const tab = new Mesh(new PlaneGeometry(0.04, 0.0225), tabMaterial);
  tab.renderOrder = 500;
  root.add(tab);
  const scrap = new Mesh(new PlaneGeometry(0.062, 0.016), new MeshBasicMaterial({ map: paper, transparent: true, side: DoubleSide, toneMapped: false }));
  scrap.position.set(0, -0.021, 0.0004);
  scrap.renderOrder = 501;
  root.add(scrap);
  const label = new Text();
  label.text = 'Hold to talk';
  label.font = captionFont;
  label.fontSize = 0.0085;
  label.color = INK;
  label.anchorX = 'center';
  label.anchorY = 'middle';
  label.position.z = 0.0005;
  label.sync();
  scrap.add(label);

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
      const lift = next === 'idle' ? 0 : 0.006;
      tab.position.z = lift;
      tab.scale.setScalar(next === 'listening' ? 1.12 : 1);
      tabMaterial.color.setScalar(next === 'listening' ? 1.35 : next === 'opening' ? 1.1 : 1);
      label.text = next === 'listening' ? 'Listening… let go when done' : next === 'opening' ? 'Wait for the glow…' : next === 'sending' ? 'Sending…' : 'Hold to talk';
      label.sync();
    },
    get state() {
      return state;
    },
    targets(): ExtraTarget[] {
      if (!root.visible) return [];
      tab.getWorldPosition(at);
      return [
        {
          proxy: { id: 'talk-tab', position: { x: at.x, y: at.y, z: at.z }, radiusM: 0.032, reachUpM: REACH_UP_M },
          onGrab: (hand) => {
            held = hand;
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
