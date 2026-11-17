/**
 * Turning to another chapter inside the running XR session (owner, Nov 17: "When we load the next chapter,
 * do everything inside the XR session itself"). The book closes, a title page for the next chapter stands
 * over it while that chapter is prepared out of sight, then the old chapter is let go and the new one opens
 * where the book lay. Only a failure to prepare it falls back to the page.
 */
import { Spine } from '@tabletop/contracts';
import { Group, Vector3, type Material, type Object3D, type Texture, type World } from '@iwsdk/core';
import { createCardView, type CardSpec } from '../book/card-view.ts';
import { CHAPTERS, type EnterTarget } from '../show/progress.ts';
import { ShowManifest } from '../show/manifest.ts';
import { chaptersOf } from '../show/chapters.ts';
import { loadStageAssets } from '../paint/assets.ts';
import type { TexRef } from '../paint/texref.ts';

export type ChapterTarget = Extract<EnterTarget, { kind: 'chapter' }>;

/** Where the book lay, and how, so the next chapter opens in the same place at the same size. */
export interface BookHandoff {
  position: Vector3;
  rotationY: number;
  scale: number;
  /** A size chosen by hand, kept. */
  userScale: number | null;
  /** The scanned table under the book, for settling things you let go of. */
  table: Array<{ x: number; z: number }> | null;
  satchelSide: 1 | -1 | null;
  /** In the painted room: where it stood, so the new chapter's room stands there too. */
  room: { head: Vector3; forward: Vector3; table: Vector3 } | null;
  /** The wash under the book had a confirmed table. */
  confirmed: boolean;
}

/**
 * Which chapter a menu choice turns to without leaving the session, or null when it leaves for the page
 * (put away, the Storyteller) or stays in this chapter. `current` is the chapter playing now.
 */
export function turnTargetOf(effect: { kind: string; target?: EnterTarget }, current: { n: number; next: number | null }): ChapterTarget | null {
  if (effect.kind === 'next-chapter') return { kind: 'chapter', n: current.next ?? current.n + 1, from: 'start' };
  if (effect.kind === 'open' && effect.target?.kind === 'chapter' && effect.target.n !== current.n) return effect.target;
  return null;
}

/** The title page that stands over the closed book while the next chapter is prepared. */
export function titlePage(n: number): CardSpec {
  const title = CHAPTERS.find((c) => c.n === n)?.title ?? null;
  return { over: `Chapter ${n}`, title, lines: [], choices: [] };
}

/** Every texture a material holds, in its own slots or a shader's uniforms. */
function texturesOf(material: Material): Texture[] {
  const found: Texture[] = [];
  const look = (value: unknown) => {
    if (value && typeof value === 'object' && (value as Texture).isTexture) found.push(value as Texture);
  };
  for (const value of Object.values(material)) look(value);
  const uniforms = (material as Material & { uniforms?: Record<string, { value: unknown }> }).uniforms;
  if (uniforms) for (const u of Object.values(uniforms)) look(u?.value);
  return found;
}

/**
 * Lets a chapter go: its objects leave the scene, and their geometry, materials, text and paintings are
 * freed, except the paintings the next chapter goes on using (`keep`). Returns how many textures it freed.
 */
export function releaseObjects(roots: readonly Object3D[], keep: ReadonlySet<Texture>, alsoTextures: Iterable<Texture> = []): number {
  const geometries = new Set<{ dispose(): void }>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const texts: Array<{ dispose(): void }> = [];
  for (const root of roots) {
    root.removeFromParent();
    root.traverse((o) => {
      // Troika's text frees its own glyph geometry and material.
      const text = o as Object3D & { isTroikaText?: boolean; dispose?: () => void };
      if (text.isTroikaText && typeof text.dispose === 'function') {
        texts.push(text as { dispose(): void });
        return;
      }
      const mesh = o as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[] };
      if (mesh.geometry) geometries.add(mesh.geometry);
      const m = mesh.material;
      for (const material of Array.isArray(m) ? m : m ? [m] : []) {
        materials.add(material);
        for (const t of texturesOf(material)) textures.add(t);
      }
    });
  }
  for (const t of alsoTextures) textures.add(t);
  for (const t of texts) t.dispose();
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  let freed = 0;
  for (const t of textures) {
    if (keep.has(t)) continue;
    t.dispose();
    freed++;
  }
  return freed;
}

/**
 * The title page, owned by the session rather than by either chapter: it stands over the closed book
 * before the old chapter goes and folds away as the new one opens, so the turn has no gap.
 */
export function createTurnCard(world: World, book: { root: Object3D; pageY: number; pageD: number }) {
  // A stand-in for the book, fixed where it lay: the card is placed against it, and the old book may go.
  const anchor = new Group();
  anchor.name = 'chapter-turn-anchor';
  book.root.updateWorldMatrix(true, false);
  book.root.matrixWorld.decompose(anchor.position, anchor.quaternion, anchor.scale);
  world.scene.add(anchor);
  const card = createCardView({ bookRoot: anchor, pageY: book.pageY, pageD: book.pageD, scene: world.scene });
  const head = new Vector3();
  let folding = false;
  let done = false;
  const stop = world.onXRFrame((_frame: XRFrame, delta: number) => {
    world.camera.getWorldPosition(head);
    card.frame(delta * 1000, head);
    if (folding && !card.shown) finish();
  });
  function finish(): void {
    if (done) return;
    done = true;
    stop();
    card.dispose();
    anchor.removeFromParent();
  }
  return {
    show(spec: CardSpec): void {
      world.camera.getWorldPosition(head);
      void card.open(spec, head);
    },
    /** Folds away, then lets itself go. */
    fold(): void {
      folding = true;
      card.close();
    },
    /** At once, with no fold (the session ended). */
    dispose: finish,
    get standing(): boolean {
      return card.ready;
    },
  };
}
export type TurnCard = ReturnType<typeof createTurnCard>;

/**
 * Near the end of a chapter: the next one's paintings, decoded ahead of time. Chapters share most of
 * their art, so only what the next one adds is loaded (chapter 3's snowy sets); the rest is `reuse`.
 */
export async function preloadChapterArt(n: number, renderer: Parameters<typeof loadStageAssets>[2], reuse: ReadonlyMap<string, TexRef>, allowKtx2: boolean): Promise<Map<string, TexRef>> {
  const get = async (url: string): Promise<unknown> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return response.json();
  };
  const manifest = ShowManifest.parse(await get('./show/manifest.json'));
  const entry = chaptersOf(manifest).find((c) => c.n === n);
  if (!entry) throw new Error(`there is no chapter ${n} in this build`);
  const spine = Spine.parse(await get(`./${entry.episode}`));
  const assets = await loadStageAssets(manifest, './art', renderer, { allowKtx2, spine, reuse });
  return assets.textures;
}
