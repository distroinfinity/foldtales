import type { ShowEvent } from '@tabletop/contracts';

type EventOf<T extends ShowEvent['type']> = Extract<ShowEvent, { type: T }>;

export interface LogStore {
  all(): Promise<ShowEvent[]>;
  put(event: ShowEvent): Promise<void>;
}

/** Every grab, beat and pause appends here, in order. It's what resume, recovery and Story Circle read. */
export function createShowLog(store: LogStore, ids: { seriesId: string; episodeId: string | null }, clock: { nowIso(): string; showMs(): number }) {
  let next: Promise<number> = store
    .all()
    .then((events) => events.reduce((max, e) => Math.max(max, (e.seq ?? -1) + 1), 0))
    .catch(() => 0);
  let writing: Promise<unknown> = next;
  /** The latest events, in memory, for the director's sense of what just happened. */
  const latest: ShowEvent[] = [];
  return {
    append<T extends ShowEvent['type']>(type: T, data: EventOf<T>['data']): void {
      const at = clock.nowIso();
      const showMs = Math.max(0, clock.showMs());
      const id = crypto.randomUUID();
      const seq = next.then((n) => n);
      next = next.then((n) => n + 1);
      latest.push({ v: 1, id, seq: null, seriesId: ids.seriesId, episodeId: ids.episodeId, actor: { kind: 'app' }, showMs, at, type, data } as unknown as ShowEvent);
      if (latest.length > 60) latest.shift();
      writing = Promise.all([seq, writing]).then(([n]) => {
        const event = { v: 1, id, seq: n, seriesId: ids.seriesId, episodeId: ids.episodeId, actor: { kind: 'app' }, showMs, at, type, data } as unknown as ShowEvent;
        return store.put(event);
      }).catch(() => undefined);
    },
    /** The last `n` events appended this visit, oldest first. */
    recent: (n = 40): ShowEvent[] => latest.slice(-n),
    /** A new chapter, or the same from the top: what happened before is no longer "just now". */
    forget(): void {
      latest.length = 0;
    },
    /** Resolves once everything appended so far has been written (or failed quietly). */
    flushed: async (): Promise<void> => {
      await writing.catch(() => undefined);
    },
  };
}
export type ShowLog = ReturnType<typeof createShowLog>;

export function memoryLogStore(): LogStore {
  const events: ShowEvent[] = [];
  return { all: async () => [...events], put: async (event) => void events.push(event) };
}

const DB = 'tt-show';
const STORE = 'events';

/** IndexedDB, asked to persist. Any failure falls back to memory for this visit. */
export function indexedDbLogStore(): LogStore {
  const open = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  void navigator.storage?.persist?.().catch(() => false);
  const fallback = memoryLogStore();
  const tx = <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    open.then((db) => new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  return {
    all: () => tx('readonly', (s) => s.getAll() as IDBRequest<ShowEvent[]>).then((events) => events.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))).catch(() => fallback.all()),
    put: (event) => tx('readwrite', (s) => s.put(event)).then(() => undefined).catch(() => fallback.put(event)),
  };
}
