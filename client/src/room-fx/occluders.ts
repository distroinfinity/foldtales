import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from '@iwsdk/core';
import type { Place, RoomMap } from './room-map.ts';

/**
 * Your real room, drawn invisibly into depth only, so room effects hide behind real things: rain
 * behind the couch, fog under the table, nothing beyond the walls. Walls are their own planes;
 * tables, couches, beds and shelves are their tops carried down to the floor, which is close to
 * how they stand. Drawn after the room dim (which must reach past the walls) and before the effects.
 */

const material = new MeshBasicMaterial({ colorWrite: false });
/** Tops sit a little low, so the book and a thing on a seat never sink into them. */
const TOP_DROP_M = 0.015;
const FURNITURE = new Set(['table', 'couch', 'bed', 'shelf', 'storage', 'screen', 'other']);

/** A top's rectangle, carried straight down to the floor: its top and four sides. */
function column(p: Place, floorY: number): BufferGeometry {
  const top = p.centre.y - TOP_DROP_M;
  const ring = p.outline;
  const v: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => v.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 1; i + 1 < ring.length; i++) v.push(ring[0]!.x, top, ring[0]!.z, ring[i]!.x, top, ring[i]!.z, ring[i + 1]!.x, top, ring[i + 1]!.z);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    quad([a.x, top, a.z], [b.x, top, b.z], [b.x, floorY, b.z], [a.x, floorY, a.z]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(v, 3));
  return g;
}

export interface RoomDepth {
  root: Group;
  /** Each frame: on while an effect needs it, and rebuilt when the room map changes. */
  frame(on: boolean, room: RoomMap): void;
}

export function createRoomDepth(): RoomDepth {
  const root = new Group();
  root.name = 'room-depth';
  root.visible = false;
  let key = '';
  const tmp = new Vector3();

  const rebuild = (room: RoomMap) => {
    for (const child of [...root.children]) {
      (child as Mesh).geometry.dispose();
      root.remove(child);
    }
    const floorY = room.floorY();
    for (const p of room.places()) {
      let mesh: Mesh | null = null;
      if (!p.horizontal && p.label === 'wall') {
        mesh = new Mesh(new PlaneGeometry(p.sizeM[0], p.sizeM[1]), material);
        mesh.position.copy(p.centre);
        mesh.lookAt(tmp.copy(p.centre).add(p.normal));
      } else if (p.horizontal && FURNITURE.has(p.label) && p.outline.length >= 3) {
        mesh = new Mesh(column(p, floorY), material);
      }
      if (!mesh) continue;
      mesh.renderOrder = -990;
      mesh.frustumCulled = false;
      root.add(mesh);
    }
  };

  return {
    root,
    frame(on, room) {
      root.visible = on;
      if (!on) return;
      const next = room.places().map((p) => `${p.id}:${p.centre.x.toFixed(2)},${p.centre.z.toFixed(2)}`).join('|');
      if (next !== key) {
        key = next;
        rebuild(room);
      }
    },
  };
}
