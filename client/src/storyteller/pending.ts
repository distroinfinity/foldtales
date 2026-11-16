import type { StoryPage } from '@tabletop/contracts';

/**
 * Finished stories waiting for the server, on this headset, under their reader: a page is kept
 * here from the moment a story ends until the server acknowledges it. Its own IndexedDB database,
 * so the shared keepsakes' store never needs a version change.
 *
 * A reader's pages are private: sign-out and deletion remove them (`forgetReaderPending`), and
 * nothing is written for a reader who has since changed (the provider checks the generation).
 */

export interface PendingStory {
  id: string;
  readerId: string;
  page: StoryPage;
  endedAt: string;
}

export interface PendingStore {
  put(item: PendingStory): Promise<void>;
  all(): Promise<PendingStory[]>;
  remove(id: string): Promise<void>;
}

const DB = 'tabletop-storyteller-pending';
const STORE = 'finished';

let opened: Promise<IDBDatabase | null> | null = null;
const db = (): Promise<IDBDatabase | null> =>
  (opened ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));

/** Runs one transaction to its end; undefined if storage can't be reached. */
async function tx<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise((resolve) => {
    const t = d.transaction(STORE, mode);
    const request = work(t.objectStore(STORE));
    t.oncomplete = () => resolve(request ? (request.result as T) : undefined);
    t.onerror = () => resolve(undefined);
    t.onabort = () => resolve(undefined);
  });
}

export function indexedPending(): PendingStore {
  return {
    put: async (item) => void (await tx('readwrite', (s) => s.put(item))),
    all: async () => ((await tx('readonly', (s) => s.getAll())) as PendingStory[] | undefined) ?? [],
    remove: async (id) => void (await tx('readwrite', (s) => s.delete(id))),
  };
}

/** Removes every page waiting for this reader, and resolves once the deletion is done. Never throws. */
export async function forgetReaderPending(readerId: string, store: PendingStore = indexedPending()): Promise<void> {
  try {
    for (const item of await store.all()) if (item.readerId === readerId) await store.remove(item.id);
  } catch {
    // Storage gone: nothing left to remove.
  }
}
