import { Quaternion, Vector3, type Object3D, type World } from '@iwsdk/core';
import { createPlacement, type PlacementDecision } from './placement.ts';
import { horizontalForward, type Hit, type Vec3 } from './surface.ts';

const RAYS = 12;
const orientation = new Quaternion();
const forwardAxis = new Vector3();
const upAxis = new Vector3();

export type OnPlaced = (surface: NonNullable<PlacementDecision['surface']>) => void;

/** Runs placement for each XR session: rays, one machine, and moving `target` when it decides. */
export function startPlacement(world: World, target: Object3D, onPlaced: OnPlaced): () => void {
  let session: XRSession | undefined;
  let sources: XRHitTestSource[] = [];
  let machine = createPlacement();

  function beginSession(next: XRSession): void {
    session = next;
    sources = [];
    machine = createPlacement();
    target.visible = false;
    const owned = next;
    next.addEventListener('end', () => {
      for (const source of sources) source.cancel();
      sources = [];
    }, { once: true });
    void owned.requestReferenceSpace('viewer').then(async (viewer) => {
      for (let i = 0; i < RAYS; i++) {
        const angle = (i / RAYS) * Math.PI * 2;
        const offsetRay = new XRRay({ x: 0, y: 0, z: 0 }, { x: Math.cos(angle) * 0.25, y: -0.5 + Math.sin(angle) * 0.12, z: -0.8 });
        const source = await world.requestHitTestSource({ space: viewer, offsetRay });
        if (!source) continue;
        // The session may have ended while this was pending.
        if (session === owned) sources.push(source);
        else source.cancel();
      }
    }).catch(() => undefined); // No hit-test here: the machine reaches its fallback.
  }

  return world.onXRFrame((frame, _delta, time) => {
    const space = world.xrReferenceSpace;
    if (!space) return;
    if (frame.session !== session) beginSession(frame.session);

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
