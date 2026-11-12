import { DoubleSide, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, type Texture } from '@iwsdk/core';
import { z } from 'zod';
import { cardMaterial } from '../paint/card-material.ts';
import { subUv, type TexRef } from '../paint/texref.ts';

const M2 = z.tuple([z.number(), z.number()]);
const Part = z.object({ file: z.string(), sizeM: M2, z: z.number() });

/** `art/satchel/satchel.json`, as the art wrote it. */
export const SatchelSpec = z.object({
  parts: z.object({ back: Part, front: Part, flap: Part }),
  position: z.tuple([z.number(), z.number(), z.number()]),
  flap: z.object({ closedDeg: z.number(), openDeg: z.number() }),
});
export type SatchelSpec = z.infer<typeof SatchelSpec>;

export interface SatchelView {
  /** In the book's frame, standing on the table beside it. */
  root: Object3D;
  /** 0 shut, 1 open. */
  setFlap(open: number): void;
  /** Where the next kept thing goes in: between the back and the pocket, peeking out. */
  pocket: Object3D;
  /** The mouth of the pocket, where kept things fly to. */
  mouth: Object3D;
  /** Put the satchel on the left or right of the book. */
  setSide(side: 1 | -1): void;
}

export function buildSatchel(spec: SatchelSpec, tex: (file: string) => TexRef, base: string, shadow: Texture): SatchelView {
  const root = new Object3D();
  root.name = 'satchel';
  const card = (file: string, w: number, h: number) => {
    const ref = tex(`${base}/${file}`);
    const geometry = new PlaneGeometry(w, h);
    const uv = geometry.getAttribute('uv');
    const s = subUv(ref, [0, 1], [0, 1]);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, s.u[0] + (s.u[1] - s.u[0]) * uv.getX(i), s.v[0] + (s.v[1] - s.v[0]) * uv.getY(i));
    uv.needsUpdate = true;
    return new Mesh(geometry, cardMaterial(ref.texture, { baked: ref.baked, doubleSided: true }));
  };
  const { back, front, flap } = spec.parts;
  const backMesh = card(back.file, ...back.sizeM);
  backMesh.position.set(0, back.sizeM[1] / 2, back.z);
  backMesh.renderOrder = 1;
  const frontMesh = card(front.file, ...front.sizeM);
  frontMesh.position.set(0, front.sizeM[1] / 2, front.z);
  frontMesh.renderOrder = 3;
  // The flap hinges along the pocket's top edge: closed it hangs over the pocket, open it lifts back.
  const hinge = new Object3D();
  hinge.position.set(0, front.sizeM[1], flap.z);
  const flapMesh = card(flap.file, ...flap.sizeM);
  flapMesh.position.set(0, -flap.sizeM[1] / 2, 0);
  flapMesh.renderOrder = 4;
  hinge.add(flapMesh);
  const pocket = new Object3D();
  pocket.name = 'satchel-pocket';
  pocket.position.set(0, 0.008, (back.z + front.z) / 2);
  const mouth = new Object3D();
  mouth.position.set(0, front.sizeM[1] + 0.01, (back.z + front.z) / 2);
  const ground = new Mesh(new PlaneGeometry(back.sizeM[0] * 1.35, 0.05), new MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, opacity: 0.5, toneMapped: false, side: DoubleSide }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0.0004, 0.008);
  ground.renderOrder = 0;
  root.add(ground, backMesh, frontMesh, hinge, pocket, mouth);
  const [x, y, zPos] = spec.position;
  root.position.set(x, y, zPos);
  return {
    root,
    pocket,
    mouth,
    setFlap(open) {
      const t = Math.max(0, Math.min(1, open));
      // The art's negative angle lifts the flap back over the bag, which is +x here.
      hinge.rotation.x = -((spec.flap.closedDeg + (spec.flap.openDeg - spec.flap.closedDeg) * t) * Math.PI) / 180;
    },
    setSide(side) {
      root.position.x = side * Math.abs(x);
    },
  };
}
