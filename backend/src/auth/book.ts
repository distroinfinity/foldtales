import type { DatabaseSync } from 'node:sqlite';
import { Book, BookPut, ChapterState, DeviceLinkRequest, accountRoutes, BackendError, type StaleBookError } from '@tabletop/contracts';
import type { Hono } from 'hono';
import { currentDevice, currentUser } from '../guard.ts';

const RANK: Record<ChapterState, number> = { unread: 0, started: 1, finished: 2 };
const MAX_DEVICES_PER_USER = 50;

export interface BookStore {
  get(userId: string, now: Date): Book;
  /** The stored book after the write, or null when `baseRev` is stale. */
  put(userId: string, body: BookPut, now: Date): Book | null;
  link(userId: string, deviceId: string, label: string | null, now: Date): void;
  /** Everything an account owns outside Better Auth's own tables. */
  forget(userId: string): void;
}

/** One JSON book per account, and a record of the headsets that signed in. Same file and connection as the store. */
export function openBookStore(db: DatabaseSync): BookStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS book (user_id TEXT PRIMARY KEY, rev INTEGER NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS device_link (
      user_id TEXT NOT NULL, device_id TEXT NOT NULL, label TEXT, linked_at TEXT NOT NULL,
      PRIMARY KEY (user_id, device_id)
    );
  `);
  const read = db.prepare('SELECT rev, json, updated_at FROM book WHERE user_id = ?');
  const insert = db.prepare('INSERT INTO book (user_id, rev, json, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT (user_id) DO NOTHING');
  const update = db.prepare('UPDATE book SET rev = rev + 1, json = ?, updated_at = ? WHERE user_id = ? AND rev = ?');
  const upsertLink = db.prepare(
    `INSERT INTO device_link (user_id, device_id, label, linked_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, device_id) DO UPDATE SET label = COALESCE(excluded.label, device_link.label), linked_at = excluded.linked_at`,
  );
  const countLinks = db.prepare('SELECT COUNT(*) AS n FROM device_link WHERE user_id = ?');
  const dropOldestLink = db.prepare('DELETE FROM device_link WHERE rowid = (SELECT rowid FROM device_link WHERE user_id = ? ORDER BY linked_at LIMIT 1)');
  const removeBook = db.prepare('DELETE FROM book WHERE user_id = ?');
  const removeLinks = db.prepare('DELETE FROM device_link WHERE user_id = ?');

  const stored = (userId: string): Book | null => {
    const row = read.get(userId) as { rev: number; json: string; updated_at: string } | undefined;
    if (!row) return null;
    const { chapters, resume } = JSON.parse(row.json) as Pick<Book, 'chapters' | 'resume'>;
    return { chapters, resume, rev: Number(row.rev), updatedAt: row.updated_at };
  };

  return {
    get(userId, now) {
      return stored(userId) ?? { chapters: {}, resume: null, rev: 0, updatedAt: now.toISOString() };
    },

    put(userId, body, now) {
      const before = stored(userId);
      if ((before?.rev ?? 0) !== body.baseRev) return null;
      // The client merges, but the server still never lets a finished chapter go back.
      const chapters: Book['chapters'] = { ...before?.chapters };
      for (const [key, state] of Object.entries(body.chapters)) {
        if (RANK[state] >= RANK[chapters[key] ?? 'unread']) chapters[key] = state;
      }
      const json = JSON.stringify({ chapters, resume: body.resume });
      const at = now.toISOString();
      const changed = before ? update.run(json, at, userId, body.baseRev).changes : insert.run(userId, json, at).changes;
      return Number(changed) === 1 ? stored(userId) : null;
    },

    link(userId, deviceId, label, now) {
      upsertLink.run(userId, deviceId, label, now.toISOString());
      if (Number((countLinks.get(userId) as { n: number }).n) > MAX_DEVICES_PER_USER) dropOldestLink.run(userId);
    },

    forget(userId) {
      removeBook.run(userId);
      removeLinks.run(userId);
    },
  };
}

function signedIn(): { userId: string; deviceId: string } {
  const userId = currentUser();
  const deviceId = currentDevice();
  // The guard already refused these; this only keeps a mis-wired route from running as nobody.
  if (!userId || !deviceId) throw new BackendError('unauthorized', 'sign in to keep your book');
  return { userId, deviceId };
}

async function jsonBody(text: Promise<string>): Promise<unknown> {
  try {
    return JSON.parse(await text);
  } catch {
    throw new BackendError('bad_request', 'the body is not JSON');
  }
}

/** `/v1/me/*`. Mounted behind the contract and device checks; the guard sets the user from a valid session. */
export function mountBookRoutes(app: Hono, books: BookStore, now: () => Date): void {
  app.post(accountRoutes.linkDevice.path, async (c) => {
    const { userId, deviceId } = signedIn();
    const parsed = DeviceLinkRequest.safeParse(await jsonBody(c.req.text()));
    if (!parsed.success) throw new BackendError('bad_request', `the body does not match ${accountRoutes.linkDevice.path}`);
    books.link(userId, deviceId, parsed.data.label ?? null, now());
    return c.json({ linked: true });
  });

  app.get(accountRoutes.getBook.path, (c) => c.json(Book.parse(books.get(signedIn().userId, now()))));

  app.put(accountRoutes.putBook.path, async (c) => {
    const { userId } = signedIn();
    const parsed = BookPut.safeParse(await jsonBody(c.req.text()));
    if (!parsed.success) throw new BackendError('bad_request', `the body does not match ${accountRoutes.putBook.path}`);
    const book = books.put(userId, parsed.data, now());
    if (!book) {
      const stale: StaleBookError = { error: { code: 'stale_rev', retryable: true, message: 'the book changed since you read it' } };
      return c.json(stale, 409);
    }
    return c.json(book);
  });
}
