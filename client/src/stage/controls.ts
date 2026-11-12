import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type Object3D, type Texture, type World } from '@iwsdk/core';
import { OVER_STACK, RIBBON_X_SHARE } from '../book/book-view.ts';
import type { BookView } from '../book/book-view.ts';
import type { Unfold } from '../show/cues.ts';
import type { PauseControl } from '../show/pause.ts';
import type { SoundEngine } from '../sound/engine.ts';
import { controlFold, dragCover } from './book-control.ts';
import { closestOn, createGestures, type GestureEvent, type HandFrame, type HandSide, type Proxy } from './gestures.ts';
import { RESIZE_NOTCH, resizeScale } from './resize.ts';

/** How fast the book finishes closing or opening after you let go: a full swing in 0.7 s. */
const SWING_PER_MS = 1 / 700;
const PROXY_RADIUS_M = 0.035;
const GLOW_M = 0.07;
/** Fingertips stop on the real table: a pinch up to this far above a target still takes it. */
const REACH_UP_M = 0.05;

export interface BookControls {
  /** How open your hands have the book, as hinge angles for `combineUnfold`. */
  fold(): Unfold;
  /** 0 lying flat, 1 lifted: the ribbon marks a pause. */
  ribbonLift(): number;
  /** Shuts the book at once and holds the story, for arriving again after leaving or a reload. */
  shut(): void;
  /** Swings it open; the story carries on once it's fully open. */
  reopen(): void;
  frame(frame: XRFrame, deltaMs: number, enabled: boolean, head: Vector3): void;
}

export interface ControlsDeps {
  world: World;
  stageRoot: Object3D;
  book: BookView;
  sound: SoundEngine;
  pause: PauseControl;
  glow: Texture;
  cards: number;
  onMoved(): void;
  /** The reader stretched the book to a new size. */
  onResized(scale: number): void;
}

function readHand(frame: XRFrame, source: XRInputSource, space: XRReferenceSpace): HandFrame | null {
  const hand = source.hand;
  if (!hand || !frame.getJointPose) return null;
  const thumb = hand.get('thumb-tip');
  const index = hand.get('index-finger-tip');
  const a = thumb && frame.getJointPose(thumb, space);
  const b = index && frame.getJointPose(index, space);
  if (!a || !b) return { tracked: false, pinchPoint: { x: 0, y: 0, z: 0 }, pinchGapM: 1 };
  const p = a.transform.position;
  const q = b.transform.position;
  return { tracked: true, pinchPoint: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2 }, pinchGapM: Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) };
}

/** The book is the only UI: shut the cover to pause, open it to resume, pinch the ribbon, slide it by the spine. */
export function createBookControls({ world, stageRoot, book, sound, pause, glow, cards, onMoved, onResized }: ControlsDeps): BookControls {
  const gestures = createGestures();
  let amount = 1;
  let target: number | null = null;
  let stable = 1;
  let ribbon = false;
  let ribbonLift = 0;
  const lost: Record<HandSide, boolean> = { left: false, right: false };
  let spineOffset: Vector3 | null = null;
  let coverGrab: { amount: number; angle: number } | null = null;
  let resize: { startScale: number; startDist: number; notch: number } | null = null;
  let lastHands: Record<HandSide, HandFrame | null> = { left: null, right: null };
  const local = new Vector3();
  const world3 = new Vector3();

  // A soft gold edge where a hand is near a control: every state is seen, since hands have no haptics.
  const haloLayer = new Group();
  haloLayer.renderOrder = OVER_STACK;
  world.scene.add(haloLayer);
  const halos = (['left', 'right'] as const).map(() => {
    const mesh = new Mesh(new PlaneGeometry(GLOW_M, GLOW_M), new MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, opacity: 0.55, toneMapped: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 60;
    mesh.visible = false;
    haloLayer.add(mesh);
    return mesh;
  });

  const [W, D] = [0.21, 0.315];
  const half = book.pageY;
  const at = (object: Object3D, x: number, y: number, z: number): Proxy['position'] => {
    world3.set(x, y, z);
    object.localToWorld(world3);
    return { x: world3.x, y: world3.y, z: world3.z };
  };
  const leftContent = book.leftHalf.children[0]!;

  function proxies(): Proxy[] {
    const scale = stageRoot.scale.x;
    const radius = Math.max(0.032, PROXY_RADIUS_M * scale);
    // The cover and the right page's fore-edge are whole edges: pinch anywhere along them.
    const edgeInset = D * 0.08;
    return [
      { id: 'cover', position: at(leftContent, -W, half, 0), radiusM: radius, reachUpM: REACH_UP_M, segment: { a: at(leftContent, -W, half, -D / 2 + edgeInset), b: at(leftContent, -W, half, D / 2 - edgeInset) } },
      { id: 'fore', position: at(book.root, W, half, 0), radiusM: radius, reachUpM: REACH_UP_M, segment: { a: at(book.root, W, half, -D / 2 + edgeInset), b: at(book.root, W, half, D / 2 - edgeInset) } },
      { id: 'spine', position: at(book.root, 0, half * 0.6, D / 2 + 0.01), radiusM: radius, reachUpM: REACH_UP_M },
      { id: 'ribbon', position: at(book.root, W * RIBBON_X_SHARE, half + 0.003, D / 2 - 0.012), radiusM: radius, reachUpM: REACH_UP_M },
    ];
  }

  function setAmount(next: number): void {
    amount = Math.max(0, Math.min(1, next));
    pause.set('book_closed', amount < 0.98);
  }

  const pinchGap = (): number | null => {
    const l = lastHands.left;
    const r = lastHands.right;
    if (!l?.tracked || !r?.tracked) return null;
    return Math.hypot(l.pinchPoint.x - r.pinchPoint.x, l.pinchPoint.y - r.pinchPoint.y, l.pinchPoint.z - r.pinchPoint.z);
  };

  /** One hand on each outer edge: a stretch, not a close. */
  function maybeStartResize(): void {
    const held = [gestures.held('left'), gestures.held('right')];
    if (resize || !held.includes('cover') || !held.includes('fore')) return;
    const gap = pinchGap();
    if (gap === null) return;
    target = stable = 1;
    setAmount(1);
    resize = { startScale: stageRoot.scale.x, startDist: gap, notch: Math.round(stageRoot.scale.x / RESIZE_NOTCH) };
    sound.play('rustle', stageRoot.position, undefined, 'ui');
  }

  function handle(event: GestureEvent, head: Vector3): void {
    if (resize && (event.kind === 'release' || event.kind === 'cancel') && (event.id === 'cover' || event.id === 'fore')) {
      resize = null;
      sound.play('settle', stageRoot.position, undefined, 'ui');
      onResized(stageRoot.scale.x);
      return;
    }
    if (resize && event.kind === 'drag') return;
    switch (event.kind) {
      case 'grab':
        sound.play('tap', stageRoot.position, undefined, 'ui');
        if (event.id === 'cover') {
          target = null;
          coverGrab = null;
          sound.play('rustle', stageRoot.position, undefined, 'ui');
          maybeStartResize();
        } else if (event.id === 'fore') {
          maybeStartResize();
        } else if (event.id === 'spine') {
          spineOffset = null;
        }
        break;
      case 'drag':
        if (event.id === 'cover') {
          // The hand's angle about the spine: lying open on the left is 1, laid over on the right is 0.
          local.set(event.point.x, event.point.y, event.point.z);
          book.root.worldToLocal(local);
          const angle = Math.atan2(Math.max(0, local.y - half), local.x);
          coverGrab ??= { amount, angle };
          setAmount(dragCover(coverGrab, angle));
        } else if (event.id === 'spine') {
          const hand = world3.set(event.point.x, stageRoot.position.y, event.point.z);
          spineOffset ??= stageRoot.position.clone().sub(hand);
          stageRoot.position.set(hand.x + spineOffset.x, stageRoot.position.y, hand.z + spineOffset.z);
        }
        break;
      case 'release':
        if (event.id === 'cover') {
          target = amount < 0.5 ? 0 : 1;
          stable = target;
          sound.play('cover', stageRoot.position, undefined, 'ui');
        } else if (event.id === 'spine') {
          stageRoot.rotation.y = Math.atan2(head.x - stageRoot.position.x, head.z - stageRoot.position.z);
          spineOffset = null;
          sound.play('settle', stageRoot.position, undefined, 'ui');
          onMoved();
        } else if (event.id === 'ribbon') {
          ribbon = !ribbon;
          pause.set('ribbon', ribbon);
          sound.play('felt', stageRoot.position, undefined, 'ui');
        }
        break;
      case 'cancel':
        // Tracking lost mid-gesture: back to where it last rested, and the show waits for your hand.
        lost[event.hand] = true;
        pause.set('hands_lost', true);
        if (event.id === 'cover') target = stable;
        spineOffset = null;
        break;
      case 'near':
        break;
    }
  }

  return {
    fold: () => controlFold(amount, cards),
    ribbonLift: () => ribbonLift,
    shut() {
      amount = 0;
      stable = 0;
      target = null;
      resize = null;
      pause.set('book_closed', true);
    },
    reopen() {
      stable = 1;
      target = 1;
      pause.set('book_closed', true);
    },
    frame(frame, deltaMs, enabled, head) {
      if (target !== null) {
        const step = deltaMs * SWING_PER_MS;
        setAmount(amount + Math.sign(target - amount) * Math.min(step, Math.abs(target - amount)));
        if (amount === target) target = null;
      }
      ribbonLift += ((ribbon ? 1 : 0) - ribbonLift) * Math.min(1, deltaMs / 120);
      for (const halo of halos) halo.visible = false;
      const space = world.xrReferenceSpace;
      if (!space) return;
      const hands: Record<HandSide, HandFrame | null> = { left: null, right: null };
      for (const source of frame.session.inputSources) {
        if (source.handedness === 'left' || source.handedness === 'right') hands[source.handedness] = readHand(frame, source, space);
      }
      for (const side of ['left', 'right'] as const) {
        if (lost[side] && hands[side]?.tracked) {
          lost[side] = false;
          if (!lost.left && !lost.right) pause.set('hands_lost', false);
        }
      }
      if (!enabled) return;
      lastHands = hands;
      const targets = proxies();
      const events = gestures.step(hands, targets);
      for (const event of events) {
        if (event.kind === 'near') {
          const halo = halos[event.hand === 'left' ? 0 : 1]!;
          const hand = hands[event.hand]!;
          const p = closestOn(targets.find((t) => t.id === event.id)!, hand.pinchPoint);
          halo.position.set(p.x, p.y + 0.002, p.z);
          halo.visible = true;
        }
        handle(event, head);
      }
      if (resize) {
        const gap = pinchGap();
        if (gap !== null) {
          const scale = resizeScale(resize.startScale, resize.startDist, gap);
          stageRoot.scale.setScalar(scale);
          const notch = Math.round(scale / RESIZE_NOTCH);
          if (notch !== resize.notch) {
            resize.notch = notch;
            sound.play('tap', stageRoot.position, undefined, 'ui');
          }
        }
      }
    },
  };
}
