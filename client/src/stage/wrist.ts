import { DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, TextureLoader, Vector3, type Object3D } from '@iwsdk/core';
import { Text } from 'troika-three-text';
import captionFont from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-500-normal.woff?url';
import type { SoundEngine } from '../sound/engine.ts';

/**
 * Stop the show, from your wrist: a small painted tag on the back of your left wrist, like a watch.
 * It shows only when the back of that hand faces you, never palm-up, so it stays clear of the
 * system's own palm-pinch gesture. Pinch it with the other hand and three paper tags fan out:
 * pause (or carry on), start this chapter again, and put the book away.
 */

const INK = '#2B2420';
const GOLD = '#D4A23E';
/** How squarely the back of the hand must face you before the tag shows (cosine). */
const FACING_ON = 0.55;
const FACING_OFF = 0.35;
/** A pinch this close takes the tag or a choice (64 mm targets). */
const TAKE_M = 0.032;
const NEAR_M = 0.06;
/** Open and untouched this long, the tags fold away by themselves. */
const IDLE_CLOSE_MS = 8000;
const TAG_W = 0.078;
const TAG_H = 0.022;
const TAG_GAP = 0.027;

export type WristChoice = 'pause' | 'resume' | 'restart' | 'away';

export interface WristDeps {
  parent: Object3D;
  sound: SoundEngine;
  /** Is the story held by the ribbon right now? Decides "Pause" or "Carry on". */
  paused(): boolean;
  choose(choice: WristChoice): void;
}

interface Choice {
  id: WristChoice;
  label: string;
  card: Group;
  text: Text;
  rule: Mesh;
}

const PINCH_ON_M = 0.015;
const PINCH_OFF_M = 0.03;

export function createWristMenu(deps: WristDeps) {
  const loader = new TextureLoader();
  const load = (path: string) => {
    const t = loader.load(path);
    t.colorSpace = SRGBColorSpace;
    return t;
  };
  const paper = load('./art/book/paper-tag.png');
  const gold = load('./art/book/tab-gold.png');

  const root = new Group();
  root.name = 'wrist-menu';
  root.visible = false;
  deps.parent.add(root);

  // The tag on the wrist: the book's own gold tab, small.
  const tag = new Mesh(new PlaneGeometry(0.034, 0.019), new MeshBasicMaterial({ map: gold, transparent: true, side: DoubleSide, toneMapped: false, depthTest: true }));
  tag.name = 'wrist-tag';
  root.add(tag);

  const fan = new Group();
  fan.visible = false;
  root.add(fan);
  // A thin gold thread the tags hang on, from the wrist tag up.
  const thread = new Mesh(new PlaneGeometry(0.0012, 1), new MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.8, toneMapped: false }));
  fan.add(thread);

  const makeChoice = (id: WristChoice, label: string, index: number): Choice => {
    const card = new Group();
    const sheet = new Mesh(new PlaneGeometry(TAG_W, TAG_H), new MeshBasicMaterial({ map: paper, transparent: true, side: DoubleSide, toneMapped: false }));
    card.add(sheet);
    const text = new Text();
    text.text = label;
    text.font = captionFont;
    text.fontSize = 0.0095;
    text.color = INK;
    text.anchorX = 'center';
    text.anchorY = 'middle';
    text.position.z = 0.0005;
    text.sync();
    card.add(text);
    const rule = new Mesh(new PlaneGeometry(TAG_W * 0.62, 0.0013), new MeshBasicMaterial({ color: GOLD, transparent: true, toneMapped: false }));
    rule.position.set(0, -0.0072, 0.0006);
    rule.visible = false;
    card.add(rule);
    card.position.y = 0.03 + index * TAG_GAP;
    fan.add(card);
    return { id, label, card, text, rule };
  };
  const choices = [makeChoice('pause', 'Pause', 0), makeChoice('restart', 'Start this chapter again', 1), makeChoice('away', 'Put the book away', 2)];
  thread.scale.y = 0.03 + 2 * TAG_GAP;
  thread.position.set(0, (0.03 + 2 * TAG_GAP) / 2 - 0.004, -0.0005);

  let shown = false;
  let open = false;
  let openedAt = 0;
  let lastNearAt = 0;
  let pinched = false;
  let near: string | null = null;
  const wrist = new Vector3();
  const dorsal = new Vector3();
  const toHead = new Vector3();
  const scratch = new Vector3();

  const worldOf = (o: Object3D) => o.getWorldPosition(new Vector3());

  function setOpen(on: boolean, at: Vector3): void {
    if (open === on) return;
    open = on;
    fan.visible = on;
    if (on) {
      openedAt = performance.now();
      lastNearAt = openedAt;
      const label = deps.paused() ? 'Carry on' : 'Pause';
      const first = choices[0]!;
      first.id = deps.paused() ? 'resume' : 'pause';
      if (first.text.text !== label) {
        first.text.text = label;
        first.text.sync();
      }
    }
    deps.sound.play(on ? 'page' : 'fold', at, undefined, 'ui');
  }

  return {
    /** True while the tags are open, so the rest of the hands leave the right hand alone. */
    get open() {
      return open;
    },
    frame(frame: XRFrame, space: XRReferenceSpace, head: Vector3): void {
      let left: XRHand | null = null;
      let right: XRHand | null = null;
      for (const source of frame.session.inputSources) {
        if (source.handedness === 'left' && source.hand) left = source.hand;
        if (source.handedness === 'right' && source.hand) right = source.hand;
      }
      const pose = (hand: XRHand | null, joint: XRHandJoint) => {
        const space2 = hand?.get(joint);
        return space2 && frame.getJointPose ? frame.getJointPose(space2, space) : null;
      };
      const w = pose(left, 'wrist');
      if (!w) {
        root.visible = false;
        shown = false;
        if (open) setOpen(false, wrist);
        return;
      }
      const { position: p, orientation: q } = w.transform;
      const rot = new Quaternion(q.x, q.y, q.z, q.w);
      wrist.set(p.x, p.y, p.z);
      // A joint's +Y points out of the back of the hand.
      dorsal.set(0, 1, 0).applyQuaternion(rot);
      toHead.copy(head).sub(wrist).normalize();
      const facing = dorsal.dot(toHead);
      shown = shown ? facing > FACING_OFF : facing > FACING_ON;
      if (!shown && open && performance.now() - openedAt > 400) setOpen(false, wrist);
      root.visible = shown || open;
      if (!root.visible) return;

      // On the back of the wrist, just toward the forearm, facing you, upright.
      const along = new Vector3(0, 0, -1).applyQuaternion(rot);
      root.position.copy(wrist).addScaledVector(dorsal, 0.016).addScaledVector(along, -0.012);
      if (root.parent) root.parent.worldToLocal(root.position);
      root.lookAt(head);

      // The other hand's pinch.
      const thumb = pose(right, 'thumb-tip');
      const index = pose(right, 'index-finger-tip');
      let point: Vector3 | null = null;
      if (thumb && index) {
        const a = thumb.transform.position;
        const b = index.transform.position;
        point = scratch.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        const gap = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        const wasPinched = pinched;
        pinched = pinched ? gap < PINCH_OFF_M : gap < PINCH_ON_M;
        const closing = pinched && !wasPinched;
        const tagAt = worldOf(tag);
        const nearTag = point.distanceTo(tagAt) < NEAR_M;
        (tag.material as MeshBasicMaterial).color.setScalar(nearTag && !open ? 1.25 : 1);
        tag.scale.setScalar(nearTag && !open ? 1.12 : 1);
        if (!open && closing && point.distanceTo(tagAt) < TAKE_M) {
          setOpen(true, tagAt);
          return;
        }
        if (open) {
          let best: Choice | null = null;
          let bestD = TAKE_M;
          for (const c of choices) {
            const d = point.distanceTo(worldOf(c.card));
            if (d < bestD) {
              best = c;
              bestD = d;
            }
          }
          if (best) lastNearAt = performance.now();
          if ((best?.id ?? null) !== near) {
            near = best?.id ?? null;
            for (const c of choices) {
              c.rule.visible = c === best;
              c.card.scale.setScalar(c === best ? 1.06 : 1);
            }
            if (best) deps.sound.play('tap', worldOf(best.card), undefined, 'ui');
          }
          if (best && closing) {
            deps.sound.play('felt', worldOf(best.card), undefined, 'ui');
            setOpen(false, wrist);
            deps.choose(best.id);
            return;
          }
          if (closing && !best && point.distanceTo(tagAt) < TAKE_M) setOpen(false, tagAt);
        }
      } else pinched = false;
      if (open && performance.now() - lastNearAt > IDLE_CLOSE_MS) setOpen(false, wrist);
    },
  };
}
export type WristMenu = ReturnType<typeof createWristMenu>;
