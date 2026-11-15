import { AdditiveBlending, DoubleSide, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Quaternion, Vector3, type Texture } from '@iwsdk/core';
import type { ObjectDef } from '@tabletop/contracts';
import { cardMaterial } from '../paint/card-material.ts';
import type { TexRef } from '../paint/texref.ts';

/**
 * Every object on the stage, and the one place it is at any moment. Positions are in the book's
 * frame (x right, y up, +z toward the reader, metres at desk size), so they scale with the stage.
 * Handing over is the product's core feel, so the rules live here, plain and testable:
 * a character notices an object before you let go, and a release anywhere near takes.
 */

export type V3 = [number, number, number];

/** Shown only if it and everything it hangs from is shown (a closed drawer hides its whole tray). */
function shownInWorld(o: Object3D): boolean {
  for (let a: Object3D | null = o; a; a = a.parent) if (!a.visible) return false;
  return true;
}
export type HandSide = 'left' | 'right';

export type Home =
  | { kind: 'drawer' }
  /** On the page: standing, or lying flat turned by `lie` radians (a ladder laid across the gap). */
  | { kind: 'page'; at: V3; lie?: number }
  | { kind: 'table'; at: V3 }
  | { kind: 'hand'; side: HandSide }
  | { kind: 'paw'; cast: string }
  | { kind: 'worn'; cast: string }
  /** Back as the character's own carried light: the card hides and the puppet's part shows. */
  | { kind: 'carried'; cast: string }
  | { kind: 'satchel' }
  /** Tucked into a character's coat: carried, not shown. */
  | { kind: 'pocket'; cast: string }
  /** Left behind on another spread, or not yet on this one: not shown, not taken. */
  | { kind: 'away' }
  /** Placed by a crossing or a cue, which poses it every frame. */
  | { kind: 'posed' }
  /** Out in the reader's real room, on a place from the room map, nudged across it by `offset` metres (world x, z). */
  | { kind: 'room'; place: string; offset: [number, number] };

export interface ObjectState {
  id: string;
  home: Home;
  /** Handed over at least once this episode: it goes in the satchel at the end. */
  given: boolean;
  /** Could be picked up. */
  grabbable: boolean;
  /** You've had it in your hand at least once: it comes with you when the page turns. */
  touched?: boolean;
}

/** Where something should ease from, when its home changes with a little flight. */
interface Flight {
  from: Vector3;
  fromQuat: Quaternion;
  startMs: number;
  durMs: number;
  arc: number;
}

export interface Receiver {
  id: string;
  /** The paw, in world space. */
  grip: Object3D;
  /** Where things are worn. */
  body: Object3D;
}

export interface ObjectsDeps {
  defs: Map<string, ObjectDef>;
  textures: Map<string, TexRef>;
  /** The lit look for a carried light, by object id. */
  litArt: Map<string, TexRef>;
  /** Where a carried light glows on its own image, as fractions. */
  glowAt: Map<string, [number, number]>;
  bookRoot: Object3D;
  /** Draws behind the front card, and in front of it. */
  behind: Object3D;
  front: Object3D;
  /** In your hand or on your real table: drawn over the book, and still there when it shuts. */
  loose: Object3D;
  frontZ: number;
  pageY: number;
  glow: Texture;
  shadow: Texture;
  drawerAnchor(id: string): Object3D | null;
  satchelPocket: Object3D;
  /** The open spread's half extents. */
  page: { halfW: number; halfD: number };
}

export interface ObjectsView {
  states(): ObjectState[];
  get(id: string): ObjectState | undefined;
  /** Moves an object to a new home, easing there over `durMs` (0 jumps). Timed on the object system's own frame clock. */
  send(id: string, home: Home, nowMs: number, durMs?: number, arc?: number, from?: Vector3): void;
  /** Called every frame. `receivers` are the characters that can take things. */
  frame(nowMs: number, head: Vector3, receivers: Map<string, Receiver>, hands: Record<HandSide, Vector3 | null>, opts: { bookOpen: boolean; table: (book: Vector3) => Vector3; drawerOpen: boolean }): void;
  /** Poses a `posed` object directly, in the book's frame. */
  pose(id: string, at: V3, rotZ: number, lying: boolean, scale?: number): void;
  /** A carried light's glow while it's out of the paw, 0 to 1. */
  setGlow(id: string, glow: number): void;
  setVisible(id: string, visible: boolean): void;
  /** The book is shut or opening: things on the page fold away with it. */
  setPageShown(shown: boolean): void;
  /** For grabbing: each grabbable object's centre in world space and its size. */
  grabTargets(): Array<{ id: string; centre: Vector3; radius: number }>;
  /** World position of an object (where it's held or stands). */
  worldOf(id: string, target: Vector3): Vector3;
  /** World position of the middle of the object's painting. */
  centreOf(id: string, target: Vector3): Vector3;
  snapshot(): ObjectState[];
  restore(states: ObjectState[]): void;
  /** Something new, painted during the story: it joins the stage at `home`, like any other object. */
  add(def: ObjectDef, ref: TexRef, home: Home): void;
  /** Takes painted things away again (a new evening). */
  removeLive(): void;
  /** Where a room place's surface is in the world, for things out in the room. Null until the room is known. */
  setRoom(point: ((place: string) => Vector3 | null) | null): void;
}

const SHADOW_LIFT = 0.0007;
/** Out in your room a thing shows this tall (metres), so it can be found from across it; back on the book it's book-sized again. */
const ROOM_HEIGHT_M = 0.24;
const HELD_SCALE = 1.06;

export function createObjects(initial: ObjectState[], deps: ObjectsDeps): ObjectsView {
  const states = new Map(initial.map((s) => [s.id, { ...s }]));
  const views = new Map<string, { holder: Object3D; card: Mesh; lit: Mesh | null; glow: Mesh | null; shadow: Mesh; w: number; h: number; pivot: [number, number] }>();
  const flights = new Map<string, Flight>();
  const poses = new Map<string, { at: V3; rotZ: number; lying: boolean; scale: number }>();
  const glows = new Map<string, number>();
  const hidden = new Set<string>();
  let pageShown = true;
  let roomPoint: ((place: string) => Vector3 | null) | null = null;
  /** The object system's own clock: the last frame's time. Every flight is timed on it, whoever starts it. */
  let clockMs = 0;
  const tmp = new Vector3();
  const tmp2 = new Vector3();
  const quat = new Quaternion();

  const planeFor = (ref: TexRef, w: number, h: number) => {
    const g = new PlaneGeometry(w, h);
    const uv = g.getAttribute('uv');
    const [u0, v0, u1, v1] = ref.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
    uv.needsUpdate = true;
    return g;
  };

  /** Builds an object's card, glow and shadow from its painting. */
  const build = (id: string, def: ObjectDef, ref: TexRef): void => {
    const h = def.size.heightM;
    const w = (h * ref.sizePx[0]) / ref.sizePx[1];
    const holder = new Object3D();
    holder.name = `object:${id}`;
    const card = new Mesh(planeFor(ref, w, h), cardMaterial(ref.texture, { baked: ref.baked, doubleSided: true }));
    card.name = 'card';
    card.renderOrder = 400;
    holder.add(card);
    let lit: Mesh | null = null;
    const litRef = deps.litArt.get(id);
    if (litRef) {
      lit = new Mesh(planeFor(litRef, w, h), cardMaterial(litRef.texture, { baked: litRef.baked, doubleSided: true }));
      lit.name = 'lit';
      lit.renderOrder = 401;
      lit.visible = false;
      card.add(lit);
    }
    let glow: Mesh | null = null;
    const glowAt = deps.glowAt.get(id);
    if (glowAt) {
      glow = new Mesh(new PlaneGeometry(h * 2.4, h * 2.4), new MeshBasicMaterial({ map: deps.glow, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false, side: DoubleSide, opacity: 0 }));
      glow.name = 'glow';
      glow.position.set(w * (glowAt[0] - 0.5), h * (0.5 - glowAt[1]), 0.002);
      glow.renderOrder = 402;
      card.add(glow);
    }
    const shadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: deps.shadow, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.55 }));
    shadow.name = `shadow:${id}`;
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = -1;
    deps.bookRoot.add(shadow);
    views.set(id, { holder, card, lit, glow, shadow, w, h, pivot: [def.pivot[0] / 100, def.pivot[1] / 100] });
  };

  for (const state of states.values()) {
    const def = deps.defs.get(state.id) ?? [...deps.defs.values()].find((d) => d.id === state.id);
    if (!def || def.art.kind !== 'asset') continue;
    const ref = deps.textures.get(def.art.path);
    if (!ref) throw new Error(`${def.art.path} was not loaded`);
    build(state.id, def, ref);
  }

  /** The card's offset from its holder: standing on its base, centred, or held at its pivot. */
  const mount = (id: string, how: 'base' | 'centre' | 'pivot') => {
    const v = views.get(id)!;
    if (how === 'base') v.card.position.set(0, v.h / 2, 0);
    else if (how === 'centre') v.card.position.set(0, 0, 0);
    else v.card.position.set(-v.w * (v.pivot[0] - 0.5), -v.h * (0.5 - v.pivot[1]), 0);
  };

  const parentFor = (state: ObjectState, receivers: Map<string, Receiver>): Object3D | null => {
    const home = state.home;
    switch (home.kind) {
      case 'drawer':
        return deps.drawerAnchor(state.id);
      case 'paw':
        return receivers.get(home.cast)?.grip ?? null;
      case 'worn':
        return receivers.get(home.cast)?.body ?? null;
      case 'satchel':
        return deps.satchelPocket;
      case 'pocket':
      case 'away':
        return deps.loose;
      case 'page':
      case 'posed':
        return (home.kind === 'page' ? home.at[2] : (poses.get(state.id)?.at[2] ?? 0)) > deps.frontZ ? deps.front : deps.behind;
      default:
        return deps.loose;
    }
  };

  const reparent = (holder: Object3D, parent: Object3D) => {
    if (holder.parent === parent) return;
    if (holder.parent) parent.attach(holder);
    else parent.add(holder);
  };

  /** Things painted during the story. */
  const live = new Set<string>();
  const view: ObjectsView = {
    states: () => [...states.values()],
    get: (id) => states.get(id),
    send(id, home, _nowMs, durMs = 0, arc = 0, from) {
      const state = states.get(id);
      const v = views.get(id);
      if (!state || !v) return;
      const wasShown = !!v.holder.parent && state.home.kind !== 'carried';
      state.home = home;
      if (durMs > 0 && (from || wasShown)) {
        flights.set(id, { from: from?.clone() ?? v.holder.getWorldPosition(new Vector3()), fromQuat: v.holder.getWorldQuaternion(new Quaternion()), startMs: clockMs, durMs, arc });
      } else flights.delete(id);
    },
    pose(id, at, rotZ, lying, scale = 1) {
      poses.set(id, { at, rotZ, lying, scale });
    },
    setGlow(id, glow) {
      glows.set(id, glow);
    },
    setVisible(id, visible) {
      if (visible) hidden.delete(id);
      else hidden.add(id);
    },
    setPageShown(shown) {
      pageShown = shown;
    },
    grabTargets() {
      const out: Array<{ id: string; centre: Vector3; radius: number }> = [];
      for (const state of states.values()) {
        const v = views.get(state.id)!;
        if (!state.grabbable || !shownInWorld(v.holder) || flights.has(state.id)) continue;
        if (!['drawer', 'page', 'table', 'satchel', 'room'].includes(state.home.kind)) continue;
        const centre = v.card.getWorldPosition(new Vector3());
        v.card.getWorldScale(tmp);
        out.push({ id: state.id, centre, radius: Math.max(0.032, (Math.max(v.w, v.h) / 2) * tmp.y * 0.8) });
      }
      return out;
    },
    worldOf(id, target) {
      return views.get(id)?.holder.getWorldPosition(target) ?? target;
    },
    centreOf(id, target) {
      return views.get(id)?.card.getWorldPosition(target) ?? target;
    },
    frame(nowMs, head, receivers, hands, opts) {
      clockMs = nowMs;
      for (const state of states.values()) {
        const v = views.get(state.id)!;
        const home = state.home;
        const parent = parentFor(state, receivers);
        const show = !hidden.has(state.id) && parent !== null && home.kind !== 'carried' && home.kind !== 'pocket' && home.kind !== 'away';
        v.holder.visible = show && (pageShown || home.kind === 'table' || home.kind === 'hand' || home.kind === 'satchel' || home.kind === 'room');
        v.shadow.visible = false;
        if (!parent) continue;
        reparent(v.holder, parent);
        v.holder.scale.setScalar(1);
        v.holder.rotation.set(0, 0, 0);
        v.holder.position.set(0, 0, 0);
        v.card.rotation.set(0, 0, 0);
        let surfaceY: number | null = null;
        /** How much bigger than book-size it's drawn, for its shadow. */
        let size = 1;
        switch (home.kind) {
          case 'drawer':
            mount(state.id, 'centre');
            break;
          case 'paw':
            mount(state.id, 'pivot');
            break;
          case 'worn':
            mount(state.id, 'centre');
            v.holder.position.set(0, 0.62 * (receivers.get(home.cast)?.body.userData.heightM ?? 0.17), 0.012);
            v.card.rotation.z = Math.PI / 2;
            v.holder.scale.setScalar(0.8);
            break;
          case 'satchel': {
            mount(state.id, 'base');
            const index = [...states.values()].filter((s) => s.home.kind === 'satchel').findIndex((s) => s.id === state.id);
            v.holder.position.set(-0.03 + 0.016 * index, 0, -0.001 * index);
            v.holder.scale.setScalar(0.62);
            break;
          }
          case 'page':
            if (home.lie !== undefined) {
              mount(state.id, 'centre');
              v.holder.position.set(home.at[0], deps.pageY + 0.003, home.at[2]);
              v.card.rotation.set(-Math.PI / 2, 0, home.lie);
            } else {
              mount(state.id, 'base');
              v.holder.position.set(home.at[0], deps.pageY + 0.0006, home.at[2]);
            }
            surfaceY = deps.pageY;
            break;
          case 'table':
            mount(state.id, 'base');
            v.holder.position.set(home.at[0], home.at[1] + 0.0006, home.at[2]);
            surfaceY = home.at[1];
            break;
          case 'posed': {
            const p = poses.get(state.id);
            mount(state.id, p?.lying ? 'centre' : 'base');
            if (p) {
              v.holder.position.set(p.at[0], p.at[1], p.at[2]);
              v.card.rotation.z = p.rotZ;
              if (p.lying) v.card.rotation.x = -Math.PI / 2;
              v.holder.scale.setScalar(p.scale);
              surfaceY = deps.pageY;
            }
            break;
          }
          case 'hand': {
            mount(state.id, 'pivot');
            const at = hands[home.side];
            if (at) {
              tmp.copy(at);
              deps.loose.worldToLocal(tmp);
              v.holder.position.copy(tmp);
            }
            v.holder.scale.setScalar(HELD_SCALE);
            const below = opts.table(v.holder.getWorldPosition(tmp2).clone());
            deps.bookRoot.worldToLocal(below);
            surfaceY = below.y;
            break;
          }
          case 'room': {
            mount(state.id, 'base');
            const at = roomPoint?.(home.place) ?? null;
            if (!at) {
              v.holder.visible = false;
              break;
            }
            at.x += home.offset[0];
            at.z += home.offset[1];
            // Big enough to find across the room, nearer its own size close by (a bottle at your feet).
            const near = Math.max(0.35, Math.min(1, at.distanceTo(head) / 2.5));
            surfaceY = deps.bookRoot.worldToLocal(at.clone()).y;
            v.holder.position.copy(deps.loose.worldToLocal(at));
            size = Math.max(1, (ROOM_HEIGHT_M * near) / (v.h * (deps.loose.getWorldScale(tmp2).y || 1)));
            v.holder.scale.setScalar(size);
            break;
          }
          case 'carried':
            break;
        }
        // Standing things turn to face you, as the characters do. Things in a paw turn with the paw.
        if ((home.kind === 'page' && home.lie === undefined) || home.kind === 'table' || home.kind === 'room' || home.kind === 'hand' || (home.kind === 'posed' && !poses.get(state.id)?.lying)) {
          v.holder.getWorldPosition(tmp);
          const dx = head.x - tmp.x;
          const dz = head.z - tmp.z;
          const parentQuat = (v.holder.parent ?? deps.bookRoot).getWorldQuaternion(quat);
          const yaw = Math.atan2(dx, dz);
          const parentYaw = 2 * Math.atan2(parentQuat.y, parentQuat.w);
          v.holder.rotation.y = yaw - parentYaw;
        }
        // A flight eases from where it was to its new home, in world space, then hands over to the home.
        const flight = flights.get(state.id);
        if (flight) {
          const t = Math.max(0, Math.min(1, (nowMs - flight.startMs) / flight.durMs));
          if (t >= 1) flights.delete(state.id);
          else {
            const e = t * t * (3 - 2 * t);
            const target = v.holder.getWorldPosition(new Vector3());
            const at = flight.from.clone().lerp(target, e);
            at.y += flight.arc * Math.sin(Math.PI * t);
            v.holder.parent!.worldToLocal(at);
            v.holder.position.copy(at);
          }
        }
        // The glow of a light carried in your hand.
        const g = glows.get(state.id) ?? 0;
        if (v.glow) {
          (v.glow.material as MeshBasicMaterial).opacity = 0.6 * g * (0.92 + 0.08 * Math.sin(nowMs / 90));
          v.glow.visible = g > 0.01;
        }
        if (v.lit) v.lit.visible = g > 0.55;
        // A contact shadow on whatever is below, wider and fainter as it lifts.
        if (surfaceY !== null && v.holder.visible) {
          const p = v.holder.getWorldPosition(tmp);
          deps.bookRoot.worldToLocal(p);
          const lift = Math.max(0, p.y - surfaceY);
          const spread = 1 + Math.min(1.2, lift * 9);
          v.shadow.visible = true;
          v.shadow.position.set(p.x, surfaceY + SHADOW_LIFT, p.z);
          v.shadow.scale.set(v.w * size * 1.2 * spread, Math.min(v.w * size, 0.04 * size) * 0.9 * spread, 1);
          (v.shadow.material as MeshBasicMaterial).opacity = 0.5 / spread;
        }
      }
    },
    snapshot: () => [...states.values()].map((s) => structuredClone(s)),
    restore(list) {
      for (const s of list) {
        if (!states.has(s.id)) continue;
        const copy = structuredClone(s);
        // A hand isn't held across a reload: what you were holding waits in your satchel.
        if (copy.home.kind === 'hand') {
          copy.home = { kind: 'satchel' };
          copy.touched = true;
        }
        states.set(s.id, copy);
      }
      flights.clear();
    },
    add(def, ref, home) {
      if (views.has(def.id)) return;
      live.add(def.id);
      // Painted for you: yours, so a page turn carries it along to your satchel rather than leaving it behind.
      states.set(def.id, { id: def.id, home, given: false, grabbable: true, touched: true });
      build(def.id, def, ref);
    },
    setRoom(point) {
      roomPoint = point;
    },
    removeLive() {
      for (const id of live) {
        const v = views.get(id);
        if (v) {
          v.holder.removeFromParent();
          v.shadow.removeFromParent();
          (v.card.material as MeshBasicMaterial).map?.dispose();
          v.card.geometry.dispose();
        }
        views.delete(id);
        states.delete(id);
        flights.delete(id);
      }
      live.clear();
    },
  };
  return view;
}
