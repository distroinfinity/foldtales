import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3, type Object3D, type Texture, type World } from '@iwsdk/core';
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

/** Anything else the hands can take: objects, the drawer pull, the page's edge, characters. */
export interface ExtraTarget {
  proxy: Proxy;
  onGrab?(hand: HandSide, point: Vector3): void;
  onDrag?(hand: HandSide, point: Vector3): void;
  onRelease?(hand: HandSide, point: Vector3): void;
  onCancel?(hand: HandSide): void;
  /** A soft gold edge shows where a hand is near. False for things that show it themselves. */
  halo?: boolean;
  /** A book control this one takes the place of while it's offered (the page's edge over the fore-edge). */
  replaces?: string;
}

export interface BookControls {
  /** How open your hands have the book, as hinge angles for `combineUnfold`. */
  fold(): Unfold;
  /** 0 lying flat, 1 lifted: the ribbon marks a pause. */
  ribbonLift(): number;
  /** Shuts the book at once and holds the story, for arriving again after leaving or a reload. */
  shut(): void;
  /** Swings it open; the story carries on once it's fully open. */
  reopen(): void;
  /** Swings it shut, as if your hand closed it. */
  close(): void;
  /** Lays the ribbon back down and lets the show go, as when a chapter starts again. */
  lowerRibbon(): void;
  /** How open your hands have it, 0 to 1. */
  readonly amount: number;
  frame(frame: XRFrame, deltaMs: number, enabled: boolean, head: Vector3): void;
  /** Each tracked hand's pinch point, in world space. */
  pinchPoint(side: HandSide): Vector3 | null;
  /** What each hand holds, by target id. */
  holding(side: HandSide): string | null;
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
  /** Everything else the hands can take, asked for each frame. */
  extras?: () => ExtraTarget[];
  /** VR Glasses: look at a target and pinch. Called with the gaze ray in world space. */
  onGazeSelect?: (origin: Vector3, direction: Vector3) => void;
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
export function createBookControls({ world, stageRoot, book, sound, pause, glow, cards, onMoved, onResized, extras, onGazeSelect }: ControlsDeps): BookControls {
  /** The gaze ray, if this device has one (VR Glasses, or the glasses emulator). */
  const gaze = { origin: new Vector3(), direction: new Vector3(), valid: false };
  let listening: XRSession | null = null;
  let extraTargets: ExtraTarget[] = [];
  let enabledNow = false;
  const grabbedThisPinch: Record<HandSide, boolean> = { left: false, right: false };
  const pinch: Record<HandSide, Vector3 | null> = { left: null, right: null };
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

  /** What each hand took, kept until it lets go: a held object is no longer a target, but its release still matters. */
  const heldExtra: Record<HandSide, ExtraTarget | null> = { left: null, right: null };

  function handleExtra(event: GestureEvent): boolean {
    const extra = (heldExtra[event.hand]?.proxy.id === event.id ? heldExtra[event.hand] : null) ?? extraTargets.find((t) => t.proxy.id === event.id);
    if (!extra) return false;
    if (event.kind === 'grab') heldExtra[event.hand] = extra;
    if (event.kind === 'release' || event.kind === 'cancel') heldExtra[event.hand] = null;
    const p = pinch[event.hand] ?? new Vector3();
    if (event.kind === 'grab') extra.onGrab?.(event.hand, p);
    else if (event.kind === 'drag') extra.onDrag?.(event.hand, p);
    else if (event.kind === 'release') extra.onRelease?.(event.hand, p);
    else if (event.kind === 'cancel') {
      extra.onCancel?.(event.hand);
      lost[event.hand] = true;
      pause.set('hands_lost', true);
    }
    return true;
  }

  function handle(event: GestureEvent, head: Vector3): void {
    if (event.kind === 'grab') grabbedThisPinch[event.hand] = true;
    if (handleExtra(event)) return;
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
    pinchPoint: (side) => pinch[side],
    holding: (side) => gestures.held(side),
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
    close() {
      stable = 0;
      target = 0;
    },
    lowerRibbon() {
      ribbon = false;
      pause.set('ribbon', false);
    },
    get amount() {
      return amount;
    },
    frame(frame, deltaMs, enabled, head) {
      enabledNow = enabled;
      if (target !== null) {
        const step = deltaMs * SWING_PER_MS;
        setAmount(amount + Math.sign(target - amount) * Math.min(step, Math.abs(target - amount)));
        if (amount === target) target = null;
      }
      ribbonLift += ((ribbon ? 1 : 0) - ribbonLift) * Math.min(1, deltaMs / 120);
      for (const halo of halos) halo.visible = false;
      const space = world.xrReferenceSpace;
      if (!space) return;
      // Gaze and pinch: the session's select on the gaze source picks what you're looking at.
      gaze.valid = false;
      for (const source of frame.session.inputSources) {
        if (source.targetRayMode !== 'gaze') continue;
        const pose = frame.getPose(source.targetRaySpace, space);
        if (!pose) continue;
        const { position: p, orientation: q } = pose.transform;
        gaze.origin.set(p.x, p.y, p.z);
        gaze.direction.set(0, 0, -1).applyQuaternion(new Quaternion(q.x, q.y, q.z, q.w));
        gaze.valid = true;
      }
      if (listening !== frame.session && onGazeSelect) {
        listening = frame.session;
        // The pinch arrives on the gaze source, or (in the glasses emulator) on the pinching hand. A hand's
        // pinch counts only if it didn't take hold of something within reach, so a near grab never also fires at what you look at.
        frame.session.addEventListener('selectstart', (event) => {
          const side = event.inputSource.handedness;
          if (side === 'left' || side === 'right') grabbedThisPinch[side] = false;
        });
        frame.session.addEventListener('select', (event) => {
          if (!gaze.valid || !enabledNow) return;
          const side = event.inputSource.handedness;
          const fromHand = side === 'left' || side === 'right';
          if (event.inputSource.targetRayMode === 'gaze' || (fromHand && !grabbedThisPinch[side])) onGazeSelect(gaze.origin.clone(), gaze.direction.clone());
        });
      }
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
      for (const side of ['left', 'right'] as const) {
        const h = hands[side];
        pinch[side] = h?.tracked ? (pinch[side] ?? new Vector3()).set(h.pinchPoint.x, h.pinchPoint.y, h.pinchPoint.z) : null;
      }
      if (!enabled) return;
      lastHands = hands;
      extraTargets = extras?.() ?? [];
      const replaced = new Set(extraTargets.flatMap((t) => (t.replaces ? [t.replaces] : [])));
      const targets = [...proxies().filter((p) => !replaced.has(p.id)), ...extraTargets.map((t) => t.proxy)];
      const events = gestures.step(hands, targets);
      for (const event of events) {
        if (event.kind === 'near') {
          if (extraTargets.find((t) => t.proxy.id === event.id)?.halo === false) continue;
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
