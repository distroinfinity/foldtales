import type { ObjectDef } from '@tabletop/contracts';

/**
 * Everything the AI Storyteller painted for you, kept on this headset: the picture and what it is.
 * They go in your satchel and come back every evening. Per device for v1 (as agreed); IndexedDB,
 * since pictures are a few hundred KB each. Past the cap, the one you used longest ago makes room.
 */

const DB = 'tabletop-storyteller';
const STORE = 'keepsakes';
export const KEEPSAKE_CAP = 48;

export interface Keepsake {
  def: ObjectDef;
  savedAt: number;
  usedAt: number;
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'def.id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function all(db: IDBDatabase): Promise<Keepsake[]> {
  return new Promise((resolve) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as Keepsake[]);
    request.onerror = () => resolve([]);
  });
}

function write(db: IDBDatabase, put: Keepsake[], remove: string[]): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const k of put) store.put(k);
    for (const id of remove) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

export function createKeepsakes() {
  const db = open();
  return {
    /** Everything kept, most recently used first. Empty if storage isn't available. */
    async list(): Promise<Keepsake[]> {
      const d = await db;
      if (!d) return [];
      return (await all(d)).sort((a, b) => b.usedAt - a.usedAt);
    },
    /** Keep a painted thing (or mark it used again). */
    async keep(def: ObjectDef): Promise<void> {
      const d = await db;
      if (!d) return;
      const now = Date.now();
      const kept = await all(d);
      const before = kept.find((k) => k.def.id === def.id);
      const others = kept.filter((k) => k.def.id !== def.id).sort((a, b) => b.usedAt - a.usedAt);
      const over = others.slice(KEEPSAKE_CAP - 1).map((k) => k.def.id);
      await write(d, [{ def, savedAt: before?.savedAt ?? now, usedAt: now }], over);
    },
    async used(id: string): Promise<void> {
      const d = await db;
      if (!d) return;
      const k = (await all(d)).find((x) => x.def.id === id);
      if (k) await write(d, [{ ...k, usedAt: Date.now() }], []);
    },
  };
}
export type Keepsakes = ReturnType<typeof createKeepsakes>;
