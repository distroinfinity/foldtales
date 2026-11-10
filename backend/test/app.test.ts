import { BackendError, CONTRACT_HEADER, createHttpBackend, CONTRACT_VERSION, routes, type BackendApi, type ReplyChunk } from '@tabletop/contracts';
import { createMockBackend, fixtureLibrary, fixtureSpine, MOCK_PROFILES } from '@tabletop/contracts/mocks';
import { ROUTE_NAMES, type RouteName } from '@tabletop/contracts';
import { describe, expect, test } from 'vitest';
import { createApp, resolveListen } from '../src/app.ts';

const asFetch = (api: BackendApi): typeof fetch => {
  const app = createApp(api);
  return ((input: string | URL | Request, init?: RequestInit) => app.request(String(input), init)) as typeof fetch;
};
const client = (api: BackendApi = createMockBackend()) => createHttpBackend({ baseUrl: '', fetch: asFetch(api) });

const beatRequest = {
  episodeId: 'ep-1',
  spine: fixtureSpine(),
  library: fixtureLibrary(),
  objects: [],
  position: { sceneId: 'at-the-brook', cursor: 'ask', elapsedSeconds: 3 },
  show: { problems: [], holding: [], used: [] },
  canon: [],
  recent: [],
  trigger: { kind: 'lookahead' as const },
  usedLineIds: [],
  owedPlayers: [],
};
const reactReq = { objectId: 'string', castId: 'bramble', problem: null, library: fixtureLibrary(), objects: [], canon: [] };
const replyReq = { castId: 'bramble', playerId: 'ann', heard: 'hello', sceneSummary: 'A brook', library: fixtureLibrary(), objects: [], canon: [], recent: [] };

async function collect(stream: AsyncIterable<ReplyChunk>): Promise<ReplyChunk[]> {
  const chunks: ReplyChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

const event = {
  v: 1 as const,
  id: 'evt-1',
  seq: 1,
  seriesId: 's',
  episodeId: null,
  actor: { kind: 'app' as const },
  showMs: 0,
  at: '2026-11-10T00:00:00.000Z',
  type: 'session.resumed' as const,
  data: {},
};

const callers: Record<RouteName, (api: BackendApi) => Promise<unknown>> = {
  issueDevice: (api) => api.issueDevice({}),
  planBeat: (api) => api.planBeat(beatRequest),
  planSpine: (api) => api.planSpine({ seriesId: 's', library: fixtureLibrary(), objects: [], canon: [], premise: { kind: 'object', objectId: 'string' } }),
  reactToObject: (api) => collect(api.reactToObject(reactReq)),
  replyAsCharacter: (api) => collect(api.replyAsCharacter(replyReq)),
  speakLine: (api) => api.speakLine({ speaker: 'bramble', text: 'Hi', mood: 'warm' }),
  speechToken: (api) => api.speechToken({}),
  memoryAppend: (api) => api.memoryAppend({ seriesId: 's', events: [event] }),
  memoryRead: (api) => api.memoryRead({ seriesId: 's', afterSeq: null }),
  memoryDelete: (api) => api.memoryDelete({ seriesId: 's' }),
  sendTelemetry: (api) => api.sendTelemetry({ v: 1, buildId: 'b', sessionId: 's', events: [] }),
};

describe('every route', () => {
  test.each(ROUTE_NAMES)('%s round-trips through HTTP', async (route) => {
    const result = await callers[route](client());
    expect(result).toBeDefined();
  });

  test('reactToObject streams SSE ending in final', async () => {
    const chunks = await collect(client().reactToObject(reactReq));
    expect(chunks.map((c) => c.kind)).toEqual(['delta', 'final']);
  });

  test('replyAsCharacter streams a moderation redirect', async () => {
    const chunks = await collect(client(createMockBackend({ failure: { replyAsCharacter: 'moderated' } })).replyAsCharacter(replyReq));
    expect(chunks.map((c) => c.kind)).toEqual(['redirect']);
  });

  test('a failing stream route ends in one error chunk', async () => {
    const chunks = await collect(client(createMockBackend(MOCK_PROFILES.cap)).reactToObject(reactReq));
    expect(chunks).toEqual([expect.objectContaining({ kind: 'error', code: 'quota_exceeded' })]);
  });
});

describe('failures reach the client typed', () => {
  test.each(['upstream_failed', 'quota_exceeded', 'moderated'] as const)('%s', async (failure) => {
    const api = client(createMockBackend({ failure: { speakLine: failure } }));
    const error = await api.speakLine({ speaker: 'bramble', text: 'Hi', mood: 'warm' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BackendError);
    expect(error).toMatchObject({ code: failure });
  });

  test('the cap profile makes planBeat throw quota_exceeded', async () => {
    await expect(client(createMockBackend(MOCK_PROFILES.cap)).planBeat(beatRequest)).rejects.toMatchObject({ code: 'quota_exceeded' });
  });

  test('upstream_failed stays retryable across HTTP', async () => {
    const api = client(createMockBackend({ failure: { speakLine: 'upstream_failed' } }));
    await expect(api.speakLine({ speaker: 'bramble', text: 'Hi', mood: 'warm' })).rejects.toMatchObject({ retryable: true });
  });
});

describe('the HTTP surface', () => {
  const app = createApp(createMockBackend());
  const post = (body: string, headers: Record<string, string> = { [CONTRACT_HEADER]: String(CONTRACT_VERSION) }) =>
    app.request(routes.speakLine.path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
  const good = JSON.stringify({ speaker: 'bramble', text: 'Hi', mood: 'warm' });

  async function expectError(response: Response, status: number, code: string) {
    expect(response.status).toBe(status);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe(code);
  }

  test('no contract header returns contract_mismatch, 409', async () => {
    await expectError(await post(good, {}), 409, 'contract_mismatch');
  });

  test('an old contract header returns contract_mismatch, 409', async () => {
    await expectError(await post(good, { [CONTRACT_HEADER]: '0' }), 409, 'contract_mismatch');
  });

  test('a body that is not JSON returns bad_request, 400', async () => {
    await expectError(await post('{not json'), 400, 'bad_request');
  });

  test('a body that fails the schema returns bad_request, 400', async () => {
    await expectError(await post(JSON.stringify({ speaker: 'bramble' })), 400, 'bad_request');
  });

  test('an unexpected exception returns upstream_failed, 502, with no stack', async () => {
    const boom = { ...createMockBackend(), speakLine: async () => { throw new TypeError('secret detail at /srv/app.ts:1'); } } as BackendApi;
    const response = await createApp(boom, () => {}).request(routes.speakLine.path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CONTRACT_HEADER]: String(CONTRACT_VERSION) },
      body: good,
    });
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).toContain('upstream_failed');
    expect(text).not.toContain('secret detail');
  });

  test.each([
    ['bad_request', 400],
    ['unauthorized', 401],
    ['contract_mismatch', 409],
    ['moderated', 422],
    ['quota_exceeded', 429],
    ['upstream_failed', 502],
    ['invalid_output', 502],
  ] as const)('%s maps to %i', async (code, status) => {
    const failing = { ...createMockBackend(), speakLine: async () => { throw new BackendError(code, 'no'); } } as BackendApi;
    const response = await createApp(failing).request(routes.speakLine.path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [CONTRACT_HEADER]: String(CONTRACT_VERSION) },
      body: good,
    });
    expect(response.status).toBe(status);
  });

  test('GET /healthz needs no header and reports the version', async () => {
    const response = await app.request('/healthz');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, contract: CONTRACT_VERSION });
  });
});

describe('resolveListen', () => {
  const ports = () => ({ CLIENT_PORT: 6100, BACKEND_PORT: 6101 });

  test('--dev reads the port file and ignores an inherited PORT, on 127.0.0.1', () => {
    expect(resolveListen(['--dev'], { PORT: '9999' }, ports)).toEqual({ port: 6101, host: '127.0.0.1' });
  });
  test('production uses PORT on 0.0.0.0', () => {
    expect(resolveListen([], { PORT: '8080' }, ports)).toEqual({ port: 8080, host: '0.0.0.0' });
  });
  test('production with no PORT throws', () => {
    expect(() => resolveListen([], {}, ports)).toThrow(/PORT/);
  });
  test('production with a bad PORT throws', () => {
    expect(() => resolveListen([], { PORT: 'abc' }, ports)).toThrow(/PORT/);
  });
});
