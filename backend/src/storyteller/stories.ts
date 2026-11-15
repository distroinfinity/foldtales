import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  BackendError,
  NO_STORY,
  PAINTINGS_USED,
  STORIES_TODAY_USED,
  STORY_OVER,
  STORYTELLER_RESTING,
  type EndReason,
  type StartStoryResponse,
  type StoryPage,
  type StoryRecord,
  type StorytellerAvailability,
} from '@tabletop/contracts';

/**
 * The AI Storyteller's records, in the store's own SQLite file and connection. The backend owns a
 * story's identity, counts, title, plan and saved page, so no cap depends on the client:
 *
 * - a story is reserved in one write against the reader's and everyone's daily count;
 * - a turn id is claimed once per story; a repeat or a concurrent copy is told to recover;
 * - a painting is identified by (story, object), and its credits come from one lifetime pool;
 * - every paid call reserves an estimate in a daily spend ledger first (`reserveSpend`).
 *
 * node:sqlite is synchronous on one connection, so each method below runs without interleaving.
 * The spend ledger and the credit pool are anonymous aggregates: deleting a reader keeps them.
 */

export interface StoryLimits {
  storiesPerReaderDay: number;
  storiesPerDay: number;
  turnsPerStory: number;
  paintsPerStory: number;
  paintsPerReaderDay: number;
  /** Live painting credits in all, for the life of the service. */
  paintCreditCap: number;
  speechTokensPerReaderDay: number;
  /** A story still active this long after it began is ended (its title stays on the shelf). */
  staleMinutes: number;
  /** Daily ceilings per kind of paid work, in that kind's units. */
  spend: Record<SpendKind, number>;
}

/** Claude tokens; voice characters; speech-to-text tokens (one per hold). */
export type SpendKind = 'claude' | 'tts' | 'stt';

/** Conservative reservations per call, reconciled to the real usage afterwards. */
export const SPEND_ESTIMATE = {
  /** A story turn: the cached rules, the stage, 40 lines of history, and up to 1,500 tokens out. */
  turn: 10_000,
  /** One generated line, title or summary checked before it's heard or saved. */
  checkLine: 800,
  /** What the reader said, checked. */
  checkInput: 600,
  /** Naming a painting. */
  name: 1_500,
  /** Looking at a finished painting. */
  vision: 3_000,
} as const;

export const CREDITS_PER_PAINTING = 2;

const N = (name: string, fallback: number, env: Record<string, string | undefined>): number => {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a whole number, zero or more`);
  return value;
};

/**
 * The owner's numbers (Nov 15): 3 stories a reader a day, 150 for everyone, 40 turns, 6 and 12
 * paintings, 100 painting credits in all. The spend ceilings follow from them: 150 stories of 40
 * turns, each with its line checks; 6 lines of 150 characters a turn; 60 holds of the tab a story.
 */
export function readStoryLimits(env: Record<string, string | undefined>): StoryLimits {
  const storiesPerDay = N('STORIES_PER_DAY', 150, env);
  const turnsPerStory = N('TURNS_PER_STORY', 40, env);
  return {
    storiesPerReaderDay: N('STORIES_PER_READER_DAY', 3, env),
    storiesPerDay,
    turnsPerStory,
    paintsPerStory: N('PAINTS_PER_STORY', 6, env),
    paintsPerReaderDay: N('PAINTS_PER_READER_DAY', 12, env),
    paintCreditCap: N('PAINT_CREDIT_CAP', 100, env),
    speechTokensPerReaderDay: N('SPEECH_TOKENS_PER_READER_DAY', 150, env),
    staleMinutes: N('STORY_STALE_MINUTES', 60, env),
    spend: {
      claude: N('SPEND_CLAUDE_TOKENS_DAY', storiesPerDay * turnsPerStory * (SPEND_ESTIMATE.turn + 7 * SPEND_ESTIMATE.checkLine), env),
      tts: N('SPEND_TTS_CHARS_DAY', storiesPerDay * turnsPerStory * 6 * 150, env),
      stt: N('SPEND_STT_TOKENS_DAY', storiesPerDay * 60, env),
    },
  };
}

/** A reservation of paid work, settled once the call's real usage is known. */
export interface Reservation {
  day: string;
  kind: SpendKind;
  units: number;
}

export interface StoryRow {
  id: string;
  userId: string;
  status: 'active' | 'ended';
  turns: number;
  paints: number;
  title: string | null;
  plan: string | null;
  startedAt: string;
}

export interface Stories {
  availability(userId: string): StorytellerAvailability;
  start(userId: string, requestId: string): StartStoryResponse;
  /** The reader's own story, or null. */
  get(userId: string, storyId: string): StoryRow | null;
  /** Claims a turn id: 'run' the first time, 'recover' for a repeat or a copy in flight. Refuses past the turn limit. */
  claimTurn(userId: string, storyId: string, turnId: string): 'run' | 'recover';
  /** The story's checked title and its private plan. */
  setTitle(storyId: string, title: string, plan: string | null): void;
  setPlan(storyId: string, plan: string): void;
  /** Ends the story with its checked page. Idempotent: a second call returns the saved record. */
  end(userId: string, storyId: string, reason: EndReason, page: StoryPage): StoryRecord;
  list(userId: string): StoryRecord[];
  /** The last few finished stories' titles and summaries, for the welcome. */
  recent(userId: string, n: number): Array<{ title: string; summary: string | null }>;
  /** A painting for (story, object): the existing job, or a new one with its credits reserved. */
  claimPaint(userId: string, storyId: string, objectId: string): { jobId: string; fresh: boolean };
  /** Runway never took the job: its credits go back to the pool, and the story's count too. */
  refundPaint(jobId: string): void;
  /** The finished painting's name, so a saved page only names things that really arrived. */
  paintArrived(jobId: string, name: string): void;
  paintOwner(jobId: string): string | null;
  /** Whether the reader has a story in progress (speech tokens need one), counting the token. */
  claimSpeechToken(userId: string): void;
  reserveSpend(kind: SpendKind, units: number): Reservation | null;
  settleSpend(reservation: Reservation, actualUnits: number | null): void;
  /** Everything a reader owns here. Aggregates (spend, the credit pool) stay. */
  forget(userId: string): void;
}

const dayOf = (at: Date): string => at.toISOString().slice(0, 10);
const nextMidnight = (at: Date): string => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1)).toISOString();
const UNTITLED = "Tonight's story";

export function openStories(db: DatabaseSync, limits: StoryLimits, now: () => Date = () => new Date(), killed: () => boolean = () => false): Stories {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, request_id TEXT NOT NULL, day TEXT NOT NULL,
      status TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT, updated_at TEXT NOT NULL, end_reason TEXT,
      turns INTEGER NOT NULL DEFAULT 0, paints INTEGER NOT NULL DEFAULT 0,
      title TEXT, plan TEXT, summary TEXT, things TEXT,
      UNIQUE (user_id, request_id)
    );
    CREATE INDEX IF NOT EXISTS stories_by_user ON stories (user_id, started_at);
    CREATE INDEX IF NOT EXISTS stories_by_day ON stories (day);
    CREATE TABLE IF NOT EXISTS story_turns (story_id TEXT NOT NULL, turn_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (story_id, turn_id));
    CREATE TABLE IF NOT EXISTS paint_jobs (
      job_id TEXT PRIMARY KEY, story_id TEXT NOT NULL, object_id TEXT NOT NULL, user_id TEXT NOT NULL, day TEXT NOT NULL,
      status TEXT NOT NULL, name TEXT, UNIQUE (story_id, object_id)
    );
    CREATE TABLE IF NOT EXISTS speech_tokens (user_id TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (user_id, day));
    CREATE TABLE IF NOT EXISTS credit_pool (pool TEXT PRIMARY KEY, reserved INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS spend (day TEXT NOT NULL, kind TEXT NOT NULL, reserved INTEGER NOT NULL, PRIMARY KEY (day, kind));
  `);

  const q = {
    countReader: db.prepare('SELECT COUNT(*) AS n FROM stories WHERE user_id = ? AND day = ?'),
    countDay: db.prepare('SELECT COUNT(*) AS n FROM stories WHERE day = ?'),
    byRequest: db.prepare('SELECT id FROM stories WHERE user_id = ? AND request_id = ?'),
    insert: db.prepare("INSERT INTO stories (id, user_id, request_id, day, status, started_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)"),
    get: db.prepare('SELECT id, user_id, status, turns, paints, title, plan, started_at FROM stories WHERE id = ? AND user_id = ?'),
    full: db.prepare('SELECT * FROM stories WHERE id = ? AND user_id = ?'),
    stale: db.prepare("UPDATE stories SET status = 'ended', ended_at = ?, updated_at = ?, end_reason = 'left' WHERE status = 'active' AND started_at < ?"),
    claimTurn: db.prepare('INSERT OR IGNORE INTO story_turns (story_id, turn_id, user_id) VALUES (?, ?, ?)'),
    bumpTurns: db.prepare('UPDATE stories SET turns = turns + 1, updated_at = ? WHERE id = ?'),
    setTitle: db.prepare('UPDATE stories SET title = ?, plan = COALESCE(?, plan), updated_at = ? WHERE id = ?'),
    setPlan: db.prepare('UPDATE stories SET plan = ?, updated_at = ? WHERE id = ?'),
    end: db.prepare("UPDATE stories SET status = 'ended', ended_at = ?, updated_at = ?, end_reason = ?, title = ?, summary = ?, things = ? WHERE id = ? AND status = 'active'"),
    list: db.prepare("SELECT * FROM stories WHERE user_id = ? AND title IS NOT NULL ORDER BY started_at DESC LIMIT 30"),
    recent: db.prepare("SELECT title, summary FROM stories WHERE user_id = ? AND status = 'ended' AND title IS NOT NULL ORDER BY started_at DESC LIMIT ?"),
    hasActive: db.prepare("SELECT 1 FROM stories WHERE user_id = ? AND status = 'active' LIMIT 1"),
    jobFor: db.prepare('SELECT job_id FROM paint_jobs WHERE story_id = ? AND object_id = ?'),
    jobsReaderDay: db.prepare("SELECT COUNT(*) AS n FROM paint_jobs WHERE user_id = ? AND day = ? AND status != 'refunded'"),
    insertJob: db.prepare("INSERT INTO paint_jobs (job_id, story_id, object_id, user_id, day, status) VALUES (?, ?, ?, ?, ?, 'pending')"),
    bumpPaints: db.prepare('UPDATE stories SET paints = paints + ? WHERE id = ?'),
    job: db.prepare('SELECT job_id, story_id, user_id, status FROM paint_jobs WHERE job_id = ?'),
    jobStatus: db.prepare('UPDATE paint_jobs SET status = ?, name = COALESCE(?, name) WHERE job_id = ?'),
    arrivedNames: db.prepare("SELECT name FROM paint_jobs WHERE story_id = ? AND status = 'arrived' AND name IS NOT NULL"),
    pool: db.prepare("SELECT reserved FROM credit_pool WHERE pool = 'live'"),
    poolAdd: db.prepare("INSERT INTO credit_pool (pool, reserved) VALUES ('live', ?) ON CONFLICT (pool) DO UPDATE SET reserved = reserved + excluded.reserved"),
    tokens: db.prepare('SELECT count FROM speech_tokens WHERE user_id = ? AND day = ?'),
    tokenAdd: db.prepare('INSERT INTO speech_tokens (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT (user_id, day) DO UPDATE SET count = count + 1'),
    spent: db.prepare('SELECT reserved FROM spend WHERE day = ? AND kind = ?'),
    spendAdd: db.prepare('INSERT INTO spend (day, kind, reserved) VALUES (?, ?, ?) ON CONFLICT (day, kind) DO UPDATE SET reserved = MAX(0, reserved + excluded.reserved)'),
    forgetStories: db.prepare('DELETE FROM stories WHERE user_id = ?'),
    forgetTurns: db.prepare('DELETE FROM story_turns WHERE user_id = ?'),
    forgetJobs: db.prepare('DELETE FROM paint_jobs WHERE user_id = ?'),
    forgetTokens: db.prepare('DELETE FROM speech_tokens WHERE user_id = ?'),
  };

  const n = (row: unknown): number => Number((row as { n: number } | undefined)?.n ?? 0);

  function savepoint<T>(work: () => T): T {
    db.exec('SAVEPOINT stories');
    try {
      const result = work();
      db.exec('RELEASE stories');
      return result;
    } catch (cause) {
      db.exec('ROLLBACK TO stories');
      db.exec('RELEASE stories');
      throw cause;
    }
  }

  /** Ends stories left active too long, so the shelf and speech tokens don't wait on a headset that left. */
  const expire = (at: Date): void => {
    const cutoff = new Date(at.getTime() - limits.staleMinutes * 60_000).toISOString();
    q.stale.run(at.toISOString(), at.toISOString(), cutoff);
  };

  const spentToday = (kind: SpendKind, day: string): number => Number((q.spent.get(day, kind) as { reserved: number } | undefined)?.reserved ?? 0);
  /** A new story needs room for at least one full turn of every kind of spend. */
  const spendExhausted = (day: string): boolean =>
    spentToday('claude', day) + SPEND_ESTIMATE.turn + 7 * SPEND_ESTIMATE.checkLine > limits.spend.claude ||
    spentToday('tts', day) + 6 * 150 > limits.spend.tts;

  function availabilityAt(userId: string, at: Date): StorytellerAvailability {
    const day = dayOf(at);
    const resetsAt = nextMidnight(at);
    if (killed() || n(q.countDay.get(day)) >= limits.storiesPerDay || spendExhausted(day)) return { status: 'resting', storiesLeftToday: 0, resetsAt };
    const left = Math.max(0, limits.storiesPerReaderDay - n(q.countReader.get(userId, day)));
    return { status: left > 0 ? 'ready' : 'used-today', storiesLeftToday: left, resetsAt };
  }

  function rowOf(raw: unknown): StoryRow {
    const r = raw as { id: string; user_id: string; status: 'active' | 'ended'; turns: number; paints: number; title: string | null; plan: string | null; started_at: string };
    return { id: r.id, userId: r.user_id, status: r.status, turns: Number(r.turns), paints: Number(r.paints), title: r.title, plan: r.plan, startedAt: r.started_at };
  }

  function recordOf(raw: unknown): StoryRecord {
    const r = raw as { id: string; title: string | null; summary: string | null; things: string | null; started_at: string; ended_at: string | null; updated_at: string };
    return {
      id: r.id,
      title: r.title ?? UNTITLED,
      summary: r.summary,
      things: r.things ? (JSON.parse(r.things) as string[]) : [],
      startedAt: r.started_at,
      endedAt: r.ended_at,
      updatedAt: r.updated_at,
    };
  }

  function owned(userId: string, storyId: string): StoryRow {
    const raw = q.get.get(storyId, userId);
    if (!raw) throw new BackendError('bad_request', NO_STORY);
    return rowOf(raw);
  }

  return {
    availability(userId) {
      const at = now();
      expire(at);
      return availabilityAt(userId, at);
    },

    start(userId, requestId) {
      return savepoint(() => {
        const at = now();
        expire(at);
        const known = q.byRequest.get(userId, requestId) as { id: string } | undefined;
        let storyId = known?.id;
        if (!storyId) {
          const before = availabilityAt(userId, at);
          if (before.status === 'resting') throw new BackendError('upstream_failed', STORYTELLER_RESTING, false);
          if (before.status === 'used-today') throw new BackendError('quota_exceeded', STORIES_TODAY_USED);
          storyId = `st-${randomUUID()}`;
          q.insert.run(storyId, userId, requestId, dayOf(at), at.toISOString(), at.toISOString());
        }
        const row = owned(userId, storyId);
        return {
          storyId,
          allowance: { turns: Math.max(0, limits.turnsPerStory - row.turns), paintings: Math.max(0, limits.paintsPerStory - row.paints) },
          availability: availabilityAt(userId, at),
        };
      });
    },

    get(userId, storyId) {
      const raw = q.get.get(storyId, userId);
      return raw ? rowOf(raw) : null;
    },

    claimTurn(userId, storyId, turnId) {
      return savepoint(() => {
        const row = owned(userId, storyId);
        if (row.status !== 'active') throw new BackendError('quota_exceeded', STORY_OVER);
        // A repeat is told to recover before the limit is checked, so a retried last turn recovers.
        const claimed = q.claimTurn.run(storyId, turnId, userId).changes === 1;
        if (!claimed) return 'recover';
        if (row.turns >= limits.turnsPerStory) throw new BackendError('quota_exceeded', STORY_OVER);
        q.bumpTurns.run(now().toISOString(), storyId);
        return 'run';
      });
    },

    setTitle(storyId, title, plan) {
      q.setTitle.run(title, plan, now().toISOString(), storyId);
    },

    setPlan(storyId, plan) {
      q.setPlan.run(plan, now().toISOString(), storyId);
    },

    end(userId, storyId, reason, page) {
      return savepoint(() => {
        const row = owned(userId, storyId);
        if (row.status === 'active') {
          // Only things painted for this story that really arrived are named on its page.
          const arrived = new Set((q.arrivedNames.all(storyId) as Array<{ name: string }>).map((r) => r.name));
          const things = page.things.filter((t) => arrived.has(t)).slice(0, 12);
          const at = now().toISOString();
          q.end.run(at, at, reason, page.title, page.summary, JSON.stringify(things), storyId);
        }
        return recordOf(q.full.get(storyId, userId));
      });
    },

    list(userId) {
      expire(now());
      return (q.list.all(userId) as unknown[]).map(recordOf);
    },

    recent(userId, count) {
      return (q.recent.all(userId, count) as Array<{ title: string; summary: string | null }>).map((r) => ({ title: r.title, summary: r.summary }));
    },

    claimPaint(userId, storyId, objectId) {
      return savepoint(() => {
        const row = owned(userId, storyId);
        const known = q.jobFor.get(storyId, objectId) as { job_id: string } | undefined;
        if (known) return { jobId: known.job_id, fresh: false };
        if (row.status !== 'active') throw new BackendError('quota_exceeded', STORY_OVER);
        const day = dayOf(now());
        const pool = Number((q.pool.get() as { reserved: number } | undefined)?.reserved ?? 0);
        if (row.paints >= limits.paintsPerStory || n(q.jobsReaderDay.get(userId, day)) >= limits.paintsPerReaderDay || pool + CREDITS_PER_PAINTING > limits.paintCreditCap) {
          throw new BackendError('quota_exceeded', PAINTINGS_USED);
        }
        const jobId = `paint-${randomUUID()}`;
        q.insertJob.run(jobId, storyId, objectId, userId, day);
        q.bumpPaints.run(1, storyId);
        q.poolAdd.run(CREDITS_PER_PAINTING);
        return { jobId, fresh: true };
      });
    },

    refundPaint(jobId) {
      savepoint(() => {
        const job = q.job.get(jobId) as { story_id: string; status: string } | undefined;
        if (!job || job.status !== 'pending') return;
        q.jobStatus.run('refunded', null, jobId);
        q.bumpPaints.run(-1, job.story_id);
        q.poolAdd.run(-CREDITS_PER_PAINTING);
      });
    },

    paintArrived(jobId, name) {
      q.jobStatus.run('arrived', name, jobId);
    },

    paintOwner(jobId) {
      return (q.job.get(jobId) as { user_id: string } | undefined)?.user_id ?? null;
    },

    claimSpeechToken(userId) {
      savepoint(() => {
        expire(now());
        if (!q.hasActive.get(userId)) throw new BackendError('bad_request', NO_STORY);
        const day = dayOf(now());
        const used = Number((q.tokens.get(userId, day) as { count: number } | undefined)?.count ?? 0);
        if (used >= limits.speechTokensPerReaderDay) throw new BackendError('quota_exceeded', 'listening has reached its daily limit');
        q.tokenAdd.run(userId, day);
      });
    },

    reserveSpend(kind, units) {
      const day = dayOf(now());
      if (spentToday(kind, day) + units > limits.spend[kind]) return null;
      q.spendAdd.run(day, kind, units);
      return { day, kind, units };
    },

    settleSpend(reservation, actualUnits) {
      // Unknown usage (a failure or a timeout) keeps the whole reservation: uncertain charges count.
      if (actualUnits === null) return;
      q.spendAdd.run(reservation.day, reservation.kind, actualUnits - reservation.units);
    },

    forget(userId) {
      savepoint(() => {
        q.forgetTurns.run(userId);
        q.forgetJobs.run(userId);
        q.forgetTokens.run(userId);
        q.forgetStories.run(userId);
      });
    },
  };
}
