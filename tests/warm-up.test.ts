import { describe, expect, test } from 'vitest';
import { Mesh, Object3D, Vector3 } from '@iwsdk/core';
import { warmUp } from '../client/src/stage/warm-up.ts';

describe('XR warm-up', () => {
  test('shows every hidden piece for one frame, small and out of the way, then puts everything back', () => {
    const root = new Object3D();
    root.visible = false;
    root.position.set(1, 2, 3);
    root.scale.setScalar(0.9);
    const hiddenHead = new Mesh();
    hiddenHead.visible = false;
    const shown = new Mesh();
    root.add(hiddenHead, shown);

    const restore = warmUp(root, new Vector3(0, 1.6, 0), new Vector3(0, 0, -1));
    expect([root.visible, hiddenHead.visible, shown.visible]).toEqual([true, true, true]);
    expect(root.scale.x).toBeLessThan(0.01);
    expect(root.position.z).toBeLessThan(-0.5);

    restore();
    expect([root.visible, hiddenHead.visible, shown.visible]).toEqual([false, false, true]);
    expect(root.position.toArray()).toEqual([1, 2, 3]);
    expect(root.scale.x).toBeCloseTo(0.9);
  });
});
