/**
 * What you've kept, for the page's Your book: keepsakes from the chapters and things painted for you,
 * by name. Read-only, and light enough for a phone: it reads the series log straight from IndexedDB
 * (no 3D, no object library) and lane D's keepsake list. Each read says whether it worked, so
 * "nothing kept yet" and "couldn't read" are never confused.
 */
import type { ShowEvent } from '@tabletop/contracts';
import { listKeepsakes } from '../stage/seams.ts';

export type Read<T> = { ok: true; value: T } | { ok: false };

export interface Collection {
  /** Keepsakes from the chapters (null: that store couldn't be read). */
  chapters: string[] | null;
  /** Things painted for you in the Storyteller (null: that store couldn't be read). */
  painted: string[] | null;
}

/** The kept things' names, from the log: the latest chapter page's keepsakes, less anything given back. */
export function keptNames(events: readonly ShowEvent[]): string[] {
  const names = new Map<string, string>();
  const standing = new Set<string>();
  let latest: string[] = [];
  for (const e of events) {
    if (e.type === 'canon.recorded' && e.data.entry.kind === 'keepsake') {
      const id = e.data.entry.sourceEventId.replace(/^keep=/, '');
      const name = /^The Reader kept the (.+?)\.?$/.exec(e.data.entry.text)?.[1];
      if (name) names.set(id, name);
      standing.add(e.data.entry.id);
    } else if (e.type === 'canon.reverted') standing.delete(e.data.entryId);
    else if (e.type === 'page.composed') latest = e.data.page.keepsakes;
  }
  return latest.flatMap((id) => (standing.has(`keep--${id}`) && names.has(id) ? [names.get(id)!] : []));
}

/** The series log, read once. A failure to open or read says so; it never pretends the log is empty. */
export function readLog(idb: IDBFactory | undefined = globalThis.indexedDB): Promise<Read<ShowEvent[]>> {
  return new Promise((resolve) => {
    try {
      if (!idb) return resolve({ ok: false });
      const request = idb.open('tt-show', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('events', { keyPath: 'id' });
      request.onerror = () => resolve({ ok: false });
      request.onsuccess = () => {
        try {
          const read = request.result.transaction('events', 'readonly').objectStore('events').getAll();
          read.onsuccess = () => resolve({ ok: true, value: (read.result as ShowEvent[]).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)) });
          read.onerror = () => resolve({ ok: false });
        } catch {
          resolve({ ok: false });
        }
      };
    } catch {
      resolve({ ok: false });
    }
  });
}

export async function readCollection(deps: { log?: () => Promise<Read<ShowEvent[]>>; painted?: typeof listKeepsakes } = {}): Promise<Collection> {
  const [log, painted] = await Promise.all([(deps.log ?? readLog)(), (deps.painted ?? listKeepsakes)().catch(() => ({ ok: false as const }))]);
  return {
    chapters: log.ok ? keptNames(log.value) : null,
    painted: painted.ok ? painted.items.map((i) => i.name) : null,
  };
}
