import { BackendError, CONTRACT_HEADER, CONTRACT_VERSION, createHttpBackend, type ReplyChunk, type ShowEvent } from '@tabletop/contracts';
import { createMockBackend, fixtureLibrary } from '@tabletop/contracts/mocks';
import { describe, expect, test } from 'vitest';
import { createApp } from '../src/app.ts';
import { guard, readCaps, type Caps } from '../src/guard.ts';
import { realRoutes } from '../src/real-routes.ts';
import { openStore } from '../src/store.ts';
import { issueToken } from '../src/tokens.ts';
import { adminTelemetry, browserAccess, isAllowedOrigin } from '../src/web.ts';

const SECRET = 'test-secret';
const HOST = 'tabletop-theater.pages.dev';
const NOON = new Date('2026-11-11T12:00:00.000Z');

function harness(capOverrides: Partial<Caps> = {}, adminToken?: string) {
  const store = openStore(':memory:');
  const clock = { now: NOON };
  const now = () => clock.now;
  const app = createApp({ ...createMockBackend(), ...realRoutes(store, SECRET, now) }, () => undefined, {
    beforeContract: browserAccess(HOST),
    afterContract: [guard(store, { secret: SECRET, caps: { ...readCaps({}), ...capOverrides }, now })],
    extend: adminTelemetry(store, adminToken),
  });
  const fetcher = (address = '198.51.100.7'): typeof fetch =>
    ((input: string | URL | Request, init?: RequestInit) =>
      app.request(String(input), { ...init, headers: { ...(init?.headers as Record<string, string>), 'x-real-ip': address } })) as typeof fetch;
  const api = (token?: string, address?: string) => createHttpBackend({ baseUrl: '', token, fetch: fetcher(address) });
  const device = async (address?: string) => {
    const issued = await api(undefined, address).issueDevice({});
    return { ...issued, api: api(issued.token, address) };
  };
  return { app, store, clock, api, device };
}

const codeOf = async (call: Promise<unknown>): Promise<string> =>
  call.then(
    () => 'ok',
    (cause: unknown) => (cause as BackendError).code,
  );

async function collect(stream: AsyncIterable<ReplyChunk>): Promise<ReplyChunk[]> {
  const chunks: ReplyChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

const line = { speaker: 'someone', text: 'hello', mood: 'neutral' } as const;
const replyRequest = { castId: 'bramble', playerId: 'ann', heard: 'hi', sceneSummary: 'A brook', library: fixtureLibrary(), objects: [], canon: [], recent: [] };
const event = (id: string, seq: number | null, seriesId = 's'): ShowEvent =>
  ({ v: 1, id, seq, seriesId, episodeId: null, actor: { kind: 'app' }, showMs: 0, at: NOON.toISOString(), type: 'session.resumed', data: {} }) as ShowEvent;

describe('tokens', () => {
  test('an AI route needs a valid token', async () => {
    const { api, device } = harness();
    const { token } = await device();
    expect(await codeOf(api().speechToken({}))).toBe('unauthorized');
    expect(await codeOf(api(`${token}x`).speechToken({}))).toBe('unauthorized');
    expect(await codeOf(api(token).speechToken({}))).toBe('ok');
  });

  test('an expired token is refused', async () => {
    const { api, clock, device } = harness();
    const { token } = await device();
    clock.now = new Date(NOON.getTime() + 31 * 86_400_000);
    expect(await codeOf(api(token).speechToken({}))).toBe('unauthorized');
  });

  test('renewing, even expired, keeps the device and its memory', async () => {
    const { api, clock, device } = harness();
    const first = await device();
    await first.api.memoryAppend({ seriesId: 's', events: [event('a', 1)] });
    clock.now = new Date(NOON.getTime() + 31 * 86_400_000);
    const renewed = await api(first.token).issueDevice({});
    expect(renewed.deviceId).toBe(first.deviceId);
    const { events } = await api(renewed.token).memoryRead({ seriesId: 's', afterSeq: null });
    expect(events.map((e) => e.id)).toEqual(['a']);
  });

  test('a forged bearer gets a new identity, never the one it claims', async () => {
    const { api, device } = harness();
    const first = await device();
    const forged = issueToken('wrong-secret', NOON, first.deviceId).token;
    expect((await api(forged).issueDevice({})).deviceId).not.toBe(first.deviceId);
  });
});

describe('new identities', () => {
  test('are throttled per address, and renewals are free', async () => {
    const { api, device } = harness({ identitiesPerAddress: 2 });
    const first = await device();
    await device();
    expect(await codeOf(api().issueDevice({}))).toBe('quota_exceeded');
    expect(await codeOf(api(first.token).issueDevice({}))).toBe('ok');
    expect(await codeOf(api(undefined, '203.0.113.9').issueDevice({}))).toBe('ok');
  });

  test('are capped overall', async () => {
    const { api, device } = harness({ devices: 1 });
    await device();
    expect(await codeOf(api(undefined, '203.0.113.9').issueDevice({}))).toBe('quota_exceeded');
  });
});

describe('browser access', () => {
  const headers = 'content-type,authorization,' + CONTRACT_HEADER;
  const preflight = (app: ReturnType<typeof harness>['app'], origin: string) =>
    app.request('/v1/speech/token', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': headers } });

  test('a full preflight then the authenticated POST works from a preview', async () => {
    const { app, device } = harness();
    const { token } = await device();
    const origin = `https://my-branch.${HOST}`;
    const answer = await preflight(app, origin);
    expect(answer.status).toBe(204);
    expect(answer.headers.get('access-control-allow-origin')).toBe(origin);
    const allowed = answer.headers.get('access-control-allow-headers')!.toLowerCase();
    for (const header of headers.split(',')) expect(allowed).toContain(header.toLowerCase());
    const post = await app.request('/v1/speech/token', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', authorization: `Bearer ${token}`, [CONTRACT_HEADER]: String(CONTRACT_VERSION) },
      body: '{}',
    });
    expect(post.status).toBe(200);
    expect(post.headers.get('access-control-allow-origin')).toBe(origin);
  });

  test.each([`https://evil-${HOST}`, `http://${HOST}`, `https://${HOST}.evil.com`, 'not a url'])('%s gets no CORS header', async (origin) => {
    const { app } = harness();
    expect((await preflight(app, origin)).headers.get('access-control-allow-origin')).toBeNull();
  });

  test('origins compare real hostnames', () => {
    expect(isAllowedOrigin(`https://${HOST}`, HOST)).toBe(true);
    expect(isAllowedOrigin(`https://a.${HOST}`, undefined)).toBe(false);
  });

  test('an oversized body is refused', async () => {
    const { app, device } = harness();
    const { token } = await device();
    const response = await app.request('/v1/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, [CONTRACT_HEADER]: String(CONTRACT_VERSION) },
      body: JSON.stringify({ padding: 'x'.repeat(600 * 1024) }),
    });
    expect(response.status).toBe(400);
  });
});

describe('caps', () => {
  test.each([
    ['per device', { deviceFeature: 0 }],
    ['per feature', { feature: 0 }],
    ['global', { global: 0 }],
  ] as Array<[string, Partial<Caps>]>)('%s, at zero, stops an AI route', async (_label, caps) => {
    const { device } = harness(caps);
    expect(await codeOf((await device()).api.speakLine(line))).toBe('quota_exceeded');
  });

  test('a stream route reports it as an error chunk', async () => {
    const { device } = harness({ global: 0 });
    const chunks = await collect((await device()).api.replyAsCharacter(replyRequest));
    expect(chunks.at(-1)).toMatchObject({ kind: 'error', code: 'quota_exceeded' });
  });

  test('a device cap leaves other devices alone', async () => {
    const { device } = harness({ deviceFeature: 1 });
    const a = await device();
    await a.api.speakLine(line);
    expect(await codeOf(a.api.speakLine(line))).toBe('quota_exceeded');
    expect(await codeOf((await device()).api.speakLine(line))).toBe('ok');
  });

  test('caps reset the next UTC day', async () => {
    const { clock, device } = harness({ deviceFeature: 1 });
    const a = await device();
    await a.api.speakLine(line);
    expect(await codeOf(a.api.speakLine(line))).toBe('quota_exceeded');
    clock.now = new Date(NOON.getTime() + 86_400_000);
    expect(await codeOf(a.api.speakLine(line))).toBe('ok');
  });

  test('memory and telemetry have their own caps', async () => {
    const memory = harness({ memoryDevice: 0 });
    expect(await codeOf((await memory.device()).api.memoryRead({ seriesId: 's', afterSeq: null }))).toBe('quota_exceeded');
    const telemetry = harness({ telemetryDevice: 0 });
    expect(await codeOf((await telemetry.device()).api.sendTelemetry({ v: 1, buildId: 'b', sessionId: 's', events: [] }))).toBe('quota_exceeded');
    const writes = harness({ writes: 0 });
    expect(await codeOf((await writes.device()).api.memoryRead({ seriesId: 's', afterSeq: null }))).toBe('quota_exceeded');
  });

  test('a failed count never runs an AI route', async () => {
    const { store, device } = harness();
    const a = await device();
    store.close();
    expect(await codeOf(a.api.speakLine(line))).toBe('upstream_failed');
  });
});

describe('memory', () => {
  test('belongs to its device', async () => {
    const { device } = harness();
    const a = await device();
    const b = await device();
    await a.api.memoryAppend({ seriesId: 's', events: [event('a', 1)] });
    expect((await b.api.memoryRead({ seriesId: 's', afterSeq: null })).events).toEqual([]);
    expect((await b.api.memoryDelete({ seriesId: 's' })).deleted).toBe(0);
    expect((await a.api.memoryDelete({ seriesId: 's' })).deleted).toBe(1);
  });

  test('a resent id keeps the original', async () => {
    const { device } = harness();
    const a = await device();
    await a.api.memoryAppend({ seriesId: 's', events: [event('a', 1)] });
    await a.api.memoryAppend({ seriesId: 's', events: [event('a', 9)] });
    const { events } = await a.api.memoryRead({ seriesId: 's', afterSeq: null });
    expect(events.map((e) => [e.id, e.seq])).toEqual([['a', 1]]);
  });

  test('keeps what it is given, as the contract says', async () => {
    const { device } = harness();
    const a = await device();
    const { lastSeq } = await a.api.memoryAppend({ seriesId: 's', events: [event('a', 1), event('b', 1), event('c', null)] });
    expect(lastSeq).toBe(1);
    const { events } = await a.api.memoryRead({ seriesId: 's', afterSeq: null });
    expect(events.map((e) => e.id)).toEqual(['a', 'b']);
    expect((await a.api.memoryDelete({ seriesId: 's' })).deleted).toBe(3);
  });

  test('refuses an event from another series, and a batch that is too big', async () => {
    const { device } = harness();
    const a = await device();
    expect(await codeOf(a.api.memoryAppend({ seriesId: 's', events: [event('a', 1, 'other')] }))).toBe('bad_request');
    const many = Array.from({ length: 501 }, (_, i) => event(`e${i}`, i));
    expect(await codeOf(a.api.memoryAppend({ seriesId: 's', events: many }))).toBe('bad_request');
  });

  test('paged reads never skip events tied at one seq', async () => {
    const { device } = harness();
    const a = await device();
    const ids = Array.from({ length: 5001 }, (_, i) => `e${i}`);
    for (let i = 0; i < ids.length; i += 500) {
      await a.api.memoryAppend({ seriesId: 's', events: ids.slice(i, i + 500).map((id) => event(id, 7)) });
    }
    await a.api.memoryAppend({ seriesId: 's', events: [event('later', 8)] });
    const first = await a.api.memoryRead({ seriesId: 's', afterSeq: null });
    expect(new Set(first.events.map((e) => e.id))).toEqual(new Set(ids));
    const next = await a.api.memoryRead({ seriesId: 's', afterSeq: 7 });
    expect(next.events.map((e) => e.id)).toEqual(['later']);
  });
});

describe('telemetry and the admin read', () => {
  const batch = { v: 1 as const, buildId: 'b1', sessionId: 's1', events: [{ at: NOON.toISOString(), kind: 'hitch' as const, ms: 120, phase: 'load' }] };

  test('the report can read back what a device sent', async () => {
    const { app, device } = harness({}, 'admin-token');
    const { api, deviceId } = await device();
    expect((await api.sendTelemetry(batch)).accepted).toBe(1);
    const response = await app.request('/admin/telemetry', { headers: { authorization: 'Bearer admin-token' } });
    const { rows } = (await response.json()) as { rows: Array<{ deviceId: string; buildId: string }> };
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ deviceId, buildId: 'b1' });
  });

  test('needs the admin token, and does not exist without one', async () => {
    const withToken = harness({}, 'admin-token');
    expect((await withToken.app.request('/admin/telemetry', { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
    expect((await harness().app.request('/admin/telemetry', { headers: { authorization: 'Bearer x' } })).status).toBe(404);
  });
});

describe('readCaps', () => {
  test('takes zero, and refuses nonsense', () => {
    expect(readCaps({ CAP_GLOBAL: '0' }).global).toBe(0);
    expect(() => readCaps({ CAP_GLOBAL: 'lots' })).toThrow('CAP_GLOBAL');
  });
});
