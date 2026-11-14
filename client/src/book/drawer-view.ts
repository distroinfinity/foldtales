import { DoubleSide, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Vector3, type Texture } from '@iwsdk/core';
import { z } from 'zod';
import { cardMaterial } from '../paint/card-material.ts';
import { subUv, type TexRef } from '../paint/texref.ts';

const M2 = z.tuple([z.number(), z.number()]);

/** `art/book/drawer/drawer.json`, as the art wrote it. */
export const DrawerSpec = z.object({
  tray: z.object({ file: z.string(), sizeM: M2, interiorM: M2, wallHeightM: z.number() }),
  front: z.object({ file: z.string(), sizeM: M2 }),
  side: z.object({ file: z.string(), sizeM: M2 }),
  attach: z.object({ centerX: z.number(), edgeZ: z.number(), travelM: z.number() }),
  slots: z.array(z.object({ object: z.string(), flatXM: z.number(), standXM: z.number(), planeZM: z.number(), turn: z.number(), paintedLengthM: z.number(), paintedWidthM: z.number() })),
});
export type DrawerSpec = z.infer<typeof DrawerSpec>;

/** Fully out but still flat, then tipped onto edges, then standing: drawer.json's three-stage stow. */
const SLIDE_END = 0.55;
const TIP_END = 0.75;
const FLOOR_M = 0.0012;

export interface DrawerView {
  /** In the book's frame. */
  root: Object3D;
  /** 0 shut, 0.55 fully out and flat, 0.75 tipped onto edges, 1 everything standing. */
  set(open: number): void;
  /** Where each object's card centre goes: attach a centred card here. */
  anchor(objectId: string): Object3D | null;
  /** The object's painted length and width, as the drawer stows it. */
  slotSize(objectId: string): [number, number] | null;
  /** The pull, which rides on the drawer's front: where a hand takes it. */
  pull: Object3D;
  /** Is the tray's floor under this point (world)? For settling a dropped object into it. */
  over(world: Vector3): boolean;
  floorWorldY(): number;
  readonly openAmount: number;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (v: number): number => v * v * (3 - 2 * v);

export function buildDrawer(spec: DrawerSpec, tex: (file: string) => TexRef, base: string, pull: { ref: TexRef; sizeM: [number, number] }, shadow: Texture): DrawerView {
  const root = new Object3D();
  root.name = 'drawer';
  const slide = new Object3D();
  slide.name = 'drawer-slide';
  root.add(slide);
  root.position.set(spec.attach.centerX, 0, spec.attach.edgeZ);

  const card = (file: string, w: number, h: number, opts: Parameters<typeof cardMaterial>[1] = {}) => {
    const ref = tex(`${base}/${file}`);
    const geometry = new PlaneGeometry(w, h);
    const uv = geometry.getAttribute('uv');
    const s = subUv(ref, [0, 1], [0, 1]);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, s.u[0] + (s.u[1] - s.u[0]) * uv.getX(i), s.v[0] + (s.v[1] - s.v[0]) * uv.getY(i));
    uv.needsUpdate = true;
    return new Mesh(geometry, cardMaterial(ref.texture, { baked: ref.baked, ...opts }));
  };

  const [tw, td] = spec.tray.sizeM;
  const wall = spec.tray.wallHeightM;
  // The tray lies on the table, its near edge at the slide's origin, reaching back under the book.
  const tray = card(spec.tray.file, tw, td, { doubleSided: true });
  tray.name = 'tray';
  tray.rotation.x = -Math.PI / 2;
  tray.position.set(0, FLOOR_M, -td / 2);
  tray.renderOrder = 1;
  slide.add(tray);
  const [fw, fh] = spec.front.sizeM;
  const front = card(spec.front.file, fw, fh, { doubleSided: true });
  front.name = 'drawer-front';
  front.position.set(0, fh / 2, 0.0005);
  front.renderOrder = 3;
  slide.add(front);
  const pullMesh = new Mesh(new PlaneGeometry(...pull.sizeM), cardMaterial(pull.ref.texture, { baked: pull.ref.baked }));
  pullMesh.name = 'drawer-pull-front';
  pullMesh.position.set(0, fh * 0.55, 0.0012);
  pullMesh.renderOrder = 4;
  slide.add(pullMesh);
  const pullAnchor = new Object3D();
  pullAnchor.position.set(0, fh * 0.6, 0.004);
  slide.add(pullAnchor);
  const [sl, sh] = spec.side.sizeM;
  for (const side of [-1, 1]) {
    const s = card(spec.side.file, sl, sh, { doubleSided: true });
    s.name = 'drawer-side';
    s.rotation.y = (side * Math.PI) / 2;
    s.position.set((side * tw) / 2, sh / 2, -td / 2);
    s.renderOrder = 2;
    slide.add(s);
  }
  // A soft shadow on the table around the tray, so it sits on the surface.
  const tableShadow = new Mesh(new PlaneGeometry(tw * 1.25, td * 1.3), new MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, opacity: 0.45, toneMapped: false, side: DoubleSide }));
  tableShadow.rotation.x = -Math.PI / 2;
  tableShadow.position.set(0, 0.0004, -td / 2);
  tableShadow.renderOrder = 0;
  slide.add(tableShadow);

  // Each object's stow: a plane at planeZM from the back wall, which tips up, and the card swinging in it.
  const [iw, id] = spec.tray.interiorM;
  const backWall = -td + (td - id) / 2;
  const slots = spec.slots.map((s) => {
    const tip = new Object3D();
    tip.name = `slot:${s.object}`;
    tip.position.set(0, FLOOR_M + 0.0006, backWall + s.planeZM);
    slide.add(tip);
    const anchor = new Object3D();
    anchor.name = `slot-anchor:${s.object}`;
    tip.add(anchor);
    return { s, tip, anchor };
  });
  void iw;

  let amount = 0;
  const world = new Vector3();
  const local = new Vector3();
  const view: DrawerView = {
    root,
    pull: pullAnchor,
    get openAmount() {
      return amount;
    },
    set(open) {
      amount = clamp01(open);
      const out = smooth(clamp01(amount / SLIDE_END));
      const tip = smooth(clamp01((amount - SLIDE_END) / (TIP_END - SLIDE_END)));
      const swing = smooth(clamp01((amount - TIP_END) / (1 - TIP_END)));
      slide.position.z = spec.attach.travelM * out;
      root.visible = amount > 0.002;
      for (const { s, tip: hinge, anchor } of slots) {
        // Lying flat behind its line, it tips up about that line onto its long edge.
        hinge.rotation.x = -(Math.PI / 2) * (1 - tip);
        const phi = (Math.PI / 2) * swing;
        const L = s.paintedLengthM;
        const W = s.paintedWidthM;
        anchor.position.set(s.flatXM + (s.standXM - s.flatXM) * swing, (L / 2) * Math.sin(phi) + (W / 2) * Math.cos(phi), 0);
        anchor.rotation.z = s.turn * (Math.PI / 2) * (1 - swing);
      }
    },
    anchor: (objectId) => slots.find((x) => x.s.object === objectId)?.anchor ?? null,
    slotSize: (objectId) => {
      const s = spec.slots.find((x) => x.object === objectId);
      return s ? [s.paintedLengthM, s.paintedWidthM] : null;
    },
    over(point) {
      if (amount < SLIDE_END) return false;
      local.copy(point);
      tray.worldToLocal(local);
      return Math.abs(local.x) <= tw / 2 && Math.abs(local.y) <= td / 2;
    },
    floorWorldY() {
      return tray.getWorldPosition(world).y;
    },
  };
  view.set(0);
  return view;
}
