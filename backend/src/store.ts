import { DatabaseSync } from 'node:sqlite';
import { BackendError, type ShowEvent } from '@tabletop/contracts';

const MAX_ID_LENGTH = 128;
const MAX_EVENTS_PER_DEVICE = 20_000;
const READ_PAGE = 5_000;
const TELEMETRY_READ_LIMIT = 10_000;
const TELEMETRY_KEEP_MS = 14 * 24 * 60 * 60 * 1000;
const TELEMETRY_MAX_ROWS = 500_000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;

export interface TelemetryRow {
  receivedAt: string;
  deviceId: string;
  buildId: string;
  sessionId: string;
  event: unknown;
}

export interface Store {
  countUse(day: string, scope: string, feature: string): number;
  appendEvents(deviceId: string, seriesId: string, events: ShowEvent[]): number | null;
  readEvents(deviceId: string, seriesId: string, afterSeq: number | null): ShowEvent[];
  deleteSeries(deviceId: string, seriesId: string): number;
  addTelemetry(deviceId: string, buildId: string, sessionId: string, events: unknown[], now: Date): void;
  readTelemetry(sinceIso: string): TelemetryRow[];
  close(): void;
}

interface EventRow {
  json: string;
  seq: number;
  arrival: number;
}

export function openStore(path: string): Store {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS usage (day TEXT, scope TEXT, feature TEXT, count INTEGER NOT NULL, PRIMARY KEY (day, scope, feature));
    CREATE TABLE IF NOT EXISTS events (
      arrival INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL, series_id TEXT NOT NULL, event_id TEXT NOT NULL, seq INTEGER, json TEXT NOT NULL,
      UNIQUE (device_id, series_id, event_id)
    );
    CREATE INDEX IF NOT EXISTS events_read ON events (device_id, series_id, seq, arrival);
    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      received_at TEXT NOT NULL, device_id TEXT NOT NULL, build_id TEXT NOT NULL, session_id TEXT NOT NULL, json TEXT NOT NULL
    );
  `);

  const useCount = db.prepare(
    `INSERT INTO usage (day, scope, feature, count) VALUES (?, ?, ?, 1)
     ON CONFLICT (day, scope, feature) DO UPDATE SET count = count + 1 RETURNING count`,
  );
  const pruneUsage = db.prepare('DELETE FROM usage WHERE day < ?');
  const deviceEvents = db.prepare('SELECT COUNT(*) AS n FROM events WHERE device_id = ?');
  const insertEvent = db.prepare('INSERT OR IGNORE INTO events (device_id, series_id, event_id, seq, json) VALUES (?, ?, ?, ?, ?)');
  const lastSeq = db.prepare('SELECT MAX(seq) AS last FROM events WHERE device_id = ? AND series_id = ?');
  const page = db.prepare('SELECT json, seq, arrival FROM events WHERE device_id = ? AND series_id = ? AND seq > ? ORDER BY seq, arrival LIMIT ?');
  const ties = db.prepare('SELECT json, seq, arrival FROM events WHERE device_id = ? AND series_id = ? AND seq = ? AND arrival > ? ORDER BY arrival');
  const removeSeries = db.prepare('DELETE FROM events WHERE device_id = ? AND series_id = ?');
  const insertTelemetry = db.prepare('INSERT INTO telemetry (received_at, device_id, build_id, session_id, json) VALUES (?, ?, ?, ?, ?)');
  const pruneOld = db.prepare('DELETE FROM telemetry WHERE received_at < ?');
  const pruneOver = db.prepare('DELETE FROM telemetry WHERE id <= (SELECT MAX(id) FROM telemetry) - ?');
  const readRows = db.prepare('SELECT received_at, device_id, build_id, session_id, json FROM telemetry WHERE received_at >= ? ORDER BY id LIMIT ?');

  let usageDay = '';
  let prunedAtMs = 0;

  function transaction<T>(work: () => T): T {
    db.exec('BEGIN');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (cause) {
      db.exec('ROLLBACK');
      throw cause;
    }
  }

  return {
    countUse(day, scope, feature) {
      if (day !== usageDay) {
        usageDay = day;
        pruneUsage.run(day);
      }
      return Number((useCount.get(day, scope, feature) as { count: number }).count);
    },

    appendEvents(deviceId, seriesId, events) {
      return transaction(() => {
        const held = Number((deviceEvents.get(deviceId) as { n: number }).n);
        // A resend keeps the original, so events are identified by id, not seq. Only new ones count against
        // the limit, so a retry of stored events still succeeds; going over rolls the whole batch back.
        let added = 0;
        for (const event of events) added += Number(insertEvent.run(deviceId, seriesId, event.id, event.seq, JSON.stringify(event)).changes);
        if (held + added > MAX_EVENTS_PER_DEVICE) throw new BackendError('quota_exceeded', 'this device has stored too many events');
        const { last } = lastSeq.get(deviceId, seriesId) as { last: number | null };
        return last;
      });
    },

    readEvents(deviceId, seriesId, afterSeq) {
      const rows = page.all(deviceId, seriesId, afterSeq ?? -1, READ_PAGE) as unknown as EventRow[];
      const last = rows.at(-1);
      // Paging is by seq, so a page must never end partway through a tie.
      const rest = last ? (ties.all(deviceId, seriesId, last.seq, last.arrival) as unknown as EventRow[]) : [];
      return [...rows, ...rest].map((row) => JSON.parse(row.json) as ShowEvent);
    },

    deleteSeries(deviceId, seriesId) {
      return Number(removeSeries.run(deviceId, seriesId).changes);
    },

    addTelemetry(deviceId, buildId, sessionId, events, now) {
      const receivedAt = now.toISOString();
      // Stored on every row, so a huge id would multiply one request many times over.
      buildId = buildId.slice(0, MAX_ID_LENGTH);
      sessionId = sessionId.slice(0, MAX_ID_LENGTH);
      transaction(() => {
        for (const event of events) insertTelemetry.run(receivedAt, deviceId, buildId, sessionId, JSON.stringify(event));
        if (now.getTime() - prunedAtMs >= PRUNE_EVERY_MS) {
          prunedAtMs = now.getTime();
          pruneOld.run(new Date(now.getTime() - TELEMETRY_KEEP_MS).toISOString());
          pruneOver.run(TELEMETRY_MAX_ROWS);
        }
      });
    },

    readTelemetry(sinceIso) {
      const rows = readRows.all(sinceIso, TELEMETRY_READ_LIMIT) as unknown as Array<Record<string, string>>;
      return rows.map((row) => ({
        receivedAt: row.received_at!,
        deviceId: row.device_id!,
        buildId: row.build_id!,
        sessionId: row.session_id!,
        event: JSON.parse(row.json!) as unknown,
      }));
    },

    close() {
      db.close();
    },
  };
}
