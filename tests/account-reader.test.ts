import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Lane B's asks from Codex's review of #24 (findings 2, 3 and 6), through the account's real
 * functions: an identity reset clears every chapter key (`tt.chapters`, `tt.progress`, every
 * `tt.checkpoint…`), and the book syncs through lane B's adapters, so a direct chapter 3 start
 * never claims 1 and 2, and a completion on another headset reaches this one.
 */

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  keys() {
    return [...this.map.keys()];
  }
}

let store: MemoryStorage;
/** The server's side: one book, and the auth routes the account calls. */
let serverBook: { chapters: Record<string, string>; resume: null; rev: number; updatedAt: string };

beforeEach(() => {
  store = new MemoryStorage();
  serverBook = { chapters: {}, resume: null, rev: 0, updatedAt: '2026-11-16T00:00:00.000Z' };
  vi.stubGlobal('localStorage', store);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
      if (url.endsWith('/v1/device')) return json({ deviceId: 'd1', token: 'device-token', expiresAt: new Date(Date.now() + 864e5).toISOString() });
      if (url.endsWith('/v1/me/book') && (init?.method ?? 'GET') === 'GET') return json(serverBook);
      if (url.endsWith('/v1/me/book') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as { chapters: Record<string, string> };
        serverBook = { ...serverBook, chapters: body.chapters, rev: serverBook.rev + 1, updatedAt: new Date().toISOString() };
        return json(serverBook);
      }
      if (url.endsWith('/v1/auth/sign-out') || url.endsWith('/v1/auth/delete-user')) return json({ success: true });
      return json({}, 404);
    }),
  );
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const account = () => import('../client/src/account/index.ts');
const progress = () => import('../client/src/show/progress.ts');

/** A signed-in reader on this headset, with chapters 1 and 2 done, a place in 3, and a cached shelf. */
async function signedInWithChapters(): Promise<void> {
  const { writeLocalChapters } = await progress();
  store.setItem('tt.session', 'session-token');
  store.setItem('tt.session.user', JSON.stringify({ id: 'ann', name: 'Ann', email: 'ann@example.com' }));
  writeLocalChapters(store, 'flagship-1', { chapters: { '1': 'finished', '2': 'finished', '3': 'started' }, resume: null, updatedAt: '2026-11-16T10:00:00.000Z' });
  store.setItem('tt.checkpoint', JSON.stringify({ v: 2, episodeId: 'chapter-3' }));
  store.setItem('tt.checkpoint.chapter-3', '{"v":2}');
  store.setItem('tt.checkpoint.chapter-2', '{"v":2}');
  store.setItem('tt.storyteller.shelf.ann', '[]');
}

const leftovers = () => store.keys().filter((k) => /^tt\.(chapters|progress|checkpoint|storyteller\.|session|user)/.test(k));

describe('the identity reset clears every chapter key', () => {
  test('sign-out: nothing of the reader is left, and a reload reads a fresh, empty book', async () => {
    await signedInWithChapters();
    expect(store.keys()).toEqual(expect.arrayContaining(['tt.chapters', 'tt.checkpoint.chapter-3']));
    const { signOut } = await account();
    expect(await signOut()).toBe('ok');
    expect(leftovers()).toEqual([]);
    // The page reloads as a new reader: a fresh module, the same storage.
    vi.resetModules();
    const fresh = await account();
    expect(fresh.readLocalBook().chapters).toEqual({});
    expect(fresh.cachedReader()).toBeNull();
  });

  test('deletion: the same', async () => {
    await signedInWithChapters();
    const { deleteAccount } = await account();
    expect(await deleteAccount()).toBe('ok');
    expect(leftovers()).toEqual([]);
    vi.resetModules();
    expect((await account()).readLocalBook().chapters).toEqual({});
  });
});

describe("the book syncs through lane B's adapters", () => {
  test('a direct start of chapter 3 is read as just that: 1 and 2 are never claimed', async () => {
    const { writeLocalChapters } = await progress();
    writeLocalChapters(store, 'flagship-1', { chapters: { '3': 'started' }, resume: null, updatedAt: '2026-11-16T10:00:00.000Z' });
    const { readLocalBook } = await account();
    expect(readLocalBook().chapters).toEqual({ '3': 'started' });
  });

  test('a chapter finished on another headset reaches this one after a sync', async () => {
    store.setItem('tt.session', 'session-token');
    store.setItem('tt.session.user', JSON.stringify({ id: 'ann', name: 'Ann', email: 'ann@example.com' }));
    const { writeLocalChapters, readChapterStates } = await progress();
    writeLocalChapters(store, 'flagship-1', { chapters: { '1': 'started' }, resume: null, updatedAt: '2026-11-16T10:00:00.000Z' });
    serverBook = { chapters: { '1': 'finished', '2': 'finished' }, resume: null, rev: 3, updatedAt: '2026-11-16T12:00:00.000Z' };
    const { readLocalBook, syncBook, writeLocalBook } = await account();
    writeLocalBook(await syncBook(readLocalBook()));
    const states = readChapterStates(store, 'flagship-1').states;
    expect(states.get(1)).toBe('finished');
    expect(states.get(2)).toBe('finished');
  });
});
