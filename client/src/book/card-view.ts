import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, SRGBColorSpace, TextureLoader, Vector3, type Texture } from '@iwsdk/core';
import { Text } from 'troika-three-text';
import titleFont from '@fontsource/fraunces/files/fraunces-latin-500-normal.woff?url';
import captionFont from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-500-normal.woff?url';
import { arrangeCard, cardWidthFor, columnFor, emFor, type CardGeometry } from './card-layout.ts';

/**
 * The book's printed pages, as a paper card that pops up from the open spread: standing, turned to face
 * you, in the book's own paper and ink, with a gold rule under each thing you can pinch. The set stays
 * where it is underneath. Its type is sized from your eyes' distance (card-layout.ts), not the book's size.
 */

const NAVY = '#1F2A44';
const INK = '#2B2420';
const GOLD = '#D4A23E';
/** Drawn after the set and the room, and never hidden by a pop-up layer standing through it. */
const ORDER = 900;
/** How long the card takes to stand up, or fold away. */
const POP_MS = 420;
/** Where the card stands: on the spread's middle line, this share of the page's depth toward you. */
const STAND_AT_DEPTH_SHARE = 0.18;
/** Rebuilt for a new distance when you've moved this much nearer or further since it opened. */
const RELAYOUT_RATIO = 1.2;

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
  /** Each text block's em, in degrees, as seen from the head. */
  textDeg: Array<{ what: string; deg: number }>;
  minTextDeg: number;
  /** The smallest distance between two targets' centres, in metres (Infinity with fewer than two). */
  minTargetGapM: number;
  /** The card's corners, in degrees from where you look (head to `lookAt`): left and right are negative and positive. */
  extentDeg: { left: number; right: number; up: number; down: number };
  /** The same, looking at the card's own centre (the glasses' view is 37° each side, 25° up, 43° down). */
  extentFromCardDeg: { left: number; right: number; up: number; down: number };
  sizeM: { w: number; h: number };
  distanceM: number;
}

/** A 3×3 sliced quad: the paper's deckled border keeps its size at any card size. */
function slicedPaper(w: number, h: number, borderM: number, uBorder: number, vBorder: number): BufferGeometry {
  const xs = [-w / 2, -w / 2 + borderM, w / 2 - borderM, w / 2];
  const ys = [0, borderM, h - borderM, h];
  const us = [0, uBorder, 1 - uBorder, 1];
  const vs = [0, vBorder, 1 - vBorder, 1];
  const pos: number[] = [];
  const uv: number[] = [];
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 4; i++) {
      pos.push(xs[i]!, ys[j]!, 0);
      uv.push(us[i]!, vs[j]!);
    }
  const index: number[] = [];
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      const a = j * 4 + i;
      index.push(a, a + 1, a + 5, a, a + 5, a + 4);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

function overlay(color: string, opacity = 1): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false, side: DoubleSide });
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
  t.renderOrder = ORDER + 3;
  return t;
}

const synced = (t: Text) => new Promise<void>((resolve) => t.sync(resolve));
/** A rendered block's height, from troika's measured bounds. */
const heightOf = (t: Text): number => {
  const info = (t as unknown as { textRenderInfo?: { blockBounds: [number, number, number, number] } }).textRenderInfo;
  return info ? info.blockBounds[3] - info.blockBounds[1] : t.fontSize * 1.2;
};

export interface CardViewDeps {
  /** The book's root and its geometry, to stand the card on the spread. */
  bookRoot: Object3D;
  pageY: number;
  pageD: number;
  scene: Object3D;
  /** Where it stands, in the book's own frame (default: on the spread's middle line, a little toward you). */
  stand?: { x: number; y: number; z: number };
  /** A narrower card, in ems (a hint, not a menu). */
  widthEm?: number;
}

export function createCardView(deps: CardViewDeps) {
  const paperTexture: Texture = new TextureLoader().load('./art/book/paper-tag.png');
  paperTexture.colorSpace = SRGBColorSpace;
  const paperMaterial = new MeshBasicMaterial({ map: paperTexture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: DoubleSide });

  /** Faces you; the hinge under it stands the card up from its bottom edge. */
  const pivot = new Group();
  pivot.name = 'book-card';
  pivot.visible = false;
  deps.scene.add(pivot);
  const hinge = new Group();
  pivot.add(hinge);
  let face: Group | null = null;

  let spec: CardSpec | null = null;
  let geometry: CardGeometry | null = null;
  let builtFor = 0;
  /** 0 folded away, 1 standing. */
  let pop = 0;
  let wanted = 0;
  let near: string | null = null;
  let building = 0;
  const rules = new Map<string, Mesh>();
  const anchors = new Map<string, Object3D>();
  const texts: Array<{ what: string; text: Text }> = [];
  const base = new Vector3();

  function clear(): void {
    if (face) {
      hinge.remove(face);
      for (const { text } of texts) text.dispose();
      face.traverse((o) => {
        if (o instanceof Mesh && !(o instanceof Text)) o.geometry.dispose();
      });
    }
    face = null;
    texts.length = 0;
    rules.clear();
    anchors.clear();
  }

  /** Builds the card for this distance: type first (so it can be measured), then the paper round it. */
  async function build(next: CardSpec, distanceM: number): Promise<void> {
    const ticket = ++building;
    const em = emFor(distanceM);
    const width = deps.widthEm ? deps.widthEm * em : cardWidthFor(em);
    const textWidth = width - 2 * em;
    const column = columnFor(em) - 0.6 * em;
    const made: Array<{ what: string; text: Text }> = [];
    if (next.over) made.push({ what: 'over', text: makeText(next.over, captionFont, em, INK, textWidth, 'center') });
    if (next.title) made.push({ what: 'title', text: makeText(next.title, titleFont, em * 1.2, NAVY, textWidth, 'center') });
    if (next.lines?.length) made.push({ what: 'lines', text: makeText(next.lines.join('\n'), captionFont, em, INK, textWidth, 'center') });
    if (next.note) made.push({ what: 'note', text: makeText(next.note, captionFont, em, INK, textWidth, 'center') });
    const choiceTexts = next.choices.map((c) => makeText(c.label, captionFont, em, INK, column, 'center'));
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
    const paper = new Mesh(slicedPaper(g.widthM, g.heightM, Math.min(0.02, g.heightM / 6), 24 / 720, 24 / 200), paperMaterial);
    paper.renderOrder = ORDER;
    group.add(paper);
    for (const m of made) {
      const top = g.top[m.what as keyof CardGeometry['top']]!;
      m.text.position.set(0, top, 0.0006);
      if (m.what === 'over') m.text.fillOpacity = 0.72;
      group.add(m.text);
      texts.push(m);
    }
    next.choices.forEach((c, i) => {
      const cell = g.cells[i]!;
      const t = choiceTexts[i]!;
      const h = heightOf(t);
      t.position.set(cell.x, cell.y + h / 2 + 0.12 * g.em, 0.0006);
      const enabled = c.enabled !== false;
      t.fillOpacity = enabled ? 1 : 0.4;
      group.add(t);
      texts.push({ what: `choice:${c.id}`, text: t });
      const anchor = new Object3D();
      anchor.position.set(cell.x, cell.y, 0);
      group.add(anchor);
      if (enabled) {
        anchors.set(c.id, anchor);
        const rule = new Mesh(new PlaneGeometry(Math.min(cell.w * 0.62, 6 * g.em), Math.max(0.0016, 0.13 * g.em)), overlay(GOLD, 0.75));
        rule.position.set(cell.x, cell.y - h / 2 - 0.05 * g.em, 0.0005);
        rule.renderOrder = ORDER + 2;
        group.add(rule);
        rules.set(c.id, rule);
      }
    });
    face = group;
    hinge.add(group);
    geometry = g;
    builtFor = distanceM;
    setNear(near);
  }

  function setNear(id: string | null): void {
    near = id;
    for (const [rid, rule] of rules) {
      rule.scale.y = rid === id ? 1.8 : 1;
      (rule.material as MeshBasicMaterial).opacity = rid === id ? 1 : 0.75;
    }
  }

  function standAt(out: Vector3): Vector3 {
    if (deps.stand) out.set(deps.stand.x, deps.stand.y, deps.stand.z);
    else out.set(0, deps.pageY, (deps.pageD / 2) * STAND_AT_DEPTH_SHARE * 2);
    return deps.bookRoot.localToWorld(out);
  }

  return {
    /** Opens (or replaces) the card with new contents, sized for this distance from your eyes. */
    async open(next: CardSpec, head: Vector3): Promise<void> {
      spec = next;
      wanted = 1;
      pivot.visible = true;
      await build(next, head.distanceTo(standAt(base)));
    },
    /** Folds the card away. */
    close(): void {
      wanted = 0;
      building++;
    },
    get shown(): boolean {
      return pop > 0 || wanted > 0;
    },
    /** Standing and ready to be pinched. */
    get ready(): boolean {
      return wanted === 1 && pop >= 1 && face !== null;
    },
    get spec(): CardSpec | null {
      return spec;
    },
    /** For review checks: how far it has stood up, and how many times it has been built and folded. */
    get debug(): { pop: number; wanted: number; builds: number; built: boolean } {
      return { pop: +pop.toFixed(2), wanted, builds: building, built: face !== null };
    },
    frame(deltaMs: number, head: Vector3): void {
      const step = deltaMs / POP_MS;
      if (wanted > pop) pop = Math.min(1, pop + step);
      else if (wanted < pop) pop = Math.max(0, pop - step);
      if (pop <= 0 && wanted === 0) {
        if (pivot.visible) {
          pivot.visible = false;
          clear();
          spec = null;
          geometry = null;
        }
        return;
      }
      standAt(base);
      pivot.position.copy(base);
      pivot.lookAt(head);
      // A pop-up's fold: from lying back to standing, with a slight overshoot as it lands.
      const t = pop;
      const eased = wanted ? 1 - (1 - t) ** 3 + Math.sin(Math.PI * t) * 0.06 : t * t;
      hinge.rotation.x = -(1 - eased) * (Math.PI / 2);
      hinge.scale.setScalar(0.6 + 0.4 * Math.min(1, t * 1.4));
      // Much nearer or further than when it was set: type re-sized for the new distance.
      const d = head.distanceTo(base);
      if (spec && wanted && face && builtFor > 0 && (d / builtFor > RELAYOUT_RATIO || builtFor / d > RELAYOUT_RATIO)) {
        builtFor = d;
        void build(spec, d);
      }
    },
    /** Every enabled choice's centre, for hands and gaze. Empty until the card is standing. */
    targets(): CardTarget[] {
      if (!face || wanted !== 1 || pop < 1 || !geometry) return [];
      const radiusM = Math.max(0.032, Math.min(geometry.columnM, ...geometry.cells.map((c) => c.h)) / 2);
      return [...anchors].map(([id, a]) => ({ id, position: a.getWorldPosition(new Vector3()), radiusM }));
    },
    setNear,
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
      const points = [...anchors.values()].map((o) => o.getWorldPosition(new Vector3()));
      let minTargetGapM = Infinity;
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) minTargetGapM = Math.min(minTargetGapM, points[i]!.distanceTo(points[j]!));
      // Angles of the card's corners from the line of sight, in a frame with y up.
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
        extentDeg: extent(lookAt),
        extentFromCardDeg: extent(centre),
        sizeM: { w: geometry.widthM, h: geometry.heightM },
        distanceM: head.distanceTo(base),
      };
    },
    dispose(): void {
      clear();
      deps.scene.remove(pivot);
      paperMaterial.dispose();
      paperTexture.dispose();
    },
  };
}
export type CardView = ReturnType<typeof createCardView>;
