import { TextureLoader, type Texture, type WebGLRenderer } from '@iwsdk/core';
import { ObjectDef, Rig, Spine } from '@tabletop/contracts';
import { DrawerSpec } from '../book/drawer-view.ts';
import { SatchelSpec } from '../book/satchel-view.ts';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { artJoin, bookFiles } from '../book/book-view.ts';
import { BookSpec, SetSpec } from '../book/spec.ts';
import { puppetFiles } from '../puppet/puppet.ts';
import { RoomSpec } from '../room/room.ts';
import type { ShowManifest } from '../show/manifest.ts';
import { wholeRef, type TexRef } from './texref.ts';
import { FOG_ART } from '../room-fx/fog.ts';
import { SKY_ART } from '../room-fx/sky.ts';
import { SNOW_ART } from '../room-fx/snow.ts';
import { RAIN_ART } from '../room-fx/weather.ts';
import { WINDOW_ART } from '../room-fx/window.ts';

/** Paintings the room effects use, loaded with the rest of the art. */
const ROOM_FX_ART = [WINDOW_ART, RAIN_ART, ...Object.values(SKY_ART), ...Object.values(SNOW_ART), ...FOG_ART];

export interface StageAssets {
  book: BookSpec;
  /** The first set: the opening's, whose moods the show uses. */
  set: SetSpec;
  /** Every set, in the manifest's order, with the folder its files are in. */
  sets: Array<{ id: string; spec: SetSpec; base: string }>;
  objects: ObjectDef[];
  drawer: DrawerSpec;
  satchel: SatchelSpec;
  spine: Spine;
  rigs: Map<string, Rig>;
  /** Keyed by art path, such as `cast/<who>/parts/<part>.png`. */
  textures: Map<string, TexRef>;
  /** How the art arrived: compressed for the headset, or PNG. */
  format: 'ktx2' | 'png';
  /** The painted reading room, for no-passthrough mode. */
  room: { spec: RoomSpec; base: string } | null;
}

interface ArtIndex {
  v: 1;
  files: Record<string, { ktx2: string; size: [number, number]; texSize: [number, number]; premultiplied: boolean }>;
  atlases: Record<string, { ktx2: string; size: [number, number]; rects: Record<string, { x: number; y: number; w: number; h: number }> }>;
}

const dirOf = (path: string): string => path.slice(0, path.lastIndexOf('/'));

async function json(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

/** The compressed art's index, or null to use PNG (dev before the cache is built, or a failed fetch). */
async function artIndex(artBase: string): Promise<ArtIndex | null> {
  try {
    const index = (await json(`${artBase}/ktx2.json`)) as ArtIndex;
    return index.v === 1 ? index : null;
  } catch {
    return null;
  }
}

/**
 * Everything the opening shows, fetched and decoded before the book appears. Compressed KTX2 when
 * the build made it (a quarter of the memory, mips baked in), each character as one atlas; PNG
 * otherwise, and PNG for any one file that fails. Rejects only if a piece can't load either way.
 */
export async function loadStageAssets(
  manifest: ShowManifest,
  artBase: string,
  renderer: WebGLRenderer,
  options: { allowKtx2: boolean; onProgress?: (done: number, total: number) => void },
): Promise<StageAssets> {
  const [bookRaw, drawerRaw, satchelRaw, spineRaw, setRaws, objectRaws, rigRaws] = await Promise.all([
    json(`${artBase}/${manifest.book}`),
    json(`${artBase}/${manifest.drawer}`),
    json(`${artBase}/${manifest.satchel}`),
    json(`./${manifest.episode}`),
    Promise.all(manifest.sets.map((set) => json(`${artBase}/${set.file}`))),
    Promise.all(manifest.objectFiles.map((file) => json(`${artBase}/${file}`))),
    Promise.all(manifest.cast.map((entry) => json(`${artBase}/${entry.member.rig}/rig.json`))),
  ]);
  // The painted room is optional: if its art can't load, the book still opens on your table.
  let roomSpec: RoomSpec | null = null;
  if (manifest.room) {
    try {
      roomSpec = RoomSpec.parse(await json(`${artBase}/${manifest.room}`));
    } catch {
      roomSpec = null;
    }
  }
  const book = BookSpec.parse(bookRaw);
  const drawer = DrawerSpec.parse(drawerRaw);
  const satchel = SatchelSpec.parse(satchelRaw);
  const spine = Spine.parse(spineRaw);
  const sets = manifest.sets.map((entry, i) => ({ id: entry.id, spec: SetSpec.parse(setRaws[i]), base: dirOf(entry.file) }));
  const set = sets[0]!.spec;
  const objects = [...objectRaws.map((raw) => ObjectDef.parse(raw)), ...manifest.extraObjects];
  const rigs = new Map(manifest.cast.map((entry, i) => [entry.member.id, Rig.parse(rigRaws[i])]));
  const files = new Set<string>();
  for (const each of sets) {
    for (const file of bookFiles(book, dirOf(manifest.book), each.spec, each.base)) files.add(file);
    for (const effect of Object.values(each.spec.effects)) files.add(artJoin(each.base, effect.file));
  }
  for (const entry of manifest.cast) for (const file of puppetFiles(entry, rigs.get(entry.member.id)!)) files.add(`${entry.member.rig}/${file}`);
  for (const object of objects) if (object.art.kind === 'asset') files.add(object.art.path);
  // Room effects' own paintings.
  for (const file of ROOM_FX_ART) files.add(file);
  const drawerBase = dirOf(manifest.drawer);
  for (const part of [drawer.tray, drawer.front, drawer.side]) files.add(`${drawerBase}/${part.file}`);
  const satchelBase = dirOf(manifest.satchel);
  for (const part of Object.values(satchel.parts)) files.add(`${satchelBase}/${part.file}`);
  const roomFiles = roomSpec && manifest.room ? [...roomSpec.flats.map((f) => f.file), roomSpec.tabletop.file].map((file) => `${dirOf(manifest.room!)}/${file}`) : [];

  const index = options.allowKtx2 ? await artIndex(artBase) : null;
  let ktx2: KTX2Loader | null = null;
  if (index) {
    ktx2 = new KTX2Loader().setTranscoderPath('./basis/');
    ktx2.detectSupport(renderer);
  }
  const png = new TextureLoader();
  const atlases = new Map<string, Promise<Texture>>();
  const loadKtx2 = (rel: string): Promise<Texture> => ktx2!.loadAsync(`${artBase}/${rel}`);

  async function load(file: string): Promise<TexRef> {
    if (index && ktx2) {
      try {
        const folder = Object.keys(index.atlases).find((f) => file.startsWith(`${f}/`));
        if (folder) {
          const atlas = index.atlases[folder]!;
          const rect = atlas.rects[file.slice(folder.length + 1)];
          if (rect) {
            if (!atlases.has(folder)) atlases.set(folder, loadKtx2(atlas.ktx2));
            const texture = await atlases.get(folder)!;
            const [W, H] = atlas.size;
            // Encoded Y-flipped, so rectangles measured from the top map with v up.
            return { texture, sizePx: [rect.w, rect.h], uv: [rect.x / W, 1 - (rect.y + rect.h) / H, (rect.x + rect.w) / W, 1 - rect.y / H], baked: true };
          }
        }
        const entry = index.files[file];
        if (entry) {
          const texture = await loadKtx2(entry.ktx2);
          const [w, h] = entry.size;
          const [W, H] = entry.texSize;
          return { texture, sizePx: [w, h], uv: [0, 0, w / W, h / H], baked: entry.premultiplied };
        }
      } catch {
        // Falls through to the PNG.
      }
    }
    return wholeRef(await png.loadAsync(`${artBase}/${file}`));
  }

  let done = 0;
  const list = [...files];
  const textures = new Map(
    await Promise.all(
      list.map(async (file) => {
        const ref = await load(file);
        ref.texture.name = file;
        options.onProgress?.(++done, list.length);
        return [file, ref] as const;
      }),
    ),
  );
  const roomRefs = await Promise.allSettled(roomFiles.map(async (file) => [file, await load(file)] as const));
  const roomLoaded = roomRefs.every((r) => r.status === 'fulfilled');
  if (roomLoaded) for (const r of roomRefs) if (r.status === 'fulfilled') textures.set(r.value[0], r.value[1]);
  return { book, set, sets, objects, drawer, satchel, spine, rigs, textures, format: index ? 'ktx2' : 'png', room: roomSpec && roomLoaded && manifest.room ? { spec: roomSpec, base: dirOf(manifest.room) } : null };
}

/** Uploads every texture now, so the first frame that shows one doesn't stall to decode it. */
export function uploadAll(renderer: WebGLRenderer, textures: Iterable<Texture>): void {
  for (const texture of new Set(textures)) renderer.initTexture(texture);
}
