import { Vector3, type Object3D } from '@iwsdk/core';
import type { RoomLabel, RoomPlace } from '@tabletop/contracts';

/**
 * The reader's real room, from Space Setup's planes: the floor, walls, ceiling, windows, and the tops
 * of tables, couches, beds and shelves. Room effects and the storyteller name places from it. With no
 * Space Setup at all, it stands in fixed places of its own, so every effect but the window still works.
 */

export interface Place {
  /** Its kind and a number, such as `couch-2`. Stand-ins number from 0. */
  id: string;
  label: RoomLabel;
  /** What the browser called it, for the logs. */
  raw: string;
  /** The middle of its top (or its face, for a wall), in world space. */
  centre: Vector3;
  /** Up for a top, out of the wall for a face. */
  normal: Vector3;
  /** Width and depth (or height, for a wall), metres. */
  sizeM: [number, number];
  /** Its outline on the floor plan, for a top. */
  outline: Array<{ x: number; z: number }>;
  horizontal: boolean;
  /** Made up here, because Space Setup didn't say. */
  standIn: boolean;
}

/** Space Setup's names, as the browser gives them, to ours. Both the scene names and the plain ones. */
const LABELS: Record<string, RoomLabel> = {
  table: 'table',
  couch: 'couch',
  sofa: 'couch',
  bed: 'bed',
  wall: 'wall',
  wall_face: 'wall',
  window: 'window',
  window_frame: 'window',
  door: 'door',
  door_frame: 'door',
  floor: 'floor',
  ceiling: 'ceiling',
  shelf: 'shelf',
  storage: 'storage',
  screen: 'screen',
  lamp: 'lamp',
  plant: 'plant',
  wall_art: 'other',
  other: 'other',
};

/** A wall Space Setup added to close an open room isn't a real wall: nothing is cast on it. */
const NOT_REAL = new Set(['invisible_wall_face']);

/** Where a thing in the room goes when the asked-for kind isn't here, in order. */
const RESTING = ['couch', 'bed', 'shelf', 'storage', 'table', 'floor'] as const satisfies readonly RoomLabel[];

/** How often the planes are read again. They rarely change during a session. */
const READ_EVERY = 45;
const CEILING_ABOVE_FLOOR_M = 2.4;
const STAND_IN_WALL_M = 2.5;

export function insideOutline(x: number, z: number, outline: Array<{ x: number; z: number }>): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!;
    const b = outline[j]!;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export interface RoomMap {
  /** Reads Space Setup's planes now and then. Call every XR frame. */
  frame(frame: XRFrame, space: XRReferenceSpace, head: Vector3, forward: Vector3): void;
  /** A new session: forget the room, it may be another one. */
  reset(): void;
  /** Every place found, real ones only. */
  places(): Place[];
  /** A place by `room:` reference (`room:couch` is the best couch or the next best place; `room:couch-2` that one), or null for the app's choice. Always answers once a frame has been read. */
  resolve(ref: string | null, uses?: 'rest' | 'face', near?: Vector3): Place | null;
  /** The surface under a point in the room: the top it's over, else the floor. */
  below(world: Vector3): Place | null;
  /** A place by its id, as a saved object home names it, falling back as `resolve` does. */
  byId(id: string): Place | null;
  /** The floor's height (0 in the floor-level space when Space Setup has none). */
  floorY(): number;
  /** The ceiling's height, real or assumed. */
  ceilingY(): number;
  /** The table the book stands on, kept out of a hunt: hiding a thing next to the book isn't hiding it. */
  setBookAt(world: Vector3 | null): void;
  /** The room as the storyteller sees it: places in stage space, most useful first. */
  forStory(stageRoot: Object3D): RoomPlace[];
  /** What the browser called things in this room, for the first headset check. */
  seenLabels(): string[];
}

export function createRoomMap(): RoomMap {
  /** One id per plane for the session, so a place keeps its name. */
  const ids = new Map<XRPlane, string>();
  const counts = new Map<RoomLabel, number>();
  let found: Place[] = [];
  const standIns = new Map<string, Place>();
  const seen = new Set<string>();
  let frames = 0;
  const head = new Vector3();
  const forward = new Vector3(0, 0, -1);
  let headKnown = false;
  let book: Vector3 | null = null;

  const nextId = (label: RoomLabel): string => {
    const n = (counts.get(label) ?? 0) + 1;
    counts.set(label, n);
    return `${label}-${n}`;
  };

  function read(frame: XRFrame, space: XRReferenceSpace): void {
    const planes = (frame as XRFrame & { detectedPlanes?: Set<XRPlane> }).detectedPlanes;
    if (!planes) return;
    const next: Place[] = [];
    // Steady order, so a room read twice numbers its couches the same way.
    const list = [...planes];
    for (const plane of list) {
      // The emulator spells them with spaces ("wall art"), Space Setup with underscores.
      const raw = ((plane as XRPlane & { semanticLabel?: string }).semanticLabel ?? 'other').toLowerCase().trim().replace(/\s+/g, '_');
      seen.add(raw);
      if (NOT_REAL.has(raw)) continue;
      const label = LABELS[raw] ?? 'other';
      const pose = frame.getPose(plane.planeSpace, space);
      if (!pose || plane.polygon.length < 3) continue;
      const m = pose.transform.matrix;
      const toWorld = (p: DOMPointReadOnly) => new Vector3(m[0]! * p.x + m[4]! * p.y + m[8]! * p.z + m[12]!, m[1]! * p.x + m[5]! * p.y + m[9]! * p.z + m[13]!, m[2]! * p.x + m[6]! * p.y + m[10]! * p.z + m[14]!);
      const corners = plane.polygon.map(toWorld);
      const centre = corners.reduce((a, c) => a.add(c), new Vector3()).multiplyScalar(1 / corners.length);
      // A plane's own +Y is its normal.
      const normal = new Vector3(m[4]!, m[5]!, m[6]!).normalize();
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of plane.polygon) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
      let id = ids.get(plane);
      if (!id) {
        id = nextId(label);
        ids.set(plane, id);
      }
      const horizontal = plane.orientation === 'horizontal';
      next.push({ id, label, raw, centre, normal, sizeM: [maxX - minX, maxZ - minZ], outline: horizontal ? corners.map((c) => ({ x: c.x, z: c.z })) : [], horizontal, standIn: false });
    }
    found = next;
  }

  const floorY = (): number => {
    const floors = found.filter((p) => p.label === 'floor');
    return floors.length ? Math.min(...floors.map((p) => p.centre.y)) : 0;
  };
  const ceilingY = (): number => {
    const ceilings = found.filter((p) => p.label === 'ceiling');
    return ceilings.length ? Math.max(...ceilings.map((p) => p.centre.y)) : floorY() + CEILING_ABOVE_FLOOR_M;
  };

  const underBook = (p: Place): boolean => !!book && p.horizontal && Math.abs(p.centre.y - book.y) < 0.12 && insideOutline(book.x, book.z, p.outline);

  /** Fixed for the session once made, so a thing put there stays put while you move about. */
  const standIn = (label: 'floor' | 'wall' | 'ceiling'): Place | null => {
    const id = `${label}-0`;
    const known = standIns.get(id);
    if (known) return known;
    if (!headKnown) return null;
    const flat = new Vector3(forward.x, 0, forward.z);
    if (flat.lengthSq() < 1e-6) flat.set(0, 0, -1);
    flat.normalize();
    const right = new Vector3(-flat.z, 0, flat.x);
    let place: Place;
    if (label === 'floor') {
      // Ahead and to the right, on the floor, where you can see it and reach it by standing.
      const centre = head.clone().addScaledVector(flat, 0.9).addScaledVector(right, 0.7);
      centre.y = floorY();
      place = { id, label, raw: 'stand-in', centre, normal: new Vector3(0, 1, 0), sizeM: [0.6, 0.6], outline: [], horizontal: true, standIn: true };
    } else if (label === 'wall') {
      const centre = head.clone().addScaledVector(flat, STAND_IN_WALL_M);
      centre.y = floorY() + 1.4;
      place = { id, label, raw: 'stand-in', centre, normal: flat.clone().negate(), sizeM: [3, 2.4], outline: [], horizontal: false, standIn: true };
    } else {
      const centre = head.clone();
      centre.y = ceilingY();
      place = { id, label, raw: 'stand-in', centre, normal: new Vector3(0, -1, 0), sizeM: [4, 4], outline: [], horizontal: true, standIn: true };
    }
    standIns.set(id, place);
    return place;
  };

  /** The best of a kind: the nearest, for things in the room you might walk to or look at. */
  const best = (label: RoomLabel, near: Vector3, uses: 'rest' | 'face'): Place | null => {
    let pick: Place | null = null;
    let pickD = Infinity;
    for (const p of found) {
      if (p.label !== label) continue;
      if (uses === 'rest' && (!p.horizontal || underBook(p))) continue;
      const d = p.centre.distanceTo(near);
      if (d < pickD) {
        pick = p;
        pickD = d;
      }
    }
    return pick;
  };

  const map: RoomMap = {
    frame(frame, space, h, f) {
      head.copy(h);
      forward.copy(f);
      headKnown = true;
      if (frames++ % READ_EVERY === 0) read(frame, space);
    },
    reset() {
      ids.clear();
      counts.clear();
      found = [];
      standIns.clear();
      frames = 0;
      headKnown = false;
    },
    places: () => found,
    resolve(ref, uses = 'rest', near) {
      const from = near ?? head;
      const name = ref?.startsWith('room:') ? ref.slice(5) : null;
      if (name && /-[0-9]+$/.test(name)) {
        const exact = found.find((p) => p.id === name) ?? standIns.get(name);
        if (exact) return exact;
      }
      const label = (name?.replace(/-[0-9]+$/, '') ?? null) as RoomLabel | null;
      if (label === 'ceiling') return best('ceiling', from, 'face') ?? standIn('ceiling');
      if (label === 'floor') return best('floor', from, 'face') ?? standIn('floor');
      if (uses === 'face' || label === 'wall' || label === 'window' || label === 'door') {
        if (label && label !== 'wall') {
          const own = best(label, from, 'face');
          if (own) return own;
        }
        return best('wall', from, 'face') ?? standIn('wall');
      }
      // Things come to rest on the asked-for kind, or the next one down the list.
      const order: RoomLabel[] = label && !(RESTING as readonly RoomLabel[]).includes(label) ? [label, ...RESTING] : label ? (RESTING as readonly RoomLabel[]).slice((RESTING as readonly RoomLabel[]).indexOf(label)) : [...RESTING];
      for (const l of order) {
        if (l === 'floor') return best('floor', from, 'rest') ?? standIn('floor');
        const p = best(l, from, 'rest');
        if (p) return p;
      }
      return standIn('floor');
    },
    below(world) {
      let pick: Place | null = null;
      for (const p of found) {
        if (!p.horizontal || p.label === 'ceiling' || p.centre.y > world.y + 0.02) continue;
        if (p.label !== 'floor' && !insideOutline(world.x, world.z, p.outline)) continue;
        if (!pick || p.centre.y > pick.centre.y) pick = p;
      }
      if (pick) return pick;
      // No floor scanned: a stand-in floor right under it.
      const id = `floor-${standIns.size + 1}`;
      const place: Place = { id, label: 'floor', raw: 'stand-in', centre: new Vector3(world.x, floorY(), world.z), normal: new Vector3(0, 1, 0), sizeM: [0.4, 0.4], outline: [], horizontal: true, standIn: true };
      standIns.set(id, place);
      return place;
    },
    byId(id) {
      return found.find((p) => p.id === id) ?? standIns.get(id) ?? map.resolve(`room:${id}`);
    },
    floorY,
    ceilingY,
    setBookAt(world) {
      book = world ? world.clone() : null;
    },
    forStory(stageRoot) {
      const order: RoomLabel[] = ['couch', 'bed', 'shelf', 'storage', 'table', 'window', 'door', 'lamp', 'plant', 'screen', 'wall', 'floor', 'ceiling', 'other'];
      const scale = stageRoot.getWorldScale(new Vector3()).x || 1;
      return [...found]
        .filter((p) => !underBook(p))
        .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
        .slice(0, 24)
        .map((p) => {
          const at = stageRoot.worldToLocal(p.centre.clone());
          return { id: p.id, label: p.label, at: [at.x, at.y, at.z] as [number, number, number], sizeM: [p.sizeM[0] / scale, p.sizeM[1] / scale] as [number, number] };
        });
    },
    seenLabels: () => [...seen].sort(),
  };
  return map;
}
