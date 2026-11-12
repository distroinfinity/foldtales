import { Group, Mesh, PlaneGeometry, type Object3D } from '@iwsdk/core';
import { OVER_STACK } from '../book/book-view.ts';
import { cardMaterial } from '../paint/card-material.ts';
import type { TexRef } from '../paint/texref.ts';
import type { Gust } from './cues.ts';

const LEAF_M = 0.013;

export interface LeavesView {
  root: Object3D;
  update(gust: Gust | null, pageY: number, halfWidthM: number): void;
}

/** The gust you can see: two painted leaves carried across the spread, tumbling. */
export function buildLeaves(textures: TexRef[]): LeavesView {
  const root = new Group();
  root.name = 'leaves';
  root.renderOrder = OVER_STACK;
  const leaves = textures.map((ref, i) => {
    const aspect = ref.sizePx[0] / ref.sizePx[1];
    const geometry = new PlaneGeometry(LEAF_M * aspect, LEAF_M);
    const uv = geometry.getAttribute('uv');
    const [u0, v0, u1, v1] = ref.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + (u1 - u0) * uv.getX(k), v0 + (v1 - v0) * uv.getY(k));
    const mesh = new Mesh(geometry, cardMaterial(ref.texture, { doubleSided: true, baked: ref.baked, pool: false }));
    mesh.name = `leaf-${i + 1}`;
    mesh.renderOrder = 50;
    mesh.visible = false;
    root.add(mesh);
    return mesh;
  });
  return {
    root,
    update(gust, pageY, halfWidthM) {
      leaves.forEach((leaf, i) => {
        const g = gust?.leaves[i] ?? null;
        leaf.visible = g !== null;
        if (g === null) return;
        const step = Math.floor(g * 18) / 18;
        leaf.position.set(-halfWidthM * 1.05 + step * halfWidthM * 2.6, pageY + 0.03 + Math.sin(step * 3.1) * 0.035 + Math.sin(step * 6) * 0.012, 0.035 - step * 0.06 + i * 0.02);
        leaf.rotation.set(-1.2 + Math.sin(step * 5) * 0.6, step * 4 + i, step * 9.4 + i * 1.5);
      });
    },
  };
}
