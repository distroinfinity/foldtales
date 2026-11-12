import { Quaternion, Vector3, type Object3D, type World } from '@iwsdk/core';
import { createPlacement, type PlacementDecision } from './placement.ts';
import { horizontalForward, placementRays, type Hit, type Vec3 } from './surface.ts';

const SETUP_LIMIT_MS = 3000;
const orientation = new Quaternion();
const forwardAxis = new Vector3();
const upAxis = new Vector3();

export type OnPlaced = (surface: NonNullable<PlacementDecision['surface']>) => void;

/** Runs placement for each XR session: rays, one machine, and moving `target` when it decides. */
export function startPlacement(world: World, target: Object3D, onPlaced: OnPlaced): () => void {
  let session: XRSession | undefined;
  let sources: XRHitTestSource[] = [];
  let machine = createPlacement();
  // The fallback deadline starts once the rays exist, so slow setup doesn't use up the search time.
  let ready = false;

  function beginSession(next: XRSession): void {
    session = next;
    sources = [];
    ready = false;
    machine = createPlacement();
    target.visible = false;
    const owned = next;
    // A request that never answers mustn't keep the puppet off the stage.
    setTimeout(() => { if (session === owned) ready = true; }, SETUP_LIMIT_MS);
    next.addEventListener('end', () => {
      for (const source of sources) source.cancel();
      sources = [];
    }, { once: true });
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

  return world.onXRFrame((frame, _delta, time) => {
    const space = world.xrReferenceSpace;
    if (!space) return;
    if (frame.session !== session) beginSession(frame.session);
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
    onPlaced(decision.surface);
  });
}
