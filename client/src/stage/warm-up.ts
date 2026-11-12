import type { Object3D, Vector3 } from '@iwsdk/core';

const AHEAD_M = 1.5;
const TINY = 0.001;

/**
 * Makes every piece visible for one frame, shrunk to a speck ahead of you, so the first real use of
 * a hidden head, the dark lantern or the smoke doesn't stall to compile its shader in XR.
 * Returns the function that puts everything back exactly as it was.
 */
export function warmUp(root: Object3D, head: Vector3, forward: Vector3): () => void {
  const hidden: Object3D[] = [];
  root.traverse((object) => {
    if (!object.visible) hidden.push(object);
    object.visible = true;
  });
  const position = root.position.clone();
  const scale = root.scale.clone();
  root.position.set(head.x + forward.x * AHEAD_M, head.y + forward.y * AHEAD_M, head.z + forward.z * AHEAD_M);
  root.scale.setScalar(TINY);
  return () => {
    for (const object of hidden) object.visible = false;
    root.position.copy(position);
    root.scale.copy(scale);
  };
}
