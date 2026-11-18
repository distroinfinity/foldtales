import { Quaternion, Vector3, type Object3D, type World } from '@iwsdk/core';
import { createPlacement, type Placement, type PlacementDecision } from './placement.ts';
import type { Table } from './sizing.ts';
import { horizontalForward, placementRays, type Hit, type Vec3 } from './surface.ts';

const SETUP_LIMIT_MS = 3000;
const orientation = new Quaternion();
const forwardAxis = new Vector3();
const upAxis = new Vector3();

export type OnPlaced = (surface: NonNullable<PlacementDecision['surface']>, tables: Table[]) => void;

/** Surfaces you don't read a book on, even at the right height. */
const NOT_A_TABLE = new Set(['floor', 'ceiling', 'couch', 'bed', 'wall_art', 'window_frame', 'door_frame']);

/** Every scanned horizontal surface you might set a book on, flattened to the floor plan. */
function scannedTables(frame: XRFrame, space: XRReferenceSpace): Table[] {
  const planes = (frame as XRFrame & { detectedPlanes?: Set<XRPlane> }).detectedPlanes;
  if (!planes) return [];
  const tables: Table[] = [];
  for (const plane of planes) {
    if (plane.orientation !== 'horizontal') continue;
    const label = (plane as XRPlane & { semanticLabel?: string }).semanticLabel;
    if (label && NOT_A_TABLE.has(label)) continue;
    const pose = frame.getPose(plane.planeSpace, space);
    if (!pose) continue;
    const m = pose.transform.matrix;
    tables.push({ y: m[13]!, outline: plane.polygon.map((p) => ({ x: m[0]! * p.x + m[4]! * p.y + m[8]! * p.z + m[12]!, z: m[2]! * p.x + m[6]! * p.y + m[10]! * p.z + m[14]! })) });
  }
  return tables;
}

export interface PlacementRun {
  /** Stops listening to XR frames. */
  stop(): void;
  /** The book has begun to open: from now on only you move it. */
  lock(): void;
  /** When this session's search began, in XR frame time (ms), or null before the first frame. */
  searchStartedMs(): number | null;
}

/** Runs placement for each XR session: rays, one machine, and moving `target` when it decides. */
export function startPlacement(
  world: World,
  target: Object3D,
  onPlaced: OnPlaced,
  skip: () => boolean = () => false,
  /** Wraps the frame work, so an error here is caught and reported like the rest. */
  wrap: <A extends unknown[]>(work: (...args: A) => void) => (...args: A) => void = (work) => work,
): PlacementRun {
  let session: XRSession | undefined;
  let sources: XRHitTestSource[] = [];
  let machine: Placement = createPlacement();
  let searchStart: number | null = null;
  // The fallback deadline starts once the rays exist, so slow setup doesn't use up the search time.
  let ready = false;
  /** Stopping (a chapter turned in the same session) lets go of the session's listener and the rays. */
  const stopped = new AbortController();

  function beginSession(next: XRSession): void {
    session = next;
    sources = [];
    ready = false;
    machine = createPlacement();
    searchStart = null;
    target.visible = false;
    const owned = next;
    // A request that never answers mustn't keep the puppet off the stage.
    setTimeout(() => { if (session === owned) ready = true; }, SETUP_LIMIT_MS);
    next.addEventListener('end', () => {
      for (const source of sources) source.cancel();
      sources = [];
    }, { once: true, signal: stopped.signal });
    void owned.requestReferenceSpace('viewer').then(async (viewer) => {
      const requested = await Promise.all(placementRays().map((direction) =>
        world.requestHitTestSource({ space: viewer, offsetRay: new XRRay({ x: 0, y: 0, z: 0 }, { ...direction, w: 0 }) }).catch(() => undefined)));
      for (const source of requested) {
        if (!source) continue;
        // The session may have ended while this was pending.
        if (session === owned) sources.push(source);
        else source.cancel();
      }
    }).catch(() => undefined) // No hit-test here: the machine reaches its fallback.
      .finally(() => { if (session === owned) ready = true; });
  }

  const stop = world.onXRFrame(wrap((frame: XRFrame, _delta: number, time: number) => {
    const space = world.xrReferenceSpace;
    if (!space) return;
    // The painted room has its own table: no search for a real one.
    if (skip()) return;
    if (frame.session !== session) beginSession(frame.session);
    searchStart ??= time * 1000;
    if (!ready) return;

    const viewer = frame.getViewerPose(space);
    let head: Vec3 | null = null;
    let forward: Vec3 | null = null;
    if (viewer) {
      const { position: p, orientation: o } = viewer.transform;
      head = { x: p.x, y: p.y, z: p.z };
      orientation.set(o.x, o.y, o.z, o.w);
      forwardAxis.set(0, 0, -1).applyQuaternion(orientation);
      upAxis.set(0, 1, 0).applyQuaternion(orientation);
      forward = horizontalForward(forwardAxis, upAxis);
    }

    const hits: Hit[] = [];
    for (const source of sources) {
      const pose = frame.getHitTestResults(source)[0]?.getPose(space);
      if (!pose) continue;
      const { position: p, orientation: o } = pose.transform;
      // A hit pose's Y axis is the surface normal.
      hits.push({ position: { x: p.x, y: p.y, z: p.z }, normalY: 1 - 2 * (o.x * o.x + o.z * o.z) });
    }

    const decision = machine.step(time * 1000, { head, forward, hits });
    if (!decision.moveTo || !decision.surface || !head) return;
    target.position.set(decision.moveTo.x, decision.moveTo.y, decision.moveTo.z);
    target.rotation.y = Math.atan2(head.x - decision.moveTo.x, head.z - decision.moveTo.z);
    target.visible = true;
    onPlaced(decision.surface, scannedTables(frame, space));
  }));
  return {
    stop: () => {
      stop();
      stopped.abort();
      for (const source of sources) source.cancel();
      sources = [];
      session = undefined;
    },
    lock: () => machine.lock(),
    searchStartedMs: () => searchStart,
  };
}
