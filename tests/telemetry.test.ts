import { describe, expect, test, vi } from 'vitest';
import { BackendError, createHttpBackend, type BackendApi, type TelemetryBatch } from '../contracts/src/index.ts';
import { createMockBackend, fixtureLibrary, fixtureSpine } from '../contracts/src/mocks/index.ts';
import { createApp } from '../backend/src/app.ts';
import { guard, readCaps } from '../backend/src/guard.ts';
import { realRoutes } from '../backend/src/real-routes.ts';
import { openStore } from '../backend/src/store.ts';
import { aiOrAuthored } from '../client/src/ai-or-authored.ts';
import { createBackendAccess } from '../client/src/backend.ts';
import { createTelemetry } from '../client/src/telemetry.ts';

const clock = { nowIso: () => '2026-11-11T12:00:00.000Z' };
const ids = { buildId: 'b', sessionId: 's' };
const hitch = { kind: 'hitch', ms: 150, phase: 'x' } as const;

const memoryStorage = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

describe('telemetry', () => {
  test('a rejecting send is swallowed and nothing is requeued', async () => {
    const send = vi.fn().mockRejectedValue(new Error('down'));
    const telemetry = createTelemetry(send, clock, ids);
    telemetry.record(hitch);
    await telemetry.flush();
    await telemetry.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('a throwing send cannot reach the frame loop', async () => {
    const telemetry = createTelemetry(() => { throw new Error('boom'); }, clock, ids);
    telemetry.record(hitch);
    await expect(telemetry.flush()).resolves.toBeUndefined();
  });

  test('a send that never settles leaves one in flight and a bounded queue', () => {
    const send = vi.fn(() => new Promise<void>(() => undefined));
    const telemetry = createTelemetry(send, clock, ids);
    telemetry.record(hitch);
    void telemetry.flush();
    for (let i = 0; i < 2000; i++) telemetry.record(hitch);
    void telemetry.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(telemetry.queued()).toBe(500);
    expect(() => telemetry.frame(16, { calls: 1, triangles: 1 })).not.toThrow();
  });

  test('a batch never exceeds the contract, and the newest events are kept', async () => {
    const batches: TelemetryBatch[] = [];
    const telemetry = createTelemetry(async (b) => void batches.push(b), clock, ids);
    for (let i = 0; i < 600; i++) telemetry.record({ kind: 'hitch', ms: i, phase: 'x' });
    await telemetry.flush();
    expect(batches[0]!.events).toHaveLength(500);
    expect(batches[0]!.events.at(-1)).toMatchObject({ ms: 599 });
  });

  test('summarises fps every ten seconds and reports hitches', async () => {
    const batches: TelemetryBatch[] = [];
    const telemetry = createTelemetry(async (b) => void batches.push(b), clock, ids);
    for (let i = 0; i < 980; i++) telemetry.frame(10, { calls: 7, triangles: 40 });
    for (let i = 0; i < 10; i++) telemetry.frame(20, { calls: 7, triangles: 40 });
    telemetry.frame(120, { calls: 7, triangles: 40 });
    await telemetry.flush();
    const events = batches[0]!.events;
    expect(events.find((e) => e.kind === 'hitch')).toMatchObject({ ms: 120 });
    expect(events.find((e) => e.kind === 'frame_summary')).toMatchObject({ medianFps: 100, lowFps: 50, drawCalls: 7, triangles: 40 });
  });
});

describe('backend access', () => {
  function server() {
    const real = createMockBackend();
    let unauthorized = 0;
    const issue = vi.fn(async () => ({ deviceId: 'd', token: `t${issue.mock.calls.length}`, expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString() }));
    return { real, issue, setUnauthorized: (n: number) => { unauthorized = n; }, takeUnauthorized: () => (unauthorized > 0 ? (unauthorized--, true) : false) };
  }

  function access(s: ReturnType<typeof server>, storage = memoryStorage()) {
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/device')) {
        return new Response(JSON.stringify(await s.issue()), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (s.takeUnauthorized()) return new Response(JSON.stringify({ error: { code: 'unauthorized', retryable: false, message: 'no' } }), { status: 401 });
      void init;
      return new Response(JSON.stringify({ accepted: 0 }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    return createBackendAccess({ baseUrl: '', fetch: fetcher, storage, now: () => Date.now() });
  }

  const send = (api: BackendApi) => api.sendTelemetry({ v: 1, buildId: 'b', sessionId: 's', events: [] });

  test('an unauthorized reply renews exactly once', async () => {
    const s = server();
    const a = access(s);
    await a.withBackend(send);
    expect(s.issue).toHaveBeenCalledTimes(1);
    s.setUnauthorized(1);
    await expect(a.withBackend(send)).resolves.toEqual({ accepted: 0 });
    expect(s.issue).toHaveBeenCalledTimes(2);
  });

  test('a second unauthorized does not loop', async () => {
    const s = server();
    const a = access(s);
    await a.withBackend(send);
    s.setUnauthorized(5);
    await expect(a.withBackend(send)).rejects.toMatchObject({ code: 'unauthorized' });
    expect(s.issue).toHaveBeenCalledTimes(2);
  });

  test('overlapping callers and overlapping unauthorized replies make one request', async () => {
    const s = server();
    const a = access(s);
    await Promise.all([a.withBackend(send), a.withBackend(send), a.withBackend(send)]);
    expect(s.issue).toHaveBeenCalledTimes(1);
    s.setUnauthorized(3);
    await Promise.all([a.withBackend(send), a.withBackend(send), a.withBackend(send)]);
    expect(s.issue).toHaveBeenCalledTimes(2);
  });

  test('no backend means null, not an error', async () => {
    const a = createBackendAccess({
      baseUrl: '',
      fetch: (async () => { throw new TypeError('offline'); }) as typeof fetch,
      storage: memoryStorage(),
      now: () => Date.now(),
    });
    await expect(a.withBackend(send)).resolves.toBeNull();
  });

  test('broken storage does not break the stage', async () => {
    const s = server();
    const storage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => undefined };
    await expect(access(s, storage).withBackend(send)).resolves.toEqual({ accepted: 0 });
  });
});

describe('aiOrAuthored', () => {
  const authored = () => 'authored';

  test.each([
    [new BackendError('quota_exceeded', 'cap'), 'cap'],
    [new BackendError('upstream_failed', 'network failure: TypeError: offline', true), 'offline'],
    [new BackendError('upstream_failed', 'network failure: TimeoutError: slow', true), 'slow'],
    [new BackendError('invalid_output', 'bad'), 'failed'],
    [new Error('anything'), 'failed'],
  ] as Array<[Error, string]>)('%s becomes %s', async (error, reason) => {
    const onFallback = vi.fn();
    await expect(aiOrAuthored(() => Promise.reject(error), authored, onFallback)).resolves.toBe('authored');
    expect(onFallback).toHaveBeenCalledWith(reason);
  });

  test('success takes the AI answer', async () => {
    const onFallback = vi.fn();
    await expect(aiOrAuthored(async () => 'live', authored, onFallback)).resolves.toBe('live');
    expect(onFallback).not.toHaveBeenCalled();
  });

  test('a hit cap on the real backend falls back to authored', async () => {
    const store = openStore(':memory:');
    const now = () => new Date('2026-11-11T12:00:00.000Z');
    const app = createApp({ ...createMockBackend(), ...realRoutes(store, 'secret', now) }, () => undefined, {
      afterContract: [guard(store, { secret: 'secret', caps: { ...readCaps({}), global: 0 }, now })],
    });
    const fetcher = ((input: string | URL | Request, init?: RequestInit) => app.request(String(input), init)) as typeof fetch;
    const { token } = await createHttpBackend({ baseUrl: '', fetch: fetcher }).issueDevice({});
    const api = createHttpBackend({ baseUrl: '', token, fetch: fetcher });
    const onFallback = vi.fn();
    const beat = await aiOrAuthored<unknown>(
      () =>
        api.planBeat({
          episodeId: 'ep-1',
          spine: fixtureSpine(),
          library: fixtureLibrary(),
          objects: [],
          position: { sceneId: 'at-the-brook', cursor: 'ask', elapsedSeconds: 3 },
          show: { problems: [], holding: [], used: [] },
          canon: [],
          recent: [],
          trigger: { kind: 'lookahead' },
          usedLineIds: [],
          owedPlayers: [],
        }),
      () => 'the authored beat',
      onFallback,
    );
    expect(beat).toBe('the authored beat');
    expect(onFallback).toHaveBeenCalledWith('cap');
  });
});
