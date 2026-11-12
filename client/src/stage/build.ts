import { Object3D } from '@iwsdk/core';
import { buildBook, CAPTION_WIDTH_SHARE, type BookView } from '../book/book-view.ts';
import { captionText, titleText, type CaptionView } from '../book/text.ts';
import type { StageAssets } from '../paint/assets.ts';
import type { SoftPieces } from '../paint/soft.ts';
import { buildPuppet, type PuppetView } from '../puppet/puppet.ts';
import { buildLeaves, type LeavesView } from '../show/leaves.ts';
import type { ShowManifest } from '../show/manifest.ts';

export interface Stage {
  /** Placed on your table by its spine. Scaled as a whole from tray to desk. */
  root: Object3D;
  book: BookView;
  puppets: Map<string, PuppetView>;
  heads: Map<string, string[]>;
  leaves: LeavesView;
  caption: CaptionView;
}

const dirOf = (path: string): string => path.slice(0, path.lastIndexOf('/'));

/** Where the review scene stands the cast that isn't in the opening. Stage metres. */
const REVIEW_SPOTS: Array<[number, number, number]> = [[-0.105, 0, -0.0175], [-0.02, 0.1, 0.0]];

/** `review` (dev only) puts every cast member on the open book, for the acting review and the frame budget. */
export function buildStage(manifest: ShowManifest, assets: StageAssets, soft: SoftPieces, review = false): Stage {
  const root = new Object3D();
  root.name = 'stage';
  const onStage = manifest.onStage.map((s) => s.cast);
  const book = buildBook({
    book: assets.book,
    set: assets.set,
    textures: assets.textures,
    bookBase: dirOf(manifest.book),
    setBase: dirOf(manifest.set.file),
    soft: { shadow: soft.shadow, hinge: soft.hinge, gutter: soft.gutter },
    castOnStage: onStage,
  });
  root.add(book.root);

  const title = titleText(manifest.title, assets.book.closedSizeM[0]);
  book.titleAnchor.add(title);
  const caption = captionText(assets.book.openSizeM[0] * CAPTION_WIDTH_SHARE);
  book.captionAnchor.add(caption.mesh);

  const puppets = new Map<string, PuppetView>();
  const heads = new Map<string, string[]>();
  const fx = { shadow: soft.shadow, glow: soft.glow, chin: soft.chin, smoke: assets.textures.get('fx/smoke.png') ?? null };
  for (const { cast } of manifest.onStage) {
    const entry = manifest.cast.find((c) => c.member.id === cast);
    const mount = book.mounts.get(cast);
    if (!entry || !mount) continue;
    const rig = assets.rigs.get(cast)!;
    const textures = new Map([...assets.textures].filter(([file]) => file.startsWith(`${entry.member.rig}/`)).map(([file, t]) => [file.slice(entry.member.rig.length + 1), t]));
    const puppet = buildPuppet(entry, rig, textures, fx);
    mount.add(puppet.root);
    puppets.set(cast, puppet);
    heads.set(cast, Object.keys(rig.head?.offsets ?? {}));
  }

  if (review) {
    let spot = 0;
    for (const entry of manifest.cast) {
      if (puppets.has(entry.member.id)) continue;
      const rig = assets.rigs.get(entry.member.id)!;
      const textures = new Map([...assets.textures].filter(([file]) => file.startsWith(`${entry.member.rig}/`)).map(([file, t]) => [file.slice(entry.member.rig.length + 1), t]));
      const puppet = buildPuppet(entry, rig, textures, fx);
      const [x, y, z] = REVIEW_SPOTS[spot++] ?? [0, 0, 0];
      const mount = book.addMount(`review:${entry.member.id}`, [x, y, z]);
      mount.add(puppet.root);
      // A flier's shadow falls on the page below it.
      const shadow = puppet.root.getObjectByName('contact-shadow');
      if (shadow) shadow.position.y = -y + 0.0008;
      puppets.set(entry.member.id, puppet);
      heads.set(entry.member.id, Object.keys(rig.head?.offsets ?? {}));
    }
  }

  const leafTextures = ['fx/leaf-1.png', 'fx/leaf-2.png'].map((f) => assets.textures.get(f)).filter((t) => !!t);
  const leaves = buildLeaves(leafTextures);
  book.root.add(leaves.root);
  return { root, book, puppets, heads, leaves, caption };
}
