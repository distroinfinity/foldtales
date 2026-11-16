import { AddEquation, AdditiveBlending, BoxGeometry, CircleGeometry, ConeGeometry, CustomBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, Object3D, OneFactor, PlaneGeometry, ShaderMaterial, Vector3, ZeroFactor, type BufferAttribute, type Texture } from '@iwsdk/core';
import { cardMaterial, surfaceMaterial } from '../paint/card-material.ts';
import { subUv, type TexRef } from '../paint/texref.ts';
import type { Unfold } from '../show/cues.ts';
import { coverRotationZ, halfUv, layerRotationX } from './fold.ts';
import type { BookSpec, SetSpec } from './spec.ts';

export interface BookCard {
  id: string;
  /** The right page's Group; its renderOrder is the card's place in the stack. */
  root: Group;
  groups: Group[];
  /** One hinge per half. A character has none: it folds itself. */
  hinges: Object3D[];
}

export interface BookView {
  /** The spine's centre on the table. Stage space: x right, y up, +z toward the reader. */
  root: Object3D;
  /** The cover and left page, turning about the spine. */
  leftHalf: Object3D;
  /** Height of the open pages above the table. */
  pageY: number;
  /** The stack showing now: one card per entry in the set's stack, the same count for every set. */
  cards: BookCard[];
  /** Where each character on stage stands. Add its puppet here. Plain objects, so they draw at the actors' place in the stack. */
  mounts: Map<string, Object3D>;
  /** Characters and objects stand in these: the actors' place in the stack, and in front of the front card. */
  actorLayer: Group;
  frontLayer: Group;
  /** Past this depth, something on the page draws in front of the front card. */
  frontHingeZ: number;
  /** The set showing on each page. During a page turn the right page changes first. */
  setSets(left: string, right: string): void;
  /** Which set's cards stand. */
  setStack(set: string): void;
  /** A page turning from right to left, 0 lying on the right to 1 lying on the left, between two sets. Null hides it. */
  setLeaf(turn: number | null, from: string, to: string): void;
  /** The page corner lifting to invite a turn, 0 to 1, with its gold edge. */
  setCorner(lift: number, glow: number): void;
  /** Where the corner is, in world space, for the hand. */
  cornerWorld(target: Vector3): Vector3;
  setLamp(lit: boolean): void;
  /** Faces the reader on the closed cover, for the title. */
  titleAnchor: Object3D;
  /** On the open spread's caption band, facing up. */
  captionAnchor: Object3D;
  /** How far a stack entry stands right now, 0 to about 1. */
  standOf(id: string): number;
  /** A place on the open page for one more character (the cast review): it hides with the pop-ups when the book shuts. */
  addMount(name: string, position: [number, number, number]): Group;
  update(unfold: Unfold, shiver: number, seconds: number, hideFlat?: boolean): void;
  /** Lifts the ribbon off the page while the show is paused by it. */
  setRibbon(lift: number): void;
  /**
   * The lit lamp's beam: a faint cone in the air, turning. Azimuth in the book's frame, 0 toward you. `reachM`
   * (world metres) draws it on out to your walls, where your real room's depth ends it; `from` (world) sends it
   * from another light than the set's lamp (a keeper's light held up high).
   */
  setBeam(azimuth: number, strength: number, opts?: { reachM?: number; from?: Vector3 | null }): void;
  /** The lighthouse lamp, in world space, for the beam on your walls. Null if the set has none. */
  lampWorld(target: Vector3): Vector3 | null;
}

export interface BookInput {
  book: BookSpec;
  /** Every set the book shows, first one first. */
  sets: Array<{ id: string; spec: SetSpec; base: string }>;
  textures: Map<string, TexRef>;
  bookBase: string;
  /** Soft gradients: a round shadow, one dark at its bottom edge (hinges), one dark at its left edge (the gutter). */
  soft: { shadow: Texture; hinge: Texture; gutter: Texture };
  castOnStage: string[];
}

/** Effects that float over the whole stack (leaves, the beam, hand halos, the ember) draw after every card. */
export const OVER_STACK = 50;
/** The caption's share of the open spread's width; the ribbon lies just outside it. */
export const CAPTION_WIDTH_SHARE = 0.8;
/** Where the ribbon's tail lies across the right page, as a share of the page's width. */
export const RIBBON_X_SHARE = 0.9;

const BOARD_M = 0.0025;
const BOARD_LIP_M = 0.003;
const LIFT_M = 0.0003;
const BACK_OFFSET_M = 0.0008;
const HINGE_SHADOW_M = 0.022;
const NAVY = '#1F2A44';

/** An art path from a base folder and a file that may climb out of it with `../`. */
export const artJoin = (base: string, file: string): string => (file.startsWith('../') ? joinRelative(base, file) : `${base}/${file}`);

function joinRelative(base: string, file: string): string {
  const parts = base.split('/');
  for (const piece of file.split('/')) {
    if (piece === '..') parts.pop();
    else parts.push(piece);
  }
  return parts.join('/');
}

/** Every file the book and its set need, as art paths. */
export function bookFiles(book: BookSpec, bookBase: string, set: SetSpec, setBase: string): string[] {
  const files = [
    ...Object.values(book.parts).map((part) => artJoin(bookBase, part.file)),
    artJoin(setBase, set.ground.file),
    ...set.layers.map((layer) => artJoin(setBase, layer.file)),
  ];
  return [...new Set(files)];
}

function plane(width: number, height: number, uv?: { u: [number, number]; v?: [number, number]; flip?: boolean }): PlaneGeometry {
  const geometry = new PlaneGeometry(width, height);
  if (uv) {
    const attr = geometry.getAttribute('uv') as BufferAttribute;
    const [u0, u1] = uv.u;
    const [v0, v1] = uv.v ?? [0, 1];
    for (let i = 0; i < attr.count; i++) {
      let u = attr.getX(i);
      let v = attr.getY(i);
      if (uv.flip) {
        u = 1 - u;
        v = 1 - v;
      }
      attr.setXY(i, u0 + (u1 - u0) * u, v0 + (v1 - v0) * v);
    }
    attr.needsUpdate = true;
  }
  return geometry;
}

const flatUp = (mesh: Mesh): Mesh => {
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
};

export function buildBook({ book, sets, textures, bookBase, soft, castOnStage }: BookInput): BookView {
  const set = sets[0]!.spec;
  const setBase = sets[0]!.base;
  const tex = (file: string): TexRef => {
    const ref = textures.get(file);
    if (!ref) throw new Error(`${file} was not loaded`);
    return ref;
  };
  /** Box faces map 0..1, so a padded texture is framed by its own offset and repeat instead. */
  const boxed = (ref: TexRef): TexRef => {
    const [u0, v0, u1, v1] = ref.uv;
    ref.texture.offset.set(u0, v0);
    ref.texture.repeat.set(u1 - u0, v1 - v0);
    return ref;
  };
  const card = (ref: TexRef, options: Parameters<typeof cardMaterial>[1] = {}) => cardMaterial(ref.texture, { baked: ref.baked, ...options });
  const sheet = (ref: TexRef, width: number, height: number, uv: { u?: [number, number]; v?: [number, number]; flip?: boolean } = {}) =>
    plane(width, height, { ...subUv(ref, uv.u ?? [0, 1], uv.v ?? [0, 1]), flip: uv.flip });
  const [W, D] = book.closedSizeM;
  const half = book.thicknessM / 2;
  const pageY = half;

  const root = new Object3D();
  root.name = 'book';
  const grounds: Array<{ set: string; side: 'left' | 'right'; mesh: Mesh }> = [];

  const navy = surfaceMaterial({ color: NAVY });
  const cloth = surfaceMaterial({ ref: boxed(tex(artJoin(bookBase, book.parts.spine.file))) });
  const edge = surfaceMaterial({ ref: boxed(tex(artJoin(bookBase, book.parts['page-edge'].file))), over: book.pageColor });
  const paper = surfaceMaterial({ color: book.pageColor });

  // One half of the book: a board and a page block. `side` is +1 for the right, -1 for the left.
  function bookHalf(side: 1 | -1): Object3D {
    const holder = new Object3D();
    holder.name = side === 1 ? 'right-half' : 'left-half-content';
    const boardW = W + BOARD_LIP_M;
    const board = new Mesh(new BoxGeometry(boardW, BOARD_M, D + 2 * BOARD_LIP_M), [cloth, cloth, navy, navy, cloth, cloth]);
    board.position.set((side * boardW) / 2, BOARD_M / 2, 0);
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z. The gutter face is the spine.
    const blockH = half - BOARD_M;
    const gutter = side === 1 ? 1 : 0;
    const faces = [edge, edge, paper, paper, edge, edge];
    faces[gutter] = cloth;
    const block = new Mesh(new BoxGeometry(W - 0.0005, blockH, D), faces);
    block.position.set(side * (W / 2 + 0.00025), BOARD_M + blockH / 2, 0);
    holder.add(board, block);

    for (const each of sets) {
      const groundRef = tex(artJoin(each.base, each.spec.ground.file));
      const ground = flatUp(new Mesh(sheet(groundRef, W, D, { u: side === 1 ? [0.5, 1] : [0, 0.5] }), card(groundRef, { solid: true })));
      ground.name = `${side === 1 ? 'ground-right' : 'ground-left'}:${each.id}`;
      ground.position.set((side * W) / 2, half + LIFT_M, 0);
      ground.visible = each === sets[0];
      holder.add(ground);
      grounds.push({ set: each.id, side: side === 1 ? 'right' : 'left', mesh: ground });
    }

    // Darkest at the fold, as a real spread curves into its gutter.
    const gutterShade = flatUp(new Mesh(plane(0.026, D, { u: side === 1 ? [0, 1] : [1, 0] }), new MeshBasicMaterial({ map: soft.gutter, transparent: true, depthWrite: false, opacity: 0.32, toneMapped: false })));
    gutterShade.name = 'gutter-shade';
    gutterShade.position.set(side * 0.013, half + LIFT_M * 2, 0);
    gutterShade.renderOrder = -1;
    holder.add(gutterShade);
    return holder;
  }

  const right = bookHalf(1);
  root.add(right);

  // The left half turns about the spine line at page height.
  const leftHalf = new Object3D();
  leftHalf.name = 'left-half';
  leftHalf.position.set(0, half, 0);
  const leftContent = bookHalf(-1);
  leftContent.position.set(0, -half, 0);
  leftHalf.add(leftContent);
  root.add(leftHalf);

  // The cover's outside is the left board's underside. Closed, it faces up, spine on the left.
  const coverRef = tex(artJoin(bookBase, book.parts.cover.file));
  const cover = new Mesh(sheet(coverRef, W + BOARD_LIP_M, D + 2 * BOARD_LIP_M, { flip: true }), surfaceMaterial({ ref: coverRef }));
  cover.name = 'cover-front';
  cover.rotation.x = Math.PI / 2;
  cover.position.set(-(W + BOARD_LIP_M) / 2, -LIFT_M, 0);
  leftContent.add(cover);
  const titleAnchor = new Object3D();
  titleAnchor.name = 'title-anchor';
  titleAnchor.rotation.set(Math.PI / 2, 0, Math.PI);
  titleAnchor.position.set(-(W + BOARD_LIP_M) / 2, -LIFT_M * 2, -D / 2 + D * 0.19);
  leftContent.add(titleAnchor);

  // Ribbon, tabs and drawer pull, where book.json attaches them.
  const ribbonSpec = book.parts.ribbon;
  // The ribbon's tail lies at the near edge of the right page, where a bookmark hangs out of a real
  // book and within easy reach (moved from the far edge after the first headset session). It hinges
  // at its inner end and lifts toward you while it holds the show.
  const ribbonRef = tex(artJoin(bookBase, ribbonSpec.file));
  const [ribbonW, ribbonL] = ribbonSpec.sizeM;
  const ribbonPivot = new Object3D();
  ribbonPivot.name = 'ribbon-pivot';
  ribbonPivot.position.set(W * RIBBON_X_SHARE, half + LIFT_M * 3, D / 2 - ribbonL - 0.004);
  const ribbon = flatUp(new Mesh(sheet(ribbonRef, ribbonW, ribbonL), card(ribbonRef, { doubleSided: true })));
  ribbon.name = 'ribbon';
  ribbon.position.z = ribbonL / 2;
  ribbonPivot.add(ribbon);
  right.add(ribbonPivot);
  // The gold tab is the satchel's latch. The ribbon is the book's one control, so the sage tab is gone.
  for (const [key, fromFar] of [['tab-gold', 0.06]] as const) {
    const spec = book.parts[key];
    const tabRef = tex(artJoin(bookBase, spec.file));
    const tab = flatUp(new Mesh(sheet(tabRef, ...spec.sizeM), card(tabRef, { doubleSided: true })));
    tab.name = key;
    tab.position.set(W - 0.006 + spec.sizeM[0] / 2, half - 0.004, -D / 2 + fromFar);
    right.add(tab);
  }
  const pullSpec = book.parts['drawer-pull'];
  const pullH = (half - BOARD_M) * 0.85;
  const pullW = pullH * (pullSpec.sizeM[0] / pullSpec.sizeM[1]) * 1.4;
  const pullRef = tex(artJoin(bookBase, pullSpec.file));
  const pull = new Mesh(sheet(pullRef, pullW, pullH), card(pullRef));
  pull.name = 'drawer-pull';
  pull.position.set(W / 2, BOARD_M + (half - BOARD_M) / 2, D / 2 + 0.0006);
  right.add(pull);

  // Pop-up cards, back to front. Each layer is two rigid halves; characters fold themselves.
  // Every set has the same stack shape, so one unfold drives whichever set is showing. A layer
  // that two sets share (the sky, the headland) is built once, so turning the page never swaps it.
  const order = set.stack.topToBottom;
  const extraMounts: Group[] = [];
  const mounts = new Map<string, Object3D>();
  const shadows: Array<{ index: number; mesh: Mesh; set: string }> = [];
  const lastLayerIndex = [...order.keys()].reverse().find((i) => set.layers.some((layer) => layer.id === order[i]))!;
  const cardsBySet = new Map<string, BookCard[]>();
  const builtLayers = new Map<string, BookCard>();
  const actorLayer = new Group();
  actorLayer.name = 'actors';
  const frontLayer = new Group();
  frontLayer.name = 'front-actors';
  frontLayer.renderOrder = order.length + 1;
  root.add(actorLayer, frontLayer);
  let frontHingeZ = 0;

  for (const each of sets) {
    const list: BookCard[] = [];
    each.spec.stack.topToBottom.forEach((id, index) => {
      const groupOrder = index + 1;
      const layer = each.spec.layers.find((l) => l.id === id);
      if (!layer) {
        actorLayer.renderOrder = groupOrder;
        list.push({ id: `actors@${index}`, root: actorLayer, groups: [actorLayer], hinges: [] });
        return;
      }
      if (index === lastLayerIndex) frontHingeZ = Math.max(frontHingeZ, layer.hinge[0][2]);
      const key = `${index}:${artJoin(each.base, layer.file)}:${layer.hinge[0][2]}`;
      const shared = builtLayers.get(key);
      if (shared) {
        list.push(shared);
        return;
      }
      const map = tex(artJoin(each.base, layer.file));
      const [lw, lh] = layer.sizeM;
      const hingeZ = layer.hinge[0][2];
      const groups: Group[] = [];
      const hinges: Object3D[] = [];
      for (const side of ['left', 'right'] as const) {
        const group = new Group();
        group.name = `${id}:${side}:${each.id}`;
        group.renderOrder = groupOrder;
        const hinge = new Object3D();
        hinge.name = `${id}:${side}:hinge`;
        hinge.position.set(0, pageY, hingeZ);
        const u = halfUv(side, layer.splitColumnPx, layer.sizePx[0]);
        const width = lw * (u[1] - u[0]);
        const x = side === 'left' ? -width / 2 : width / 2;
        const front = new Mesh(sheet(map, width, lh, { u }), card(map));
        front.name = 'front';
        front.position.set(x, lh / 2, 0);
        const back = new Mesh(sheet(map, width, lh, { u }), card(map, { face: 'back', pool: false }));
        back.name = 'back';
        back.rotation.y = Math.PI;
        back.position.set(x, lh / 2, -BACK_OFFSET_M);
        hinge.add(front, back);
        group.add(hinge);
        const shadow = flatUp(new Mesh(plane(width, HINGE_SHADOW_M), new MeshBasicMaterial({ map: soft.hinge, transparent: true, depthWrite: false, opacity: 0, toneMapped: false })));
        shadow.name = 'hinge-shadow';
        shadow.position.set(x, pageY + LIFT_M * 2, hingeZ - HINGE_SHADOW_M / 2);
        shadow.renderOrder = -1;
        group.add(shadow);
        shadows.push({ index, mesh: shadow, set: each.id });
        (side === 'left' ? leftContent : right).add(group);
        groups.push(group);
        hinges.push(hinge);
      }
      const built = { id, root: groups[1]!, groups, hinges };
      builtLayers.set(key, built);
      list.push(built);
    });
    cardsBySet.set(each.id, list);
  }
  // The opening cast stands in the actors' place, each on its own mount.
  for (const id of castOnStage) {
    const mark = set.marks.find((m) => m.id === id) ?? set.marks[0]!;
    const mount = new Object3D();
    mount.name = `mount:${id}`;
    mount.position.set(mark.position[0], pageY + LIFT_M * 2, mark.position[2]);
    actorLayer.add(mount);
    mounts.set(id, mount);
  }
  let stackSet = sets[0]!.id;
  let cards = cardsBySet.get(stackSet)!;
  const allCards = [...new Set([...cardsBySet.values()].flat())];
  // Only the opening set's cards exist until a page turns.
  for (const c of allCards) if (!cards.includes(c)) for (const g of c.groups) if (g !== actorLayer) g.visible = false;

  // The leaf that turns: the old right page on its face, the new left page on its back.
  const leafPivot = new Object3D();
  leafPivot.name = 'leaf';
  leafPivot.position.set(0, pageY + LIFT_M * 6, 0);
  leafPivot.visible = false;
  root.add(leafPivot);
  const leafFaces = new Map<string, { front: Mesh; back: Mesh }>();
  for (const each of sets) {
    const groundRef = tex(artJoin(each.base, each.spec.ground.file));
    const front = flatUp(new Mesh(sheet(groundRef, W, D, { u: [0.5, 1] }), card(groundRef, { solid: true })));
    front.position.x = W / 2;
    front.name = `leaf-front:${each.id}`;
    // Seen from below while lying on the right; once over, it lies face up on the left as that set's left page.
    const back = new Mesh(sheet(groundRef, W, D, { u: [0, 0.5] }), card(groundRef, { solid: true }));
    back.rotation.x = Math.PI / 2;
    back.rotation.z = Math.PI;
    back.position.set(W / 2, -0.0002, 0);
    back.name = `leaf-back:${each.id}`;
    front.visible = back.visible = false;
    leafPivot.add(front, back);
    leafFaces.set(each.id, { front, back });
  }

  // The page's outer edge, lifting to invite a turn: a half-round lip curling up about a line
  // just inside the edge, with a soft gold glow. Mid-edge, clear of the ribbon at the near corner.
  const LIP_M = 0.044;
  const cornerPivot = new Object3D();
  cornerPivot.name = 'page-lip';
  cornerPivot.position.set(W - LIP_M, pageY + LIFT_M * 5, 0.03);
  const lipGeometry = new CircleGeometry(LIP_M, 20, -Math.PI / 2, Math.PI);
  const lipMaterial = surfaceMaterial({ color: book.pageColor });
  lipMaterial.side = DoubleSide;
  const triangle = new Mesh(lipGeometry, lipMaterial);
  triangle.name = 'lip';
  triangle.rotation.x = -Math.PI / 2;
  const cornerHinge = new Object3D();
  cornerHinge.add(triangle);
  cornerPivot.add(cornerHinge);
  const cornerGlow = flatUp(new Mesh(new PlaneGeometry(LIP_M * 3, LIP_M * 3.4), new MeshBasicMaterial({ map: soft.shadow, color: '#D4A23E', transparent: true, depthWrite: false, opacity: 0, blending: AdditiveBlending, toneMapped: false })));
  cornerGlow.name = 'lip-glow';
  cornerGlow.position.set(LIP_M * 0.6, 0.001, 0);
  cornerGlow.renderOrder = OVER_STACK;
  cornerPivot.add(cornerGlow);
  const lipTip = new Object3D();
  lipTip.position.set(LIP_M * 0.8, 0, 0);
  cornerHinge.add(lipTip);
  cornerPivot.visible = false;
  right.add(cornerPivot);

  const bookShadow = flatUp(new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: soft.shadow, transparent: true, depthWrite: false, toneMapped: false })));
  bookShadow.name = 'book-shadow';
  bookShadow.position.y = 0.0004;
  bookShadow.renderOrder = -2;
  root.add(bookShadow);

  const captionAnchor = new Object3D();
  captionAnchor.name = 'caption-anchor';
  captionAnchor.rotation.x = -Math.PI / 2;
  captionAnchor.position.set(0, pageY + LIFT_M * 4, D / 2 - set.ground.captionBandM / 2);
  root.add(captionAnchor);

  // The beam's cone, pivoting on the lighthouse lamp the art painted.
  // Each set may have its own lighthouse lamp: the opening's up close, the gap's far off. The beam
  // pivots on whichever lamp the showing set has.
  const lamps = new Map<string, { anchor: [number, number, number] | null; lit: Mesh | null }>();
  const beamPivot = new Group();
  beamPivot.name = 'beam';
  beamPivot.renderOrder = OVER_STACK;
  const BEAM_LENGTH_M = 0.45;
  const beamMaterial = new ShaderMaterial({
    uniforms: { uStrength: { value: 0 } },
    vertexShader: 'varying float vAlong; void main() { vAlong = 1.0 - uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uStrength; varying float vAlong; void main() { float a = uStrength * 0.32 * pow(1.0 - vAlong, 0.9); gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * a, 0.0); }',
    transparent: true,
    depthWrite: false,
    // Light added, alpha left alone: over passthrough, more alpha would hide more of your room, so an additive
    // shaft that also added alpha read as a dark wedge. Your room shows through it, brighter.
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
    side: DoubleSide,
    toneMapped: false,
  });
  const cone = new Mesh(new ConeGeometry(0.06, BEAM_LENGTH_M, 24, 1, true), beamMaterial);
  cone.rotation.x = -Math.PI / 2;
  cone.position.z = BEAM_LENGTH_M / 2;
  cone.renderOrder = 80;
  beamPivot.add(cone);
  beamPivot.visible = false;
  root.add(beamPivot);
  for (const each of sets) {
    const anchor = (each.spec.anchors.lighthouseLamp?.position as [number, number, number] | undefined) ?? null;
    const spec = each.spec.effects['lamp-lit'] as { file: string; px?: [number, number]; sizeM?: [number, number]; layer?: string } | undefined;
    let lit: Mesh | null = null;
    if (spec?.px && spec.sizeM && spec.layer) {
      const layer = each.spec.layers.find((l) => l.id === spec.layer);
      const card = cardsBySet.get(each.id)!.find((c) => c.id === spec.layer);
      const ref = textures.get(artJoin(each.base, spec.file));
      if (layer && card && ref) {
        const [w, h] = spec.sizeM;
        const x = spec.px[0] / each.spec.pxPerM - layer.sizeM[0] / 2 + w / 2;
        const y = layer.sizeM[1] - spec.px[1] / each.spec.pxPerM - h / 2;
        lit = new Mesh(sheet(ref, w, h), cardMaterial(ref.texture, { baked: ref.baked, pool: false }));
        lit.name = `lamp-lit:${each.id}`;
        lit.position.set(x, y, 0.0005);
        lit.visible = false;
        (x < 0 ? card.hinges[0]! : card.hinges[1]!).add(lit);
      }
    }
    lamps.set(each.id, { anchor, lit });
  }
  const placeBeam = (setId: string) => {
    const a = lamps.get(setId)?.anchor;
    if (a) beamPivot.position.set(a[0], pageY + a[1], a[2]);
  };
  placeBeam(sets[0]!.id);
  const beamFrom = new Vector3();

  const stands = new Map<string, number>();
  const flatOffset = set.stack.flatOffsetM;
  let lampOn = false;
  void setBase;

  return {
    root,
    leftHalf,
    pageY,
    get cards() {
      return cards;
    },
    mounts,
    actorLayer,
    frontLayer,
    frontHingeZ,
    setSets(left, rightSet) {
      for (const g of grounds) g.mesh.visible = g.set === (g.side === 'left' ? left : rightSet);
    },
    setStack(next) {
      if (!cardsBySet.has(next) || next === stackSet) return;
      stackSet = next;
      placeBeam(next);
      for (const [id, lamp] of lamps) if (lamp.lit && id !== next) lamp.lit.visible = false;
      cards = cardsBySet.get(next)!;
      const showing = new Set(cards);
      for (const c of allCards) if (!showing.has(c)) for (const g of c.groups) if (g !== actorLayer) g.visible = false;
    },
    setLeaf(turn, from, to) {
      leafPivot.visible = turn !== null;
      for (const [id, faces] of leafFaces) {
        faces.front.visible = turn !== null && id === from;
        faces.back.visible = turn !== null && id === to;
      }
      if (turn !== null) {
        const t = Math.max(0, Math.min(1, turn));
        leafPivot.rotation.z = Math.PI * t;
        // A real leaf lifts in a curve: rise a touch off the spine as it passes the top.
        leafPivot.position.y = pageY + LIFT_M * 6 + 0.002 * Math.sin(Math.PI * t);
      }
    },
    setCorner(lift, glow) {
      cornerPivot.visible = lift > 0.001 || glow > 0.001;
      cornerHinge.rotation.z = lift * 1.05;
      (cornerGlow.material as MeshBasicMaterial).opacity = 0.8 * glow;
    },
    cornerWorld(target) {
      return lipTip.getWorldPosition(target);
    },
    setLamp(lit) {
      lampOn = lit;
      const lamp = lamps.get(stackSet)?.lit;
      if (lamp) lamp.visible = lit;
    },
    titleAnchor,
    captionAnchor,
    // Anyone not in the stack stands once the front card has: they arrive with the open book.
    standOf: (id) => stands.get(id) ?? stands.get(`actors@${order.findIndex((o) => !set.layers.some((l) => l.id === o))}`) ?? 0,
    addMount(name, [x, y, z]) {
      const mount = new Group();
      mount.name = name;
      mount.renderOrder = 4;
      mount.position.set(x, pageY + y, z);
      root.add(mount);
      extraMounts.push(mount);
      return mount;
    },
    setBeam(azimuth, strength, opts) {
      beamPivot.visible = strength > 0.001;
      beamPivot.rotation.y = azimuth;
      beamMaterial.uniforms.uStrength!.value = strength;
      if (opts?.from) beamPivot.position.copy(root.worldToLocal(beamFrom.copy(opts.from)));
      else placeBeam(stackSet);
      // Out to the walls: the same cone, longer and wider alike, so it keeps its angle.
      const reach = opts?.reachM ? opts.reachM / Math.max(1e-3, root.getWorldScale(beamFrom).x) : BEAM_LENGTH_M;
      cone.scale.setScalar(reach / BEAM_LENGTH_M);
      cone.position.z = reach / 2;
      const lamp = lamps.get(stackSet)?.lit;
      if (lamp) lamp.visible = lampOn || strength > 0.001;
    },
    lampWorld(target) {
      const a = lamps.get(stackSet)?.anchor;
      if (!a) return null;
      return root.localToWorld(target.set(a[0], pageY + a[1], a[2]));
    },
    setRibbon(lift) {
      ribbonPivot.rotation.x = -lift * 0.9;
    },
    update(unfold, shiver, seconds, hideFlat = false) {
      leftHalf.rotation.z = coverRotationZ(unfold.cover);
      const anyOpen = unfold.cover > 0.001 || unfold.layers.some((l) => l > 0);
      for (const mount of extraMounts) mount.visible = anyOpen;
      cards.forEach((card, index) => {
        const stand = unfold.layers[index] ?? 0;
        stands.set(card.id, stand);
        // While a page turns, cards lying flat fold away into it.
        const shown = anyOpen && !(hideFlat && stand <= 0.001);
        for (const group of card.groups) if (group !== actorLayer) group.visible = shown;
        const lift = flatOffset * (cards.length - index) * (1 - Math.min(1, stand));
        const wobble = index === lastLayerIndex ? ((4 * Math.PI) / 180) * shiver * Math.sin(Math.floor(seconds * 12) * 1.17) : 0;
        for (const hinge of card.hinges) {
          hinge.rotation.x = layerRotationX(stand) + wobble;
          hinge.position.y = pageY + lift;
        }
      });
      actorLayer.visible = frontLayer.visible = anyOpen;
      for (const { index, mesh, set: owner } of shadows) (mesh.material as MeshBasicMaterial).opacity = owner === stackSet || cardsBySet.get(stackSet)!.some((c) => c.groups.includes(mesh.parent as Group)) ? 0.28 * Math.max(0, Math.min(1, unfold.layers[index] ?? 0)) : 0;
      // The shadow covers the closed book, then spreads under the open spread.
      const width = W * (1.18 + 1.06 * unfold.cover);
      bookShadow.scale.set(width, D * 1.22, 1);
      bookShadow.position.x = (W / 2) * (1 - unfold.cover);
    },
  };
}
