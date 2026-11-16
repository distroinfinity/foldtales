/**
 * The AI Storyteller's provider: what its door shows and the stories on your shelf, for the page
 * (lane A draws the door, lane B's `libraryState()` carries the snapshot). Shapes agreed in
 * `docs/plans/2026-11-16-finish-api-shapes.md` §2; a change to one goes through the sprint master.
 *
 * `storytellerSnapshot()` is synchronous, from what's cached. `refreshStoryteller()` re-checks
 * sign-in, the microphone, the connection and tonight's limit, and tells subscribers.
 *
 * Privacy (stage 2, ruling 10): your shelf is per reader, cached under your id and cleared at
 * sign-out with the rest of the reader's keys; a refresh that comes back after the reader changed
 * is dropped. A finished story waits on this headset, under its reader, until the server has it.
 */
import { BackendError, SIGN_IN_REQUIRED, StoryPage, type BackendApi, type StoryRecord } from '@tabletop/contracts';
import { cachedReader, getSession, readGeneration, readerBackend, sessionLapsed } from '../account/index.ts';
import { ACCOUNTS_ON, STORYTELLER_ON } from '../landing/flags.ts';
import { reviewQuery } from '../dev.ts';
import { createKeepsakes } from './keepsakes.ts';
import { indexedPending, type PendingStore, type PendingStory } from './pending.ts';

export type { PendingStore, PendingStory } from './pending.ts';
import type { StoryEnding } from './session.ts';

export type DoorState =
  | { kind: 'signed-out' }
  | { kind: 'auth-loading' }
  | { kind: 'auth-failed' }
  | { kind: 'session-expired' }
  | { kind: 'mic-not-asked' }
  | { kind: 'mic-refused' }
  | { kind: 'unavailable'; why: 'offline' | 'service' }
  | { kind: 'limit-reached'; until: string | null }
  | { kind: 'ready' };

export interface FinishedStory {
  id: string;
  title: string;
  endedAt: string;
  /** Two or three lines of what happened. */
  lines: string[];
  /** Names of the things painted for it. */
  things: string[];
}

export interface StorytellerSnapshot {
  door: DoorState;
  finished: FinishedStory[];
}

// ---- what the provider depends on, swappable for tests ------------------------------------

type Mic = 'granted' | 'denied' | 'prompt';
type Availability = Awaited<ReturnType<BackendApi['storytellerAvailability']>>;

export interface ProviderDeps {
  /** The build has the Storyteller on (TT_PUBLIC_STORYTELLER isn't off) and sign-in on. */
  built(): boolean;
  /** The reader this browser knows, without asking; null for a guest. */
  cachedReader(): { id: string } | null;
  /** Asks the server who's signed in; null for nobody. `'failed'` when it couldn't be asked. */
  session(): Promise<{ id: string } | null | 'failed'>;
  /** The server forgot this browser's session. */
  lapsed(): boolean;
  /** The reader generation: bumped by every sign-in, sign-out and delete. */
  generation(): number;
  mic(): Promise<Mic>;
  backend<T>(call: (api: BackendApi) => Promise<T>): Promise<T | null>;
  online(): boolean;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  pending: PendingStore;
}

const SHELF_KEY = (readerId: string) => `tt.storyteller.shelf.${readerId}`;
const MIC_KEY = 'tt.storyteller.mic';

const sentencesOf = (text: string): string[] => (text.match(/[^.!?…]+[.!?…]+["”']?/g) ?? [text]).map((s) => s.trim()).filter(Boolean).slice(0, 3);

const toFinished = (r: StoryRecord): FinishedStory | null =>
  r.endedAt ? { id: r.id, title: r.title, endedAt: r.endedAt, lines: r.summary ? sentencesOf(r.summary) : [], things: r.things } : null;

/** The provider, over its dependencies. The module's own functions below use the real ones. */
export function createStorytellerProvider(deps: ProviderDeps) {
  const listeners = new Set<() => void>();
  let door: DoorState = { kind: 'auth-loading' };
  let finished: FinishedStory[] = [];
  let snapshot: StorytellerSnapshot = { door, finished };
  let refreshing: Promise<void> | null = null;

  const publish = (): void => {
    snapshot = { door, finished };
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // A listener's own problem; the others still hear.
      }
    }
  };

  const readShelf = (readerId: string): FinishedStory[] => {
    try {
      const raw = deps.storage.getItem(SHELF_KEY(readerId));
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      return Array.isArray(parsed) ? (parsed as FinishedStory[]) : [];
    } catch {
      return [];
    }
  };
  const writeShelf = (readerId: string, shelf: FinishedStory[]): void => {
    try {
      deps.storage.setItem(SHELF_KEY(readerId), JSON.stringify(shelf.slice(0, 30)));
    } catch {
      // The shelf is still shown from memory.
    }
  };

  /** Pending stories first (newest), then the server's, with no repeats. */
  const merge = (pending: PendingStory[], saved: FinishedStory[]): FinishedStory[] => {
    const local = pending.map((p) => ({ id: p.id, title: p.page.title, endedAt: p.endedAt, lines: p.page.summary ? sentencesOf(p.page.summary) : [], things: p.page.things }));
    const ids = new Set(local.map((s) => s.id));
    return [...local, ...saved.filter((s) => !ids.has(s.id))].sort((a, b) => b.endedAt.localeCompare(a.endedAt)).slice(0, 30);
  };

  // What's cached, at once: the shelf of the reader this browser knows.
  const initial = deps.cachedReader();
  if (initial) finished = readShelf(initial.id);
  snapshot = { door, finished };

  /** Sends what's pending for this reader; drops anything left by another reader (their sign-out dropped it). */
  async function flush(readerId: string, generation: number): Promise<void> {
    const same = () => deps.generation() === generation && deps.cachedReader()?.id === readerId;
    for (const item of await deps.pending.all().catch(() => [] as PendingStory[])) {
      if (!same()) return;
      if (item.readerId !== readerId) {
        // Another reader's page: theirs to send. Their sign-out or deletion removes it.
        continue;
      }
      const answer = await deps.backend((api) => api.endStory({ storyId: item.id, reason: 'time', page: item.page })).catch((cause: unknown) => {
        // A story the server will never know (deleted, or never reserved) can't ever be saved: let it go.
        if (cause instanceof BackendError && cause.code === 'bad_request') return 'gone' as const;
        return null;
      });
      if (!same()) return;
      // Removed only on the server's answer: the saved record, or a story it will never have.
      if (answer === 'gone' || (answer && answer.record.id === item.id)) await deps.pending.remove(item.id).catch(() => {});
    }
  }

  async function doRefresh(): Promise<void> {
    const generation = deps.generation();
    const known = deps.cachedReader()?.id ?? null;
    /** Still the same reader as when this refresh began: checked after every wait, before every write or publish. */
    const same = (readerId: string | null = known) => deps.generation() === generation && (deps.cachedReader()?.id ?? null) === readerId;
    if (!deps.built()) {
      door = { kind: 'unavailable', why: 'service' };
      return publish();
    }
    if (!known) {
      door = deps.lapsed() ? { kind: 'session-expired' } : { kind: 'signed-out' };
      finished = [];
      return publish();
    }
    if (door.kind === 'signed-out' || door.kind === 'session-expired') {
      door = { kind: 'auth-loading' };
      publish();
    }
    const who = deps.online() ? await deps.session() : 'failed';
    if (who === null) {
      if (deps.generation() !== generation) return;
      door = deps.lapsed() ? { kind: 'session-expired' } : { kind: 'signed-out' };
      finished = [];
      return publish();
    }
    const readerId = who === 'failed' ? known : who.id;
    if (!same(readerId)) return;
    if (who === 'failed') {
      const waiting = (await deps.pending.all().catch(() => [] as PendingStory[])).filter((p) => p.readerId === readerId);
      if (!same(readerId)) return;
      finished = merge(waiting, readShelf(readerId));
      door = deps.online() ? { kind: 'auth-failed' } : { kind: 'unavailable', why: 'offline' };
      return publish();
    }

    await flush(readerId, generation);
    if (!same(readerId)) return;
    const [availability, shelf] = await Promise.all([
      deps.backend((api) => api.storytellerAvailability({})).catch((cause: unknown) => (cause instanceof BackendError && cause.message === SIGN_IN_REQUIRED ? ('signed-out' as const) : null)),
      deps.backend((api) => api.listStories({})).catch(() => null),
    ]);
    if (!same(readerId)) return;
    const waiting = (await deps.pending.all().catch(() => [] as PendingStory[])).filter((p) => p.readerId === readerId);
    if (!same(readerId)) return;
    let nextDoor: DoorState;
    if (availability === 'signed-out') nextDoor = { kind: 'session-expired' };
    else if (!availability) nextDoor = { kind: 'unavailable', why: deps.online() ? 'service' : 'offline' };
    else {
      const mic = await deps.mic();
      if (!same(readerId)) return;
      nextDoor = doorFor(availability, mic);
    }
    // Every wait is behind us: the reader is still the one this refresh began with.
    if (shelf) {
      const saved = shelf.stories.map(toFinished).filter((x): x is FinishedStory => x !== null);
      writeShelf(readerId, saved);
      finished = merge(waiting, saved);
    } else finished = merge(waiting, readShelf(readerId));
    door = nextDoor;
    publish();
  }

  const doorFor = (a: Availability, mic: Mic): DoorState => {
    if (a.status === 'resting') return { kind: 'unavailable', why: 'service' };
    if (a.status === 'used-today') return { kind: 'limit-reached', until: a.resetsAt };
    if (mic === 'denied') return { kind: 'mic-refused' };
    if (mic === 'prompt') return { kind: 'mic-not-asked' };
    return { kind: 'ready' };
  };

  const self = {
    snapshot: (): StorytellerSnapshot => snapshot,
    /** Review builds only: shows this door, whatever is true. */
    force(next: DoorState): void {
      door = next;
      publish();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Never throws; overlapping calls share one check. */
    refresh(): Promise<void> {
      refreshing ??= doRefresh()
        .catch(() => {
          door = { kind: 'unavailable', why: deps.online() ? 'service' : 'offline' };
          publish();
        })
        .finally(() => {
          refreshing = null;
        });
      return refreshing;
    },
    /** Asks for the microphone, and updates the door with the answer. */
    async askMicrophone(ask: () => Promise<'granted' | 'denied'>): Promise<'granted' | 'denied'> {
      const answer = await ask();
      try {
        deps.storage.setItem(MIC_KEY, answer);
      } catch {
        // The permission itself is the browser's; this only remembers the answer for the door.
      }
      if (door.kind === 'mic-not-asked' || door.kind === 'mic-refused' || door.kind === 'ready') {
        door = answer === 'granted' ? { kind: 'ready' } : { kind: 'mic-refused' };
        publish();
      }
      return answer;
    },
    /** Saves a finished story: on the shelf at once, kept on this headset until the server has it. */
    async recordFinished(story: { id: string } & StoryEnding): Promise<void> {
      const reader = deps.cachedReader();
      if (!reader) return;
      const generation = deps.generation();
      const same = () => deps.generation() === generation && deps.cachedReader()?.id === reader.id;
      const summary = story.lines.join(' ').slice(0, 400);
      const parsed = StoryPage.safeParse({ title: story.title.slice(0, 80) || "Tonight's story", summary: summary.length ? summary : null, things: story.things.map((t) => t.slice(0, 60)).slice(0, 12) });
      if (!parsed.success) return;
      const item: PendingStory = { id: story.id, readerId: reader.id, page: parsed.data, endedAt: new Date().toISOString() };
      await deps.pending.put(item).catch(() => {});
      // The reader changed while it was written (sign-out, deletion): it never stays behind.
      if (!same()) {
        await deps.pending.remove(item.id).catch(() => {});
        return;
      }
      finished = merge([item], finished);
      publish();
      void flush(reader.id, generation).then(() => (same() ? self.refresh() : undefined));
    },
  };
  return self;
}
export type StorytellerProvider = ReturnType<typeof createStorytellerProvider>;

// ---- the real dependencies ----------------------------------------------------------------

const localStore: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: (key) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Private mode, or full: the shelf lives in memory then.
    }
  },
  removeItem: (key) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Nothing to clear.
    }
  },
};

async function micPermission(): Promise<Mic> {
  const remembered = localStore.getItem(MIC_KEY);
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    // A prompt dismissed (not blocked) still reads 'prompt': the reader's own no on this headset stands.
    if (status) return status.state === 'prompt' && remembered === 'denied' ? 'denied' : status.state;
  } catch {
    // Not every browser answers for the microphone.
  }
  return remembered === 'granted' || remembered === 'denied' ? remembered : 'prompt';
}

let provider: StorytellerProvider | null = null;
const real = (): StorytellerProvider =>
  (provider ??= createStorytellerProvider({
    built: () => STORYTELLER_ON && ACCOUNTS_ON,
    cachedReader: () => cachedReader(),
    session: async () => {
      try {
        const s = await getSession();
        return s ? { id: s.user.id } : cachedReader() && !sessionLapsed() ? 'failed' : null;
      } catch {
        return 'failed';
      }
    },
    lapsed: () => sessionLapsed(),
    generation: () => readGeneration(),
    mic: micPermission,
    backend: (call) => readerBackend().withBackend(call),
    online: () => globalThis.navigator?.onLine !== false,
    storage: localStore,
    pending: indexedPending(),
  }));

// ---- the agreed functions -------------------------------------------------------------------

/** Synchronous, from what's cached. */
export function storytellerSnapshot(): StorytellerSnapshot {
  return real().snapshot();
}

/** Called whenever the snapshot changes. Returns the unsubscribe. */
export function subscribeStoryteller(listener: () => void): () => void {
  return real().subscribe(listener);
}

/** Re-checks sign-in, the microphone, the connection and tonight's limit. Never throws. Also sends any finished story still waiting. */
export function refreshStoryteller(): Promise<void> {
  // Review builds: `?door=mic-refused` (any state) shows that door, for the page's proofs (lane A).
  let forced: DoorState['kind'] | null = null;
  try {
    forced = reviewQuery('door') as DoorState['kind'] | null;
  } catch {
    // No page address to read (tests, workers): no override.
  }
  if (forced) return Promise.resolve(real().force(forced === 'unavailable' ? { kind: 'unavailable', why: 'offline' } : forced === 'limit-reached' ? { kind: 'limit-reached', until: null } : ({ kind: forced } as DoorState)));
  return real().refresh();
}

/**
 * Asks for the microphone on the page, because a first prompt inside XR ended the session
 * (measured twice). The stream only proves permission, so it closes at once.
 */
export function askMicrophone(): Promise<'granted' | 'denied'> {
  return real().askMicrophone(async () => {
    const getUserMedia = globalThis.navigator?.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!getUserMedia) return 'denied';
    try {
      const stream = await getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      for (const track of stream.getTracks()) track.stop();
      return 'granted';
    } catch {
      return 'denied';
    }
  });
}

/** Saves a finished story to the reader's shelf (kept on this headset until the server has it). Playback never waits on it. */
export function recordFinished(story: { id: string } & StoryEnding): Promise<void> {
  return real().recordFinished(story);
}

/** Things painted for you, names only. Tagged so "nothing yet" and "couldn't read" differ. */
export async function listKeepsakes(): Promise<{ ok: true; items: Array<{ id: string; name: string }> } | { ok: false }> {
  const kept = await createKeepsakes()
    .read()
    .catch(() => null);
  if (!kept) return { ok: false };
  return { ok: true, items: kept.map((k) => ({ id: k.def.id, name: k.def.name })) };
}

// A story that finished offline goes out when the connection comes back.
globalThis.addEventListener?.('online', () => void refreshStoryteller());
