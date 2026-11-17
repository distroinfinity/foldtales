import { Group, Mesh, Object3D, PlaneGeometry, Sprite, SpriteMaterial } from '@iwsdk/core';
import { artJoin, buildBook, CAPTION_WIDTH_SHARE, OVER_STACK, type BookView } from '../book/book-view.ts';
import { buildDrawer, type DrawerView } from '../book/drawer-view.ts';
import { buildSatchel, type SatchelView } from '../book/satchel-view.ts';
import { captionText, endPageText, titleText, type CaptionView, type EndPageView } from '../book/text.ts';
import { createObjects, type ObjectState, type ObjectsView } from '../objects/objects.ts';
import { cardMaterial } from '../paint/card-material.ts';
import type { StageAssets } from '../paint/assets.ts';
import type { SoftPieces } from '../paint/soft.ts';
import { buildPuppet, type PuppetView } from '../puppet/puppet.ts';
import { buildLeaves, type LeavesView } from '../show/leaves.ts';
import type { ShowManifest } from '../show/manifest.ts';
import type { ObjectDef, Spine } from '@tabletop/contracts';

export interface Stage {
  /** Placed on your table by its spine. Scaled as a whole from tray to desk. */
  root: Object3D;
  book: BookView;
  puppets: Map<string, PuppetView>;
  /** Each character's mount on the page, moved by the show. */
  actors: Map<string, Object3D>;
  heads: Map<string, string[]>;
  leaves: LeavesView;
  caption: CaptionView;
  endPage: EndPageView;
  objects: ObjectsView;
  drawer: DrawerView;
  satchel: SatchelView;
  spark: Sprite;
  spans: Map<string, Mesh>;
}

const dirOf = (path: string): string => path.slice(0, path.lastIndexOf('/'));

/** Where the review scene stands the cast that isn't in the opening. Stage metres. */
const REVIEW_SPOTS: Array<[number, number, number]> = [[-0.105, 0, -0.0175], [-0.02, 0.1, 0.0]];

/** `review` (dev only) puts every cast member on the open book, for the acting review and the frame budget. */
export function buildStage(manifest: ShowManifest, assets: StageAssets, soft: SoftPieces, review = false): Stage {
  const root = new Object3D();
  root.name = 'stage';
  const book = buildBook({
    book: assets.book,
    sets: assets.sets,
    textures: assets.textures,
    bookBase: dirOf(manifest.book),
    soft: { shadow: soft.shadow, hinge: soft.hinge, gutter: soft.gutter },
    castOnStage: [],
  });
  root.add(book.root);

  const title = titleText(manifest.title, assets.book.closedSizeM[0]);
  book.titleAnchor.add(title);
  const caption = captionText(assets.book.openSizeM[0] * CAPTION_WIDTH_SHARE, Math.min(...assets.sets.map((s) => s.spec.ground.captionBandM)));
  book.captionAnchor.add(caption.mesh);
  const endPage = endPageText(assets.book.openSizeM[0] * CAPTION_WIDTH_SHARE);
  book.captionAnchor.add(endPage.root);

  // Every character is built up front, each on its own mount; the show decides who is on the spread.
  const puppets = new Map<string, PuppetView>();
  const actors = new Map<string, Object3D>();
  const heads = new Map<string, string[]>();
  const fx = { shadow: soft.shadow, glow: soft.glow, chin: soft.chin, smoke: assets.textures.get('fx/smoke.png') ?? null };
  manifest.cast.forEach((entry, i) => {
    const rig = assets.rigs.get(entry.member.id)!;
    const textures = new Map([...assets.textures].filter(([file]) => file.startsWith(`${entry.member.rig}/`)).map(([file, t]) => [file.slice(entry.member.rig.length + 1), t]));
    const puppet = buildPuppet(entry, rig, textures, fx);
    const actor = new Object3D();
    actor.name = `actor:${entry.member.id}`;
    actor.visible = false;
    actor.add(puppet.root);
    book.actorLayer.add(actor);
    if (review && i > 0) {
      const [x, y, z] = REVIEW_SPOTS[i - 1] ?? [0, 0, 0];
      actor.position.set(x, book.pageY + y, z);
    }
    puppets.set(entry.member.id, puppet);
    actors.set(entry.member.id, actor);
    heads.set(entry.member.id, Object.keys(rig.head?.offsets ?? {}));
  });

  // The drawer slides out from under the page block, carrying the pull; the satchel waits beside the book.
  const drawerFront = new Group();
  drawerFront.name = 'drawer-layer';
  drawerFront.renderOrder = OVER_STACK - 2;
  book.root.add(drawerFront);
  const pullSpec = assets.book.parts['drawer-pull'];
  const pullRef = assets.textures.get(`${dirOf(manifest.book)}/${pullSpec.file}`)!;
  const pullH = 0.0105;
  const drawer = buildDrawer(assets.drawer, (file) => assets.textures.get(file)!, dirOf(manifest.drawer), { ref: pullRef, sizeM: [pullH * (pullSpec.sizeM[0] / pullSpec.sizeM[1]) * 1.4, pullH] }, soft.shadow);
  drawerFront.add(drawer.root);
  const satchelLayer = new Group();
  satchelLayer.name = 'satchel-layer';
  satchelLayer.renderOrder = OVER_STACK - 3;
  book.root.add(satchelLayer);
  const satchel = buildSatchel(assets.satchel, (file) => assets.textures.get(file)!, dirOf(manifest.satchel), soft.shadow);
  satchelLayer.add(satchel.root);

  const defs = new Map(assets.objects.map((o) => [o.id, o]));
  const initial = startingObjects(manifest, assets.spine, assets.objects);
  const litArt = new Map<string, import('../paint/texref.ts').TexRef>();
  const glowAt = new Map<string, [number, number]>();
  for (const entry of manifest.cast) {
    const light = entry.light;
    if (!light?.object) continue;
    const rig = assets.rigs.get(entry.member.id)!;
    const part = rig.parts[light.part];
    const ref = assets.textures.get(`${entry.member.rig}/${part!.file}`);
    if (ref) litArt.set(light.object, ref);
    if (part && ref) glowAt.set(light.object, [(light.glowAt[0] - part.x) / ref.sizePx[0], (light.glowAt[1] - part.y) / ref.sizePx[1]]);
  }
  const loose = new Group();
  loose.name = 'loose-objects';
  loose.renderOrder = OVER_STACK - 1;
  book.root.add(loose);
  const objects = createObjects(initial, {
    loose,
    defs,
    textures: assets.textures,
    litArt,
    glowAt,
    bookRoot: book.root,
    behind: book.actorLayer,
    front: book.frontLayer,
    frontZ: book.frontHingeZ,
    pageY: book.pageY,
    glow: soft.glow,
    shadow: soft.shadow,
    drawerAnchor: (id) => drawer.anchor(id),
    satchelPocket: satchel.pocket,
    page: { halfW: assets.book.openSizeM[0] / 2, halfD: assets.book.openSizeM[1] / 2 },
  });
  for (const s of initial) if (s.home.kind === 'posed') objects.setVisible(s.id, false);

  // The spark that carries the flame up to the lamp.
  const spark = new Sprite(new SpriteMaterial({ map: soft.ember, depthWrite: false, transparent: true, toneMapped: false }));
  spark.name = 'spark';
  spark.renderOrder = 210;
  spark.visible = false;
  root.add(spark);

  // Lines strung across the gap, as the art painted them: a standing card, stretched rim to rim.
  const spans = new Map<string, Mesh>();
  for (const each of assets.sets) {
    for (const [name, effect] of Object.entries(each.spec.effects)) {
      const e = effect as { file: string; thicknessM?: number };
      if (!e.thicknessM) continue;
      const ref = assets.textures.get(artJoin(each.base, e.file));
      if (!ref) continue;
      const mesh = new Mesh(new PlaneGeometry(1, e.thicknessM), cardMaterial(ref.texture, { baked: ref.baked, doubleSided: true }));
      mesh.name = name;
      mesh.renderOrder = 500;
      mesh.visible = false;
      book.actorLayer.add(mesh);
      spans.set(name, mesh);
    }
  }

  const leafTextures = ['fx/leaf-1.png', 'fx/leaf-2.png'].map((f) => assets.textures.get(f)).filter((t) => !!t);
  const leaves = buildLeaves(leafTextures);
  book.root.add(leaves.root);
  return { root, book, puppets, actors, heads, leaves, caption, endPage, objects, drawer, satchel, spark, spans };
}

/**
 * Where every object starts: the episode's copies where their scenes put them, every keeper's light
 * in its paw (in every chapter, listed or not), and anything else posed out of sight.
 */
export function startingObjects(manifest: Pick<ShowManifest, 'cast'>, spine: Spine, objects: readonly ObjectDef[]): ObjectState[] {
  const defs = new Map(objects.map((o) => [o.id, o]));
  const initial: ObjectState[] = [];
  const carriers = new Map(manifest.cast.flatMap((c) => (c.light?.object ? [[c.light.object, c.member.id] as const] : [])));
  for (const scene of spine.scenes) {
    for (const o of scene.objects) {
      if (initial.some((s) => s.id === o.id)) continue;
      const carrier = carriers.get(o.id);
      // A carried light starts in its keeper's paw; the drawer's presets in the drawer; a thing on a set waits off the page until a beat places it.
      const home = carrier ? { kind: 'carried' as const, cast: carrier } : o.origin === 'drawer' ? { kind: 'drawer' as const } : { kind: 'away' as const };
      initial.push({ id: o.id, home, given: false, grabbable: true });
    }
  }
  for (const [object, cast] of carriers) if (defs.has(object) && !initial.some((s) => s.id === object)) initial.push({ id: object, home: { kind: 'carried', cast }, given: false, grabbable: true });
  // Props a crossing uses that the reader never hands over, like a rope already in a paw.
  for (const def of objects) if (!initial.some((s) => s.id === def.id)) initial.push({ id: def.id, home: { kind: 'posed' }, given: false, grabbable: false });
  return initial;
}
