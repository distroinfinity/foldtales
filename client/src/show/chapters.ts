import { Spine } from '@tabletop/contracts';
import { ChapterCanon } from '../memory/memory.ts';
import { ShowManifest } from './manifest.ts';

/**
 * Chapters for the host (lane A): one chapter per page load, prepared before the book opens.
 * The shape is the sprint's agreed one (`docs/plans/2026-11-16-finish-api-shapes.md`, section 1);
 * a change to it goes through the sprint master.
 *
 * Stub, Nov 16: only chapter 1, read from the manifest as `index.ts` reads it today. The chapter
 * list, carry slots and the satchel across chapters come in lane B's stage 3.
 */
export interface ChapterData {
  n: number;
  /** From the episode's own data. */
  title: string;
  episodeId: string;
  /** The chapter's spine, as `loadStageAssets` reads it today. */
  episode: Spine;
  /** What the chapter records when it ends, or null if it records nothing. */
  canon: ChapterCanon | null;
  /** The next chapter's number, or null for the last one in this build. */
  next: number | null;
  /** Where the reader is, for "Stopped on the shore.", from a beat id; null when unknown. */
  where(beatId: string): string | null;
}

/** Where each spread is, in the reader's words, by scene id. */
const WHERE: Record<string, Record<string, string>> = {
  'chapter-1': { 'the-lamp': 'Stopped at the top of the lighthouse.', 'the-shore': 'Stopped on the shore.', 'the-gap': 'Stopped at the gap.' },
};

/** The chapters in this build, in order: the episode file beside `show/manifest.json`. */
function episodesOf(manifest: ShowManifest): string[] {
  return [manifest.episode];
}

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Prepares chapter n for this page load. Rejects if it can't (no such chapter, or its data won't load). */
export async function loadChapter(n: number, fetchJson: Fetch = (url) => fetch(url)): Promise<ChapterData> {
  const get = async (url: string) => {
    const response = await fetchJson(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return response.json();
  };
  const manifest = ShowManifest.parse(await get('./show/manifest.json'));
  const episodes = episodesOf(manifest);
  const path = Number.isInteger(n) && n >= 1 ? episodes[n - 1] : undefined;
  if (!path) throw new Error(`there is no chapter ${n} in this build`);
  const episode = Spine.parse(await get(`./${path}`));
  // A chapter without a canon file still plays; it just records nothing at its end.
  const canon = await get(`./${path.replace(/\.json$/, '.canon.json')}`)
    .then((raw) => ChapterCanon.parse(raw))
    .catch(() => null);
  const sceneOf = new Map(episode.scenes.flatMap((scene) => scene.beats.map((beat) => [beat.id, scene.id] as const)));
  return {
    n,
    title: episode.title,
    episodeId: episode.id,
    episode,
    canon,
    next: n < episodes.length ? n + 1 : null,
    where: (beatId) => {
      const scene = sceneOf.get(beatId);
      return scene ? (WHERE[episode.id]?.[scene] ?? null) : null;
    },
  };
}
