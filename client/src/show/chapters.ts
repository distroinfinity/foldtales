import { ObjectDef, Spine, type ShowObject } from '@tabletop/contracts';
import { ChapterCanon, keptAfter, memoryOf } from '../memory/memory.ts';
import { indexedDbLogStore, type LogStore } from './log.ts';
import { ShowManifest } from './manifest.ts';

/**
 * Chapters for the host (lane A): one chapter per page load, prepared before the book opens.
 * The shape is the sprint's agreed one (`docs/plans/2026-11-16-finish-api-shapes.md`, section 1
 * and amendment 1); a change to it goes through the sprint master.
 *
 * Today the build has chapter 1 only, read from the manifest as `index.ts` reads it. The chapter
 * list and carry slots arrive with chapter 2's data (lane B, stage 3).
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
  /** Keepsakes carried in from the chapter before, with their histories, for the host to put in the satchel. */
  satchel: ShowObject[];
  /** Who stands on which mark as the first spread opens (amendment 2): what `manifest.onStage` is for chapter 1. */
  onStage: ReadonlyArray<{ cast: string; mark: string }>;
  /** Where the reader is, for "Stopped on the shore.", from a beat id; null when unknown. */
  where(beatId: string): string | null;
}

/** Where each spread is, in the reader's words, by episode and scene index. */
const WHERE: Record<string, readonly string[]> = {
  'chapter-1': ['Stopped at the top of the lighthouse.', 'Stopped on the shore.', 'Stopped at the gap.'],
};

/** A spread's place in the reader's words, from its episode and scene index; null when unknown. */
export function whereIn(episodeId: string, sceneIndex: number): string | null {
  return WHERE[episodeId]?.[sceneIndex] ?? null;
}

/** The chapters in this build, in order, from the manifest's list (or chapter 1 alone, from before it had one). */
function chaptersOf(manifest: ShowManifest): NonNullable<ShowManifest['chapters']> {
  return manifest.chapters?.length ? [...manifest.chapters].sort((a, b) => a.n - b.n) : [{ n: 1, episode: manifest.episode, onStage: manifest.onStage }];
}

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface ChapterDeps {
  fetchJson?: Fetch;
  /** The series log, for what earlier chapters kept. IndexedDB by default. */
  log?: LogStore;
}

/** Prepares chapter n for this page load. Rejects if it can't (no such chapter, or its data won't load). */
export async function loadChapter(n: number, deps: ChapterDeps = {}): Promise<ChapterData> {
  const fetchJson: Fetch = deps.fetchJson ?? ((url) => fetch(url));
  const get = async (url: string) => {
    const response = await fetchJson(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return response.json();
  };
  const manifest = ShowManifest.parse(await get('./show/manifest.json'));
  const chapters = chaptersOf(manifest);
  const entry = chapters.find((c) => c.n === n);
  if (!entry) throw new Error(`there is no chapter ${n} in this build`);
  const path = entry.episode;
  const episode = Spine.parse(await get(`./${path}`));
  // A chapter without a canon file still plays; it just records nothing at its end.
  const canon = await get(`./${path.replace(/\.json$/, '.canon.json')}`)
    .then((raw) => ChapterCanon.parse(raw))
    .catch(() => null);
  const satchel = n > 1 ? await carriedIn(manifest, get, deps.log ?? indexedDbLogStore(), `chapter-${n - 1}`) : [];
  const sceneOf = new Map(episode.scenes.flatMap((scene, i) => scene.beats.map((beat) => [beat.id, i] as const)));
  return {
    n,
    title: episode.title,
    episodeId: episode.id,
    episode,
    canon,
    next: chapters.find((c) => c.n > n)?.n ?? null,
    satchel,
    onStage: entry.onStage,
    where: (beatId) => {
      const scene = sceneOf.get(beatId);
      return scene === undefined ? null : (entry.where?.[scene] ?? whereIn(episode.id, scene));
    },
  };
}

/** What the chapter before kept, from this series' log. A log that can't be read carries nothing in. */
async function carriedIn(manifest: ShowManifest, get: (url: string) => Promise<unknown>, log: LogStore, before: string): Promise<ShowObject[]> {
  try {
    const events = (await log.all()).filter((e) => e.seriesId === manifest.libraryVersion);
    const defs = new Map<string, ObjectDef>();
    for (const file of manifest.objectFiles) {
      const def = ObjectDef.parse(await get(`./art/${file}`));
      defs.set(def.id, def);
    }
    for (const def of manifest.extraObjects) defs.set(def.id, def);
    return keptAfter(memoryOf(events, defs), before, defs, events);
  } catch {
    return [];
  }
}
