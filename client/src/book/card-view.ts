import { BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, SRGBColorSpace, Vector3, type Texture } from '@iwsdk/core';
import { Text } from 'troika-three-text';
import titleFont from '@fontsource/fraunces/files/fraunces-latin-500-normal.woff?url';
import captionFont from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-500-normal.woff?url';
import { arrangeCard, cardWidthFor, columnFor, emFor, type CardGeometry } from './card-layout.ts';
import { createPresser, PRESS_TRAVEL_M, type PressButton, type Side } from '../stage/press.ts';

/**
 * The book's menu card (docs/plans/2026-11-16-hands-and-controls.md). When the story pauses, the pop-up
 * stage folds down flat and this card rises on its own: a clean-cut paper board, world-locked at touch
 * distance (about 45 cm from your eyes) above the folded book, level and turned to face you. It never
 * covers the stage, because the stage is lying flat under it.
 *
 * Each choice is a paper button standing 7 mm proud of the card. You press it with a fingertip: it sinks
 * as you push, lands with a soft tap, and its gold rule fills. A look and a pinch (VR Glasses) chooses
 * the same buttons from further away.
 */

const NAVY = '#1F2A44';
const INK = '#2B2420';
const GOLD = '#D4A23E';
const PAGE = '#F6EFE2';
/** The buttons are a lighter, newer paper than the board. */
const TAB = '#FBF7EE';
const TAB_COLOR = new Color(TAB);
/** A pushed button takes the lamp's warmth. */
const PRESSED_COLOR = new Color('#F1DDAF');
/** The board's cut edge, seen round the card's face. */
const BOARD_EDGE = '#B9A88A';
/** Drawn after the set and the room. */
const ORDER = 900;
/** How long the card takes to rise, or fold away. */
const POP_MS = 460;
/** Where the card stands: this far from your eyes (touch distance), toward the book. */
export const MENU_DISTANCE_M = 0.45;
/**
 * How far below eye level: seen from your eyes, the card's bottom edge sits just above the book's far
 * edge, so it reads as standing behind the book while it's within reach. Kept between these.
 */
const PITCH_MIN = (15 * Math.PI) / 180;
const PITCH_MAX = (40 * Math.PI) / 180;
/** The card's height assumed when it's placed (before its type is measured), and a little air above the edge. */
const PLACE_HEIGHT_M = 0.13;
const OVER_EDGE = (1.5 * Math.PI) / 180;
/** The card never comes lower than this over the folded pages. */
const CLEAR_OF_BOOK_M = 0.06;
/** Rebuilt for a new distance when you've moved this much nearer or further since it opened. */
const RELAYOUT_RATIO = 1.35;
/** The board's thickness, seen as an edge round the face. */
const BOARD_EDGE_M = 0.0025;

export interface CardChoiceSpec {
  id: string;
  label: string;
  /** False: printed faded, with no rule, and not a target. */
  enabled?: boolean;
}

export interface CardSpec {
  over?: string | null;
  title?: string | null;
  lines?: string[];
  note?: string | null;
  choices: CardChoiceSpec[];
}

export interface CardTarget {
  id: string;
  position: Vector3;
  radiusM: number;
}

/** How the card reads from where you are: every printed line's height in degrees, the targets' spacing, its extent. */
export interface CardReport {
  textDeg: Array<{ what: string; deg: number }>;
  minTextDeg: number;
  /** The smallest distance between two buttons' centres, in metres (Infinity with fewer than two). */
  minTargetGapM: number;
  /** The smallest plain card between two buttons' edges, in metres. */
  minButtonGapM: number;
  /** The smallest button, in metres. */
  minButtonM: { w: number; h: number };
  extentDeg: { left: number; right: number; up: number; down: number };
  extentFromCardDeg: { left: number; right: number; up: number; down: number };
  sizeM: { w: number; h: number };
  distanceM: number;
}

// ---- paper, drawn once ---------------------------------------------------------------------------

const TEX = 256;
/** The share of the texture each corner of a nine-sliced piece takes. */
const SLICE = 48 / TEX;

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX;
  draw(canvas.getContext('2d')!, TEX);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The board's face: page paper with a little tooth, and a fine double rule inset like a bookplate's. */
function boardFace(): CanvasTexture {
  return canvasTexture((ctx, s) => {
    roundRect(ctx, 2, 2, s - 4, s - 4, 18);
    ctx.fillStyle = PAGE;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // The paper's tooth: faint warm specks, never a pattern you can see at reading distance.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(120,96,60,0.05)' : 'rgba(255,255,255,0.07)';
      ctx.fillRect(rand() * s, rand() * s, 1.4, 1.4);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(43,36,32,0.34)';
    ctx.lineWidth = 2;
    roundRect(ctx, 20, 20, s - 40, s - 40, 6);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(43,36,32,0.22)';
    roundRect(ctx, 26, 26, s - 52, s - 52, 4);
    ctx.stroke();
  });
}

/** A plain rounded shape, white, tinted by its material: the board's edge, a button, its shadow. */
function roundShape(soft = 0): CanvasTexture {
  return canvasTexture((ctx, s) => {
    if (soft) ctx.filter = `blur(${soft}px)`;
    const inset = 4 + soft * 2;
    roundRect(ctx, inset, inset, s - 2 * inset, s - 2 * inset, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
}

/** The soft gold edge that shows where a fingertip is near. */
function ringShape(): CanvasTexture {
  return canvasTexture((ctx, s) => {
    ctx.filter = 'blur(3px)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 9;
    roundRect(ctx, 12, 12, s - 24, s - 24, 20);
    ctx.stroke();
  });
}

function shadowBlob(): CanvasTexture {
  return canvasTexture((ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(12,10,14,0.5)');
    g.addColorStop(0.55, 'rgba(12,10,14,0.22)');
    g.addColorStop(1, 'rgba(12,10,14,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/** A w × h quad cut in nine, so its corners and rules keep their size at any proportion. Origin at its centre. */
function nineSlice(w: number, h: number, cornerM: number): BufferGeometry {
  const c = Math.min(cornerM, w / 2, h / 2);
  const xs = [-w / 2, -w / 2 + c, w / 2 - c, w / 2];
  const ys = [-h / 2, -h / 2 + c, h / 2 - c, h / 2];
  const us = [0, SLICE, 1 - SLICE, 1];
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      const base = pos.length / 3;
      for (const [xi, yi] of [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]] as const) {
        pos.push(xs[xi]!, ys[yi]!, 0);
        uv.push(us[xi]!, us[yi]!);
      }
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

function flat(map: Texture, color: string, opacity = 1): MeshBasicMaterial {
  return new MeshBasicMaterial({ map, color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false, side: DoubleSide });
}

function makeText(text: string, font: string, sizeM: number, color: string, maxWidth: number, align: 'left' | 'center'): Text {
  const t = new Text();
  t.text = text;
  t.font = font;
  t.fontSize = sizeM;
  t.color = color;
  t.maxWidth = maxWidth;
  t.lineHeight = 1.12;
  t.textAlign = align;
  t.anchorX = 'center';
  t.anchorY = 'top';
  t.material = new MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
  t.renderOrder = ORDER + 6;
  return t;
}

const synced = (t: Text) => new Promise<void>((resolve) => t.sync(resolve));
const boundsOf = (t: Text) => (t as unknown as { textRenderInfo?: { blockBounds: [number, number, number, number] } }).textRenderInfo?.blockBounds;
/** A rendered block's height, from troika's measured bounds. */
const heightOf = (t: Text): number => {
  const b = boundsOf(t);
  return b ? b[3] - b[1] : t.fontSize * 1.2;
};

interface Button {
  id: string;
  cell: { x: number; y: number; w: number; h: number };
  /** Moves toward the card as it's pressed. */
  top: Group;
  face: Mesh;
  shadow: Mesh;
  ring: Mesh;
  rule: Mesh;
  ruleH: number;
  /** 0 at rest, 1 pushed flush. */
  depth: number;
  /** A short gold flash once a press lands. */
  landedMs: number;
}

export interface CardViewDeps {
  /** The book's root, so the card stands over it and its shadow falls on its pages. */
  bookRoot: Object3D;
  pageY: number;
  /** The closed book's depth, in its own frame: its far edge is half this behind the spine's middle. */
  pageD: number;
  scene: Object3D;
}

export interface PressInput {
  tip: Vector3 | null;
  pinching: boolean;
}

export function createCardView(deps: CardViewDeps) {
  const faceTexture = boardFace();
  const shapeTexture = roundShape();
  const softTexture = roundShape(6);
  const ringTexture = ringShape();
  const blobTexture = shadowBlob();
  const boardMaterial = flat(faceTexture, '#ffffff');
  const edgeMaterial = flat(shapeTexture, BOARD_EDGE);

  /** World-locked where it rose; faces you. The hinge under it stands the card up from its bottom edge. */
  const pivot = new Group();
  pivot.name = 'book-menu-card';
  // A Group's renderOrder sorts everything in it ahead of its children's own.
  pivot.renderOrder = ORDER;
  pivot.visible = false;
  deps.scene.add(pivot);
  const hinge = new Group();
  hinge.renderOrder = ORDER;
  pivot.add(hinge);
  // Its shadow on the folded pages, straight below: nothing floats without one.
  const shadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: blobTexture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = ORDER - 5;
  shadow.visible = false;
  deps.scene.add(shadow);
  let face: Group | null = null;

  let spec: CardSpec | null = null;
  let geometry: CardGeometry | null = null;
  let builtFor = 0;
  /** 0 folded away, 1 standing. */
  let pop = 0;
  let wanted = 0;
  let near: string | null = null;
  let building = 0;
  /** Where the card stands, fixed when it rises from nothing (world-locked). */
  const placedAt = new Vector3();
  let placed = false;
  let raisedForHeight = false;
  const buttons = new Map<string, Button>();
  const texts: Array<{ what: string; text: Text }> = [];
  const presser = createPresser();
  let clockMs = 0;
  /** Review builds: the fingertips as the card last saw them, in its own frame. */
  let lastTips: Record<Side, Vector3 | null> = { left: null, right: null };

  function clear(): void {
    if (face) {
      hinge.remove(face);
      for (const { text } of texts) text.dispose();
      face.traverse((o) => {
        if (o instanceof Mesh && !(o instanceof Text)) {
          o.geometry.dispose();
          if (o.material !== boardMaterial && o.material !== edgeMaterial) (o.material as MeshBasicMaterial).dispose();
        }
      });
    }
    face = null;
    texts.length = 0;
    buttons.clear();
  }

  /** Where the card goes: toward the book, at touch distance, its bottom edge just over the book's far edge. */
  function place(head: Vector3): void {
    const book = deps.bookRoot.getWorldPosition(new Vector3());
    const flatDir = new Vector3(book.x - head.x, 0, book.z - head.z);
    if (flatDir.lengthSq() < 1e-6) flatDir.set(0, 0, -1);
    flatDir.normalize();
    const far = deps.bookRoot.localToWorld(new Vector3(0, deps.pageY, -deps.pageD / 2));
    const farBelow = Math.atan2(head.y - far.y, Math.hypot(far.x - head.x, far.z - head.z));
    const halfCard = Math.atan(PLACE_HEIGHT_M / 2 / MENU_DISTANCE_M);
    const pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, farBelow - halfCard - OVER_EDGE));
    placedAt.copy(head).addScaledVector(flatDir, MENU_DISTANCE_M * Math.cos(pitch));
    placedAt.y -= MENU_DISTANCE_M * Math.sin(pitch);
    placed = true;
    raisedForHeight = false;
  }

  function pageWorldY(): number {
    return deps.bookRoot.localToWorld(new Vector3(0, deps.pageY, 0)).y;
  }

  /** Builds the card for this distance: type first (so it can be measured), then the paper round it. */
  async function build(next: CardSpec, distanceM: number): Promise<void> {
    const ticket = ++building;
    const em = emFor(distanceM);
    const width = cardWidthFor(em);
    const textWidth = width - 2.4 * em;
    const column = columnFor(em) - 0.8 * em;
    const made: Array<{ what: string; text: Text }> = [];
    if (next.over) made.push({ what: 'over', text: makeText(next.over, captionFont, em, INK, textWidth, 'center') });
    if (next.title) made.push({ what: 'title', text: makeText(next.title, titleFont, em * 1.25, NAVY, textWidth, 'center') });
    if (next.lines?.length) made.push({ what: 'lines', text: makeText(next.lines.join('\n'), captionFont, em, INK, textWidth, 'center') });
    if (next.note) made.push({ what: 'note', text: makeText(next.note, captionFont, em, INK, textWidth, 'center') });
    const choiceTexts = next.choices.map((c) => makeText(c.label, captionFont, em * 1.05, INK, column, 'center'));
    // The title wraps to even lines, never one word left alone: measured on one line, then given an even width.
    const title = made.find((m) => m.what === 'title')?.text;
    if (title) {
      title.maxWidth = Infinity;
      await synced(title);
      const b = boundsOf(title);
      const oneLine = b ? b[2] - b[0] : 0;
      title.maxWidth = oneLine > textWidth ? Math.min(textWidth, (oneLine / Math.ceil(oneLine / textWidth)) * 1.12) : textWidth;
    }
    await Promise.all([...made.map((m) => synced(m.text)), ...choiceTexts.map(synced)]);
    if (ticket !== building) {
      for (const t of [...made.map((m) => m.text), ...choiceTexts]) t.dispose();
      return;
    }
    const of = (what: string) => made.find((m) => m.what === what);
    const g = arrangeCard(
      {
        over: of('over') && heightOf(of('over')!.text),
        title: of('title') && heightOf(of('title')!.text),
        lines: of('lines') && heightOf(of('lines')!.text),
        note: of('note') && heightOf(of('note')!.text),
        choices: choiceTexts.map(heightOf),
      },
      em,
      width,
    );
    clear();
    const group = new Group();
    group.renderOrder = ORDER;
    // The board: its cut edge first, a hair larger, then its face.
    const edge = new Mesh(nineSlice(g.widthM + 2 * BOARD_EDGE_M, g.heightM + 2 * BOARD_EDGE_M, 0.012), edgeMaterial);
    edge.position.set(0, g.heightM / 2 - BOARD_EDGE_M * 0.6, -0.0008);
    edge.renderOrder = ORDER;
    group.add(edge);
    const board = new Mesh(nineSlice(g.widthM, g.heightM, 0.016), boardMaterial);
    board.position.set(0, g.heightM / 2, 0);
    board.renderOrder = ORDER + 1;
    group.add(board);
    for (const m of made) {
      const top = g.top[m.what as keyof CardGeometry['top']]!;
      m.text.position.set(0, top, 0.0006);
      if (m.what === 'over' || m.what === 'note') m.text.fillOpacity = 0.74;
      group.add(m.text);
      texts.push(m);
    }
    next.choices.forEach((c, i) => {
      const cell = g.cells[i]!;
      const t = choiceTexts[i]!;
      const h = heightOf(t);
      const enabled = c.enabled !== false;
      // The button's shadow on the board shrinks to nothing as it's pushed flush.
      const shadowMesh = new Mesh(nineSlice(cell.w + 0.004, cell.h + 0.004, 0.01), flat(softTexture, '#3A2A1E', 0.32));
      shadowMesh.position.set(cell.x, cell.y - 0.0025, 0.0004);
      shadowMesh.renderOrder = ORDER + 2;
      group.add(shadowMesh);
      const ring = new Mesh(nineSlice(cell.w + 0.012, cell.h + 0.012, 0.012), flat(ringTexture, GOLD, 0));
      ring.position.set(cell.x, cell.y, 0.0005);
      ring.renderOrder = ORDER + 3;
      group.add(ring);
      const top = new Group();
      top.renderOrder = ORDER + 4;
      top.position.set(cell.x, cell.y, PRESS_TRAVEL_M);
      group.add(top);
      const faceMesh = new Mesh(nineSlice(cell.w, cell.h, 0.008), flat(shapeTexture, TAB, enabled ? 1 : 0.55));
      // A name the emulator's hands can press by.
      faceMesh.name = `press:${c.id}`;
      faceMesh.renderOrder = ORDER + 4;
      top.add(faceMesh);
      t.position.set(0, h / 2 + 0.1 * g.em, 0.0006);
      t.fillOpacity = enabled ? 1 : 0.4;
      top.add(t);
      texts.push({ what: `choice:${c.id}`, text: t });
      const rule = new Mesh(new PlaneGeometry(1, 1), flat(shapeTexture, GOLD, enabled ? 0.8 : 0));
      rule.scale.set(Math.min(cell.w * 0.5, 5 * g.em), Math.max(0.0015, 0.12 * g.em), 1);
      rule.position.set(0, -h / 2 - 0.12 * g.em, 0.0005);
      rule.renderOrder = ORDER + 5;
      top.add(rule);
      if (enabled) buttons.set(c.id, { id: c.id, cell, top, face: faceMesh, shadow: shadowMesh, ring, rule, ruleH: rule.scale.y, depth: 0, landedMs: -1e9 });
    });
    face = group;
    hinge.add(group);
    hinge.position.y = 0;
    geometry = g;
    builtFor = distanceM;
    presser.reset();
    setNear(near);
  }

  function setNear(id: string | null): void {
    near = id;
  }

  /** Each button's look from its depth, the fingertip near it, and a press that just landed. */
  function paintButtons(): void {
    for (const b of buttons.values()) {
      const landed = Math.max(0, 1 - (clockMs - b.landedMs) / 380);
      b.top.position.z = PRESS_TRAVEL_M * (1 - b.depth);
      (b.shadow.material as MeshBasicMaterial).opacity = 0.32 * (1 - b.depth);
      b.shadow.position.y = b.cell.y - 0.0025 * (1 - b.depth);
      const isNear = near === b.id;
      (b.ring.material as MeshBasicMaterial).opacity = Math.max(isNear ? 0.85 : 0, landed);
      (b.face.material as MeshBasicMaterial).color.copy(TAB_COLOR).lerp(PRESSED_COLOR, Math.max(b.depth * 0.7, landed));
      (b.rule.material as MeshBasicMaterial).opacity = Math.min(1, 0.8 + 0.2 * Math.max(b.depth, landed, isNear ? 1 : 0));
      b.rule.scale.y = b.ruleH * (1 + 0.8 * Math.max(b.depth, landed));
    }
  }

  return {
    /** Opens (or replaces) the card with new contents. A card rising from nothing is placed where you are now. */
    async open(next: CardSpec, head: Vector3): Promise<void> {
      if (pop <= 0 && wanted === 0) place(head);
      spec = next;
      wanted = 1;
      pivot.visible = true;
      await build(next, head.distanceTo(placedAt));
    },
    /** Folds the card away. */
    close(): void {
      wanted = 0;
      building++;
    },
    get shown(): boolean {
      return pop > 0 || wanted > 0;
    },
    /** Standing and ready to be pressed. */
    get ready(): boolean {
      return wanted === 1 && pop >= 1 && face !== null;
    },
    get spec(): CardSpec | null {
      return spec;
    },
    get debug() {
      const r3 = (v: Vector3 | null) => v && [v.x, v.y, v.z].map((n) => +n.toFixed(3));
      return { pop: +pop.toFixed(2), wanted, builds: building, built: face !== null, at: r3(placedAt), near, tips: { left: r3(lastTips.left), right: r3(lastTips.right) } };
    },
    frame(deltaMs: number, head: Vector3): void {
      clockMs += deltaMs;
      const step = deltaMs / POP_MS;
      if (wanted > pop) pop = Math.min(1, pop + step);
      else if (wanted < pop) pop = Math.max(0, pop - step);
      if (pop <= 0 && wanted === 0) {
        if (pivot.visible) {
          pivot.visible = false;
          shadow.visible = false;
          clear();
          spec = null;
          geometry = null;
          placed = false;
        }
        return;
      }
      if (!placed) place(head);
      // Once its size is known: never down into the folded book.
      if (geometry && !raisedForHeight) {
        raisedForHeight = true;
        const lowest = pageWorldY() + CLEAR_OF_BOOK_M + geometry.heightM / 2;
        if (placedAt.y < lowest) placedAt.y = lowest;
      }
      const h = geometry?.heightM ?? 0.15;
      pivot.position.copy(placedAt);
      // Level and facing you: turned toward your eyes, never rolled.
      pivot.lookAt(head);
      // Rises from a little lower, unfolding from its bottom edge, with a slight overshoot as it lands.
      const t = pop;
      const eased = wanted ? 1 - (1 - t) ** 3 + Math.sin(Math.PI * t) * 0.05 : t * t;
      hinge.position.y = -h / 2 - (1 - eased) * 0.05;
      hinge.rotation.x = -(1 - eased) * (Math.PI / 2);
      hinge.scale.setScalar(0.7 + 0.3 * Math.min(1, t * 1.3));
      shadow.visible = true;
      shadow.position.set(placedAt.x, pageWorldY() + 0.002, placedAt.z);
      const w = geometry?.widthM ?? 0.17;
      shadow.scale.set(w * 1.15, w * 0.55, 1);
      (shadow.material as MeshBasicMaterial).opacity = 0.75 * eased;
      // Much nearer or further than when it was set: type re-sized for the new distance (never under a finger).
      const d = head.distanceTo(placedAt);
      if (spec && wanted && face && builtFor > 0 && !near && (d / builtFor > RELAYOUT_RATIO || builtFor / d > RELAYOUT_RATIO)) {
        builtFor = d;
        void build(spec, d);
      }
      paintButtons();
    },
    /**
     * Fingertips on the buttons: moves each button with the finger pushing it and returns the presses that
     * landed this frame. Nothing presses until the card is standing.
     */
    press(hands: Record<Side, PressInput>): string[] {
      if (!face || wanted !== 1 || pop < 1) {
        for (const b of buttons.values()) b.depth = 0;
        return [];
      }
      face.updateWorldMatrix(true, false);
      const local = (v: Vector3 | null) => (v ? face!.worldToLocal(v.clone()) : null);
      const list: PressButton[] = [...buttons.values()].map((b) => ({ id: b.id, ...b.cell }));
      lastTips = { left: local(hands.left.tip), right: local(hands.right.tip) };
      const result = presser.step(list, {
        left: { tip: local(hands.left.tip), pinching: hands.left.pinching },
        right: { tip: local(hands.right.tip), pinching: hands.right.pinching },
      });
      for (const b of buttons.values()) {
        const target = result.depth.get(b.id) ?? 0;
        // The paper follows the finger in, and springs back a little slower.
        b.depth = target > b.depth ? target : b.depth + (target - b.depth) * 0.35;
      }
      near = result.near.right ?? result.near.left ?? null;
      for (const f of result.fired) {
        const b = buttons.get(f.id);
        if (b) b.landedMs = clockMs;
      }
      return result.fired.map((f) => f.id);
    },
    /** Lights a button's edge: a hand pointing at it from further away. */
    setNear,
    /** The button a fingertip (or a pointing hand) is on, if any. */
    get near(): string | null {
      return near;
    },
    /** Every enabled button's centre, on its face. Empty until the card is standing. */
    targets(): CardTarget[] {
      if (!face || wanted !== 1 || pop < 1 || !geometry) return [];
      return [...buttons.values()].map((b) => ({ id: b.id, position: b.face.getWorldPosition(new Vector3()), radiusM: Math.max(0.02, Math.min(b.cell.w, b.cell.h) / 2) }));
    },
    /** A button's centre in the world, for a sound or the emulator. */
    buttonAt(id: string): Vector3 | null {
      const b = buttons.get(id);
      return b ? b.face.getWorldPosition(new Vector3()) : null;
    },
    /** How the standing card reads from `head`, looking at `lookAt`. For checks and the review proof. */
    measure(head: Vector3, lookAt: Vector3): CardReport | null {
      if (!face || !geometry) return null;
      face.updateWorldMatrix(true, true);
      const textDeg = texts.map(({ what, text }) => {
        const a = text.localToWorld(new Vector3(0, 0, 0));
        const b = text.localToWorld(new Vector3(0, -text.fontSize, 0));
        const deg = (a.clone().sub(head).angleTo(b.clone().sub(head)) * 180) / Math.PI;
        return { what, deg };
      });
      const cells = [...buttons.values()].map((b) => b.cell);
      let minTargetGapM = Infinity;
      let minButtonGapM = Infinity;
      for (let i = 0; i < cells.length; i++)
        for (let j = i + 1; j < cells.length; j++) {
          const a = cells[i]!;
          const b = cells[j]!;
          minTargetGapM = Math.min(minTargetGapM, Math.hypot(a.x - b.x, a.y - b.y));
          minButtonGapM = Math.min(minButtonGapM, Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.y - b.y) - (a.h + b.h) / 2));
        }
      const minButtonM = { w: Math.min(...cells.map((c) => c.w)), h: Math.min(...cells.map((c) => c.h)) };
      const corners = [
        [-geometry.widthM / 2, 0],
        [geometry.widthM / 2, 0],
        [-geometry.widthM / 2, geometry.heightM],
        [geometry.widthM / 2, geometry.heightM],
      ].map(([x, y]) => face!.localToWorld(new Vector3(x, y, 0)).sub(head));
      const extent = (target: Vector3) => {
        const fwd = target.clone().sub(head).normalize();
        const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize();
        const up = new Vector3().crossVectors(right, fwd).normalize();
        const yaw = (v: Vector3) => (Math.atan2(v.dot(right), v.dot(fwd)) * 180) / Math.PI;
        const pitch = (v: Vector3) => (Math.atan2(v.dot(up), v.dot(fwd)) * 180) / Math.PI;
        return { left: Math.min(...corners.map(yaw)), right: Math.max(...corners.map(yaw)), up: Math.max(...corners.map(pitch)), down: Math.min(...corners.map(pitch)) };
      };
      const centre = face.localToWorld(new Vector3(0, geometry.heightM / 2, 0));
      return {
        textDeg,
        minTextDeg: Math.min(...textDeg.map((t) => t.deg)),
        minTargetGapM,
        minButtonGapM,
        minButtonM,
        extentDeg: extent(lookAt),
        extentFromCardDeg: extent(centre),
        sizeM: { w: geometry.widthM, h: geometry.heightM },
        distanceM: head.distanceTo(centre),
      };
    },
    dispose(): void {
      clear();
      deps.scene.remove(pivot);
      deps.scene.remove(shadow);
      for (const t of [faceTexture, shapeTexture, softTexture, ringTexture, blobTexture]) t.dispose();
      boardMaterial.dispose();
      edgeMaterial.dispose();
    },
  };
}
export type CardView = ReturnType<typeof createCardView>;
