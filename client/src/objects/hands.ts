import { Vector3, type Object3D } from '@iwsdk/core';
import type { BookView } from '../book/book-view.ts';
import type { DrawerView } from '../book/drawer-view.ts';
import type { SatchelView } from '../book/satchel-view.ts';
import type { ShowRuntime } from '../show/runtime.ts';
import type { SoundEngine } from '../sound/engine.ts';
import type { ExtraTarget } from '../stage/controls.ts';
import type { HandSide, Home, ObjectsView } from './objects.ts';

/** A character notices what you hold from this far, and takes it if you let go within the nearer distance. Desk-size metres. */
export const NOTICE_M = 0.17;
export const GIVE_M = 0.105;
/** Fingertips stop on the real table: everything can be taken from up to this far above it. */
const REACH_UP_M = 0.05;
const TARGET_M = 0.032;

export interface HandsDeps {
  objects: ObjectsView;
  runtime: ShowRuntime;
  book: BookView;
  drawer: DrawerView;
  satchel: SatchelView;
  stageRoot: Object3D;
  sound: SoundEngine;
  /** The characters' paws and where they stand, by id. */
  grips: () => Map<string, Object3D>;
  /** The scanned table's outline in world space, if there is one. */
  table: () => Array<{ x: number; z: number }> | null;
  /** Read it again. */
  onReadAgain(): void;
  endPage: { readAgain: Object3D; setNear(near: boolean): void };
}

const v = (o: Object3D) => o.getWorldPosition(new Vector3());

function insidePolygon(x: number, z: number, polygon: Array<{ x: number; z: number }>): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) hit = !hit;
  }
  return hit;
}

function nearestOnPolygon(x: number, z: number, polygon: Array<{ x: number; z: number }>): { x: number; z: number } {
  let best = { x, z };
  let bestD = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]!;
    const b = polygon[i]!;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz || 1)));
    const p = { x: a.x + abx * t, z: a.z + abz * t };
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Where something you let go of comes to rest: in the satchel or the drawer if it's over them,
 * on the page if it's over the open book, otherwise straight down onto your table, and never past
 * its edge. Nothing is ever left hanging in the air.
 */
export function restingHome(world: Vector3, deps: Pick<HandsDeps, 'book' | 'drawer' | 'satchel' | 'stageRoot' | 'table'>, bookOpen: boolean, objectId?: string): Home {
  const scale = deps.stageRoot.scale.x || 1;
  // Anywhere over the satchel drops in: its mouth is small, and a hand shouldn't have to aim for it.
  const overSatchel = deps.satchel.root.worldToLocal(world.clone());
  if (Math.abs(overSatchel.x) < 0.075 && Math.abs(overSatchel.z - 0.006) < 0.06 && overSatchel.y > -0.01 && overSatchel.y < 0.25) return { kind: 'satchel' };
  if (v(deps.satchel.mouth).distanceTo(world) < 0.1 * scale) return { kind: 'satchel' };
  // Only the drawer's own things have a place in it; anything else dropped there lands on the table instead.
  if (deps.drawer.over(world) && (objectId === undefined || deps.drawer.anchor(objectId))) return { kind: 'drawer' };
  const local = deps.book.root.worldToLocal(world.clone());
  if (bookOpen && Math.abs(local.x) <= 0.2 && Math.abs(local.z) <= 0.15) return { kind: 'page', at: [local.x, 0, local.z] };
  const outline = deps.table();
  let x = world.x;
  let z = world.z;
  if (outline && outline.length >= 3 && !insidePolygon(x, z, outline)) {
    const p = nearestOnPolygon(x, z, outline);
    // A hair inside the edge, so it doesn't teeter.
    const c = outline.reduce((acc, q) => ({ x: acc.x + q.x / outline.length, z: acc.z + q.z / outline.length }), { x: 0, z: 0 });
    const d = Math.hypot(c.x - p.x, c.z - p.z) || 1;
    x = p.x + ((c.x - p.x) / d) * 0.03;
    z = p.z + ((c.z - p.z) / d) * 0.03;
  }
  const onTable = deps.book.root.worldToLocal(new Vector3(x, world.y, z));
  // Without a scanned outline, keep it within easy reach of the book.
  const r = Math.hypot(onTable.x, onTable.z);
  if (!outline && r > 0.45) {
    onTable.x *= 0.45 / r;
    onTable.z *= 0.45 / r;
  }
  return { kind: 'table', at: [onTable.x, 0, onTable.z] };
}

export function createObjectHands(deps: HandsDeps) {
  const held: Record<HandSide, string | null> = { left: null, right: null };
  const lastPoint: Record<HandSide, Vector3 | null> = { left: null, right: null };
  let bookOpen = true;
  let nowMs = 0;

  /** How near a held object is to a paw: the nearer of where you hold it and the middle of the thing itself. */
  const nearest = (objectId: string, maxM: number): string | null => {
    const scale = deps.stageRoot.scale.x || 1;
    const held = deps.objects.worldOf(objectId, new Vector3());
    const body = deps.objects.centreOf(objectId, new Vector3());
    let best: string | null = null;
    let bestD = maxM * scale;
    for (const [id, grip] of deps.grips()) {
      if (!deps.runtime.canReceive(id)) continue;
      const g = v(grip);
      // Measured to the whole length of what you hold, from your pinch through its centre to its far end,
      // so a long thing (the ladder, held by its top) is handed over when any of it reaches the paws.
      const far = body.clone().multiplyScalar(2).sub(held);
      const along = far.clone().sub(held);
      const t = along.lengthSq() > 1e-8 ? Math.max(0, Math.min(1, g.clone().sub(held).dot(along) / along.lengthSq())) : 0;
      const d = g.distanceTo(held.clone().addScaledVector(along, t));
      if (d < bestD) {
        best = id;
        bestD = d;
      }
    }
    return best;
  };

  const settle = (id: string, side: HandSide): void => {
    const at = lastPoint[side] ?? deps.objects.worldOf(id, new Vector3());
    const home = restingHome(at, deps, bookOpen, id);
    deps.objects.send(id, home, nowMs, 260, 0);
    deps.sound.play(home.kind === 'satchel' ? 'satchel' : home.kind === 'page' || home.kind === 'drawer' ? 'setdown' : 'settle', at);
  };

  const anyHeld = () => held.left !== null || held.right !== null;
  /** VR Glasses: the object you've looked at and pinched, lifted and waiting for someone to give it to. */
  let chosen: string | null = null;
  let chosenFrom: Home | null = null;

  return {
    /** Each frame, before the controls ask for targets. */
    frame(now: number, open: boolean): void {
      nowMs = now;
      bookOpen = open;
      // The story took it out of your hand (nobody helped in time, and a character fetched it): you're not holding it any more.
      for (const side of ['left', 'right'] as const) {
        const id = held[side];
        const home = id ? deps.objects.get(id)?.home : null;
        if (id && (home?.kind !== 'hand' || home.side !== side)) {
          held[side] = null;
          deps.runtime.setHolding(anyHeld());
        }
      }
      // While you hold something, the nearest character notices it, before you let go.
      let noticed: { cast: string; object: string } | null = null;
      for (const side of ['left', 'right'] as const) {
        const id = held[side];
        if (!id) continue;
        const cast = nearest(id, NOTICE_M);
        if (cast) noticed = { cast, object: id };
      }
      deps.runtime.notice(noticed?.cast ?? null, noticed?.object ?? null);
    },
    targets(): ExtraTarget[] {
      const out: ExtraTarget[] = [];
      for (const t of deps.objects.grabTargets()) {
        out.push({
          proxy: { id: `object:${t.id}`, position: { x: t.centre.x, y: t.centre.y, z: t.centre.z }, radiusM: Math.max(TARGET_M, t.radius), reachUpM: REACH_UP_M },
          onGrab: (hand, point) => {
            held[hand] = t.id;
            const st = deps.objects.get(t.id);
            if (st) st.touched = true;
            lastPoint[hand] = point.clone();
            deps.objects.send(t.id, { kind: 'hand', side: hand }, nowMs, 90);
            deps.runtime.setHolding(true);
            deps.sound.play('grab', point);
            deps.sound.play('rustle', point);
          },
          onDrag: (hand, point) => {
            lastPoint[hand] = point.clone();
          },
          onRelease: (hand, point) => {
            const id = held[hand];
            held[hand] = null;
            deps.runtime.setHolding(anyHeld());
            if (!id) return;
            lastPoint[hand] = point.clone();
            const cast = nearest(id, GIVE_M);
            if (cast && deps.runtime.gift(id, cast)) return;
            settle(id, hand);
          },
          onCancel: (hand) => {
            const id = held[hand];
            held[hand] = null;
            deps.runtime.setHolding(anyHeld());
            if (id) settle(id, hand);
          },
        });
      }
      // The characters themselves: pinch the top of a head to pick them up.
      for (const c of deps.runtime.castTargets()) {
        out.push({
          proxy: { id: `cast:${c.id}`, position: { x: c.top.x, y: c.top.y, z: c.top.z }, radiusM: 0.034, reachUpM: REACH_UP_M },
          onGrab: (_hand, point) => deps.runtime.holdCast(c.id, point),
          onDrag: (_hand, point) => deps.runtime.holdCast(c.id, point),
          onRelease: () => deps.runtime.dropCast(),
          onCancel: () => deps.runtime.dropCast(),
        });
      }
      // The drawer's pull: on the page block while it's shut, riding on its front once it's out.
      const pull = deps.runtime.drawerAmount > 0.05 ? deps.drawer.pull : deps.book.root.getObjectByName('drawer-pull');
      if (pull && bookOpen) {
        const p = v(pull);
        out.push({ proxy: { id: 'drawer-pull', position: { x: p.x, y: p.y, z: p.z }, radiusM: 0.036, reachUpM: REACH_UP_M }, onRelease: () => deps.runtime.toggleDrawer() });
      }
      // The page's edge, while it invites a turn. It stands in for the fore-edge's stretch.
      if (deps.runtime.pageInviting) {
        const p = deps.book.cornerWorld(new Vector3());
        out.push({ proxy: { id: 'page-edge', position: { x: p.x, y: p.y, z: p.z }, radiusM: 0.04, reachUpM: REACH_UP_M }, onGrab: (_hand, point) => deps.runtime.holdPage(point), onDrag: (_hand, point) => deps.runtime.holdPage(point), onRelease: () => deps.runtime.releasePage(), onCancel: () => deps.runtime.releasePage(true), replaces: 'fore', halo: false });
      }
      // The gold tab opens your satchel.
      const tab = deps.book.root.getObjectByName('tab-gold');
      if (tab && bookOpen) {
        const p = v(tab);
        out.push({ proxy: { id: 'tab-gold', position: { x: p.x, y: p.y, z: p.z }, radiusM: 0.034, reachUpM: REACH_UP_M }, onRelease: () => deps.runtime.toggleSatchel() });
      }
      // Read it again, once the chapter has ended.
      if (deps.runtime.ended && bookOpen) {
        const p = v(deps.endPage.readAgain);
        out.push({ proxy: { id: 'read-again', position: { x: p.x, y: p.y, z: p.z }, radiusM: 0.036, reachUpM: REACH_UP_M }, onRelease: () => deps.onReadAgain() });
      }
      return out;
    },
    /**
     * Gaze and pinch (VR Glasses): look at an object and pinch, and it lifts. Look at a character and
     * pinch, and it floats to them. Look at a control and pinch, and it works as if pinched by hand.
     */
    gazeSelect(origin: Vector3, direction: Vector3): void {
      const dir = direction.clone().normalize();
      const angleTo = (p: Vector3) => dir.angleTo(p.clone().sub(origin));
      const CONE = (7 * Math.PI) / 180;
      if (chosen) {
        let best: { id: string; a: number } | null = null;
        for (const [id, g] of deps.grips()) {
          if (!deps.runtime.canReceive(id)) continue;
          const a = Math.min(angleTo(v(g)), angleTo(v(g).add(new Vector3(0, 0.05, 0))));
          if (a < CONE * 1.4 && (!best || a < best.a)) best = { id, a };
        }
        const id = chosen;
        chosen = null;
        deps.runtime.setHolding(anyHeld());
        if (best && deps.runtime.gift(id, best.id)) return;
        // Not at anyone: it goes back down where it was.
        if (chosenFrom) deps.objects.send(id, chosenFrom, nowMs, 300, 0.02);
        deps.sound.play('settle', deps.objects.worldOf(id, new Vector3()));
        return;
      }
      let best: { t: ExtraTarget; a: number } | null = null;
      for (const t of this.targets()) {
        const a = angleTo(new Vector3(t.proxy.position.x, t.proxy.position.y, t.proxy.position.z));
        if (a < CONE && (!best || a < best.a)) best = { t, a };
      }
      if (!best) return;
      const id = best.t.proxy.id;
      if (id.startsWith('object:')) {
        const objectId = id.slice('object:'.length);
        chosen = objectId;
        chosenFrom = deps.objects.get(objectId)?.home ?? null;
        // Looked at and pinched counts as handled, as a hand's grab does: it comes with you when the page turns.
        const st = deps.objects.get(objectId);
        if (st) st.touched = true;
        // Lifted a little above where it was, so you can see it's chosen.
        const at = deps.objects.worldOf(objectId, new Vector3()).add(new Vector3(0, 0.05 * (deps.stageRoot.scale.x || 1), 0));
        const local = deps.book.root.worldToLocal(at);
        deps.objects.pose(objectId, [local.x, local.y, local.z], 0, false, 1.06);
        deps.objects.send(objectId, { kind: 'posed' }, nowMs, 200);
        deps.runtime.setHolding(true);
        deps.sound.play('grab', at);
      } else if (!id.startsWith('cast:')) {
        const p = new Vector3(best.t.proxy.position.x, best.t.proxy.position.y, best.t.proxy.position.z);
        // Looked at and pinched, the page turns in one go: there's no hand on it to follow.
        if (id === 'page-edge') deps.runtime.turnPage();
        else if (best.t.onRelease) best.t.onRelease('right', p);
        else best.t.onGrab?.('right', p);
      }
    },
    /** For the drawer: put anything you hold back down before it closes. */
    holding: (): string[] => [held.left, held.right].filter((x): x is string => x !== null),
  };
}
