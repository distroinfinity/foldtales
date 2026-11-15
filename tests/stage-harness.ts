import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Group, Object3D, Sprite, Texture, Vector3 } from '@iwsdk/core';
import { ObjectDef, Rig, Spine } from '../contracts/src/index.ts';
import { BookSpec, SetSpec } from '../client/src/book/spec.ts';
import { artJoin, bookFiles, buildBook, OVER_STACK } from '../client/src/book/book-view.ts';
import { buildDrawer, DrawerSpec } from '../client/src/book/drawer-view.ts';
import { buildSatchel, SatchelSpec } from '../client/src/book/satchel-view.ts';
import { buildDim } from '../client/src/light/dim.ts';
import { createObjects, type ObjectState } from '../client/src/objects/objects.ts';
import { wholeRef, type TexRef } from '../client/src/paint/texref.ts';
import { buildPuppet, puppetFiles, type PuppetView } from '../client/src/puppet/puppet.ts';
import { createShowClock } from '../client/src/show/clock.ts';
import { buildLeaves } from '../client/src/show/leaves.ts';
import { ShowManifest } from '../client/src/show/manifest.ts';
import { createShowRuntime } from '../client/src/show/runtime.ts';
import type { SoundEngine } from '../client/src/sound/engine.ts';
import { controlFold } from '../client/src/stage/book-control.ts';

export const artRoot = fileURLToPath(new URL('../art', import.meta.url));
const json = (path: string) => JSON.parse(readFileSync(join(artRoot, path), 'utf8'));
export const manifest = ShowManifest.parse(JSON.parse(readFileSync(new URL('../client/public/show/manifest.json', import.meta.url), 'utf8')));
export const spine = Spine.parse(JSON.parse(readFileSync(new URL(`../client/public/${manifest.episode}`, import.meta.url), 'utf8')));
export const book = BookSpec.parse(json(manifest.book));
export const sets = manifest.sets.map((s) => ({ id: s.id, spec: SetSpec.parse(json(s.file)), base: s.file.slice(0, s.file.lastIndexOf('/')) }));
export const rigs = new Map(manifest.cast.map((e) => [e.member.id, Rig.parse(json(`${e.member.rig}/rig.json`))]));
export const defs = new Map([...manifest.objectFiles.map((f) => ObjectDef.parse(json(f))), ...manifest.extraObjects].map((d) => [d.id, d]));

function pngSize(path: string): [number, number] {
  const header = readFileSync(join(artRoot, path)).subarray(0, 24);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}
export const ref = (path: string): TexRef => {
  const texture = new Texture();
  const [width, height] = pngSize(path);
  texture.image = { width, height };
  return wholeRef(texture);
};

export const head = new Vector3(0, 0.45, 0.55);

/** One complete stage, the way the client builds it, minus the browser-only text and audio. */
export function stage() {
  const files = new Set<string>();
  for (const s of sets) {
    for (const f of bookFiles(book, 'book', s.spec, s.base)) files.add(f);
    for (const e of Object.values(s.spec.effects)) files.add(artJoin(s.base, e.file));
  }
  const textures = new Map([...files].map((f) => [f, ref(f)]));
  const soft = { shadow: new Texture(), hinge: new Texture(), gutter: new Texture() };
  const view = buildBook({ book, sets, textures, bookBase: 'book', soft, castOnStage: [] });
  const puppets = new Map<string, PuppetView>();
  const actors = new Map<string, Object3D>();
  const heads = new Map<string, string[]>();
  for (const entry of manifest.cast) {
    const rig = rigs.get(entry.member.id)!;
    const castTextures = new Map(puppetFiles(entry, rig).map((f) => [f, ref(`${entry.member.rig}/${f}`)]));
    const puppet = buildPuppet(entry, rig, castTextures, { shadow: new Texture(), glow: new Texture(), chin: new Texture(), smoke: ref('fx/smoke.png') });
    const actor = new Object3D();
    actor.add(puppet.root);
    view.actorLayer.add(actor);
    puppets.set(entry.member.id, puppet);
    actors.set(entry.member.id, actor);
    heads.set(entry.member.id, Object.keys(rig.head?.offsets ?? {}));
  }
  const drawerSpec = DrawerSpec.parse(json(manifest.drawer));
  const tex = (f: string) => ref(f);
  const drawer = buildDrawer(drawerSpec, tex, 'book/drawer', { ref: ref('book/drawer-pull.png'), sizeM: [0.02, 0.01] }, new Texture());
  const drawerLayer = new Group();
  drawerLayer.renderOrder = OVER_STACK - 2;
  drawerLayer.add(drawer.root);
  view.root.add(drawerLayer);
  const satchel = buildSatchel(SatchelSpec.parse(json(manifest.satchel)), tex, 'satchel', new Texture());
  view.root.add(satchel.root);
  const loose = new Group();
  loose.renderOrder = OVER_STACK - 1;
  view.root.add(loose);
  const initial: ObjectState[] = [];
  for (const scene of spine.scenes) for (const o of scene.objects) if (!initial.some((s) => s.id === o.id)) initial.push({ id: o.id, home: o.origin === 'set' ? { kind: 'carried', cast: 'pip' } : { kind: 'drawer' }, given: false, grabbable: true });
  for (const d of defs.values()) if (!initial.some((s) => s.id === d.id)) initial.push({ id: d.id, home: { kind: 'posed' }, given: false, grabbable: false });
  const objectTextures = new Map([...defs.values()].flatMap((d) => (d.art.kind === 'asset' ? [[d.art.path, ref(d.art.path)] as const] : [])));
  const objects = createObjects(initial, {
    defs,
    textures: objectTextures,
    litArt: new Map([['lantern', ref('cast/pip/parts/lantern.png')]]),
    glowAt: new Map([['lantern', [0.4, 0.5]]]),
    bookRoot: view.root,
    behind: view.actorLayer,
    front: view.frontLayer,
    loose,
    frontZ: view.frontHingeZ,
    pageY: view.pageY,
    glow: new Texture(),
    shadow: new Texture(),
    drawerAnchor: (id) => drawer.anchor(id),
    satchelPocket: satchel.pocket,
    page: { halfW: 0.21, halfD: 0.1575 },
  });
  const root = new Object3D();
  root.add(view.root);
  root.updateMatrixWorld(true);
  const played: string[] = [];
  const spoken: string[] = [];
  const sound = {
    play: (name: string) => played.push(name),
    speak: (who: string, text: string) => {
      spoken.push(`${who}: ${text}`);
      return null;
    },
    roomTone: () => undefined,
  } as unknown as SoundEngine;
  const captions: Array<string | null> = [];
  const clock = createShowClock();
  let ended = false;
  const runtime = createShowRuntime({
    manifest,
    spine,
    defs,
    moods: sets[0]!.spec.moods,
    views: {
      stageRoot: root,
      book: view,
      puppets,
      actors,
      heads,
      dim: buildDim(),
      leaves: buildLeaves([ref('fx/leaf-1.png'), ref('fx/leaf-2.png')]),
      caption: { mesh: new Object3D() as never, baseSizeM: 0.012, setSize: () => undefined, show: (line) => captions.push(line) },
      endPage: { show: (on) => void (ended = on), readAgain: new Object3D() },
      sound,
      objects,
      drawer,
      satchel,
      spark: new Sprite(),
      spans: new Map(),
      room: null,
    },
    clock,
  });
  const initialObjects = objects.snapshot();
  // Wall time far from show time, as in the headset, so a mixed-up clock shows.
  let wall = 5_000_000;
  const handPoints = { left: null as Vector3 | null, right: null as Vector3 | null };
  /** One frame of `ms`, with your hands holding the book this open. */
  const frame = (ms: number, open = 1) => {
    wall += ms;
    root.updateMatrixWorld(true);
    return runtime.frame(ms, wall, head, { fold: controlFold(open, view.cards.length), ribbon: 0 }, handPoints);
  };
  return { root, view, puppets, actors, objects, drawer, satchel, runtime, clock, played, spoken, captions, frame, handPoints, initialObjects, ended: () => ended };
}

export type Harness = ReturnType<typeof stage>;

/** Plays the show to a moment, frame by frame. */
export function playTo(s: Harness, ms: number): Harness {
  if (!s.runtime.started) s.runtime.start();
  while (s.clock.ms < ms) s.frame(Math.min(16, ms - s.clock.ms));
  return s;
}

/** Plays until a beat starts. */
export function playUntil(s: Harness, beatId: string, limitMs = 600_000): Harness {
  if (!s.runtime.started) s.runtime.start();
  while (s.runtime.scheduler.current().beatId !== beatId && s.clock.ms < limitMs) s.frame(16);
  return s;
}
