import { z } from 'zod';
import type { ShowLog } from '../show/log.ts';
import { Id, type CanonEntry, type ObjectDef, type Page, type ShowEvent, type ShowObject } from '@tabletop/contracts';

/**
 * Series memory, derived from the event log and nothing else: what lasts from each chapter (canon),
 * what you carry (the satchel, each thing with its history), and each chapter's page. Only the app
 * writes it. "Give it back" appends a reversal, so the next chapter plays as if it never happened.
 */

/**
 * What a chapter records, by which beats played. Data beside the episode, so the engine knows no
 * names: a fact is kept when any of its beats played, and the first matching fact of a key wins.
 */
export const ChapterCanon = z.strictObject({
  episodeId: Id,
  title: z.string().min(1),
  /** Facts the next chapter can branch on: `key` is what it reads (e.g. how the lantern came back), `value` the answer. */
  facts: z.array(
    z.strictObject({
      key: Id,
      value: Id,
      beats: z.array(Id).min(1),
      text: z.string().min(1),
      /** The line the recorded page prints, said to the reader ("You held the lantern…"). Facts without one aren't printed. */
      page: z.string().min(1).max(120).optional(),
    }),
  ),
  /** One sentence of history for whatever you keep, by object def (or `default`): the first whose beats played, or one with no beats. */
  history: z.record(z.string(), z.array(z.strictObject({ beats: z.array(Id).optional(), text: z.string().min(1) })).min(1)),
});
export type ChapterCanon = z.infer<typeof ChapterCanon>;

export interface Keepsake {
  object: ShowObject;
  /** The canon entry that keeps it, which "Give it back" reverts. */
  entryId: string;
}

export interface ChapterRecord {
  episodeId: string;
  page: Page;
  /** Facts recorded at its end, still standing. */
  facts: Map<string, { value: string; entry: CanonEntry }>;
}

export interface Memory {
  canon: CanonEntry[];
  /** Fact values by key, across chapters, newest first wins. */
  facts: Map<string, string>;
  satchel: Keepsake[];
  /** Finished chapters in the order they were last finished. */
  chapters: ChapterRecord[];
}

const factId = (episodeId: string, key: string) => `${episodeId}--${key}`;
export const keepId = (objectId: string) => `keep--${objectId}`;

/** The pure reduction. Events are taken in log order. */
export function memoryOf(events: readonly ShowEvent[], defs: ReadonlyMap<string, ObjectDef>): Memory {
  const entries = new Map<string, CanonEntry>();
  const reverted = new Set<string>();
  const histories = new Map<string, Array<{ episodeId: string; text: string }>>();
  const pages = new Map<string, Page>();
  const order: string[] = [];
  for (const e of events) {
    if (e.type === 'canon.recorded') {
      entries.set(e.data.entry.id, e.data.entry);
      reverted.delete(e.data.entry.id);
    } else if (e.type === 'canon.reverted') reverted.add(e.data.entryId);
    else if (e.type === 'object.kept' && e.episodeId) {
      const list = histories.get(e.data.objectId) ?? [];
      if (!list.some((h) => h.episodeId === e.episodeId)) list.push({ episodeId: e.episodeId, text: e.data.history });
      histories.set(e.data.objectId, list);
    } else if (e.type === 'page.composed') {
      pages.set(e.data.page.episodeId, e.data.page);
      const i = order.indexOf(e.data.page.episodeId);
      if (i >= 0) order.splice(i, 1);
      order.push(e.data.page.episodeId);
    }
  }
  const canon = [...entries.values()].filter((c) => !reverted.has(c.id));
  const standing = new Set(canon.map((c) => c.id));
  const facts = new Map<string, string>();
  const chapters: ChapterRecord[] = order.map((episodeId) => {
    const chapterFacts = new Map<string, { value: string; entry: CanonEntry }>();
    for (const c of canon) {
      if (c.kind !== 'event' || c.episodeId !== episodeId) continue;
      const [key, value] = c.sourceEventId.split('=') as [string, string];
      chapterFacts.set(key, { value, entry: c });
    }
    return { episodeId, page: pages.get(episodeId)!, facts: chapterFacts };
  });
  for (const ch of chapters) for (const [key, f] of ch.facts) facts.set(key, f.value);
  // The satchel is what the latest page kept, less anything given back.
  const latest = chapters.at(-1);
  const satchel: Keepsake[] = [];
  for (const id of latest?.page.keepsakes ?? []) {
    const entryId = keepId(id);
    const def = defs.get(id);
    if (!def || !standing.has(entryId)) continue;
    satchel.push({ object: { id, def, owner: 'reader', origin: 'satchel', history: histories.get(id) ?? [] }, entryId });
  }
  return { canon, facts, satchel, chapters };
}

/**
 * What a chapter hands on: the keepsakes its page kept, less anything given back since, each with
 * its history. Empty if that chapter was never finished.
 */
export function keptAfter(memory: Memory, episodeId: string, defs: ReadonlyMap<string, ObjectDef>, events: readonly ShowEvent[]): ShowObject[] {
  const record = memory.chapters.find((c) => c.episodeId === episodeId);
  if (!record) return [];
  const standing = new Set(memory.canon.map((c) => c.id));
  const histories = new Map<string, Array<{ episodeId: string; text: string }>>();
  for (const e of events) {
    if (e.type !== 'object.kept' || !e.episodeId) continue;
    const list = histories.get(e.data.objectId) ?? [];
    if (!list.some((h) => h.episodeId === e.episodeId)) list.push({ episodeId: e.episodeId, text: e.data.history });
    histories.set(e.data.objectId, list);
  }
  const out: ShowObject[] = [];
  for (const id of record.page.keepsakes ?? []) {
    const def = defs.get(id);
    if (!def || !standing.has(keepId(id))) continue;
    out.push({ id, def, owner: 'reader', origin: 'satchel', history: histories.get(id) ?? [] });
  }
  return out;
}

/** The recorded page prints at most this many lines (API shapes, section 1). */
export const PAGE_LINES = 3;

export type Append = ShowLog['append'];

/**
 * A chapter's end, written once: what you keep (with its history), the facts the next chapter reads,
 * and the page. `played` is every beat id that played; `kept` is what is in the satchel now.
 */
export function recordChapterEnd(append: Append, canonData: ChapterCanon, played: ReadonlySet<string>, kept: readonly string[], defs: ReadonlyMap<string, ObjectDef>, setArt: string[]): void {
  const { episodeId } = canonData;
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const f of canonData.facts) {
    if (seen.has(f.key) || !f.beats.some((b) => played.has(b))) continue;
    seen.add(f.key);
    if (f.page && lines.length < PAGE_LINES) lines.push(f.page);
    append('canon.recorded', { entry: { id: factId(episodeId, f.key), kind: 'event', text: f.text, episodeId, sourceEventId: `${f.key}=${f.value}` } });
  }
  for (const id of kept) {
    const def = defs.get(id);
    if (!def) continue;
    const options = canonData.history[id] ?? canonData.history.default ?? [];
    const history = options.find((h) => !h.beats || h.beats.some((b) => played.has(b)))?.text ?? `Kept from "${canonData.title}".`;
    append('object.kept', { objectId: id, playerId: 'reader', history });
    append('canon.recorded', { entry: { id: keepId(id), kind: 'keepsake', text: `The Reader kept the ${def.name}.`, episodeId, sourceEventId: `keep=${id}` } });
  }
  append('page.composed', { page: { episodeId, title: canonData.title, text: lines, art: setArt.map((path) => ({ kind: 'asset' as const, path })), keepsakes: [...kept] } });
}
