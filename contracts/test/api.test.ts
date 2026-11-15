import { describe, expect, test } from 'vitest';
import {
  BackendError,
  CONTRACT_HEADER,
  createHttpBackend,
  isTerminal,
  routes,
  type ReplyChunk,
} from '../src/api.ts';
import { fixtureLibrary } from '../src/mocks/fixtures.ts';
import { ROUTE_NAMES } from '../src/primitives.ts';
import { CONTRACT_VERSION } from '../src/version.ts';
import { StoryPage, StoryTurnRequest, type TurnEvent } from '../src/storyteller.ts';

const speakReq = { speaker: 'bramble', text: 'Hello', mood: 'warm' } as const;
const reactReq = { objectId: 'string', castId: 'bramble', problem: null, library: fixtureLibrary(), objects: [], canon: [] };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const asset = { url: null, durationMs: 900 };

function backendReturning(response: Response | (() => Response), seen: { init?: RequestInit; url?: string } = {}) {
  return createHttpBackend({
    baseUrl: 'http://x',
    token: 'tok',
    fetch: async (url, init) => {
      seen.url = String(url);
      if (init) seen.init = init;
      return typeof response === 'function' ? response() : response;
    },
  });
}

async function collect(stream: AsyncIterable<ReplyChunk>): Promise<ReplyChunk[]> {
  const chunks: ReplyChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

const sseOf = (...frames: string[]) =>
  new Response(frames.map((f) => `data: ${f}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });

const delta = JSON.stringify({ kind: 'delta', text: 'A kite' });
const final = JSON.stringify({ kind: 'final', line: { who: 'bramble', text: 'A kite?', mood: 'wonder' }, voice: asset, changesScene: false });

describe('calls', () => {
  test('sends the contract header and the bearer token', async () => {
    const seen: { init?: RequestInit; url?: string } = {};
    await backendReturning(json(asset), seen).speakLine(speakReq);
    const headers = new Headers(seen.init?.headers);
    expect(headers.get(CONTRACT_HEADER)).toBe(String(CONTRACT_VERSION));
    expect(headers.get('authorization')).toBe('Bearer tok');
    expect(seen.url).toBe('http://x/v1/voice/line');
    expect(seen.init?.method).toBe('POST');
  });

  test('a typed error body throws BackendError with its code', async () => {
    const body = { error: { code: 'quota_exceeded', retryable: false, message: 'cap' } };
    const error = await backendReturning(json(body, 429)).speakLine(speakReq).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BackendError);
    expect(error).toMatchObject({ code: 'quota_exceeded', retryable: false });
  });

  test('a response that fails the schema throws invalid_output', async () => {
    await expect(backendReturning(json({ url: 5 })).speakLine(speakReq)).rejects.toMatchObject({ code: 'invalid_output' });
  });

  test('a body that is not JSON throws invalid_output', async () => {
    await expect(backendReturning(new Response('<html>')).speakLine(speakReq)).rejects.toMatchObject({ code: 'invalid_output' });
  });

  test('a network failure throws upstream_failed, retryable', async () => {
    const api = createHttpBackend({ baseUrl: 'http://x', fetch: async () => { throw new TypeError('offline'); } });
    await expect(api.speakLine(speakReq)).rejects.toMatchObject({ code: 'upstream_failed', retryable: true });
  });

  test('a non-JSON error body throws upstream_failed', async () => {
    await expect(backendReturning(new Response('bad gateway', { status: 502 })).speakLine(speakReq)).rejects.toMatchObject({ code: 'upstream_failed' });
  });
});

describe('streams', () => {
  test('yields deltas then its terminal chunk', async () => {
    const chunks = await collect(backendReturning(sseOf(delta, final)).reactToObject(reactReq));
    expect(chunks.map((c) => c.kind)).toEqual(['delta', 'final']);
  });

  test('stops at the terminal chunk', async () => {
    const chunks = await collect(backendReturning(sseOf(final, delta)).reactToObject(reactReq));
    expect(chunks.map((c) => c.kind)).toEqual(['final']);
  });

  test('handles a frame split across reads', async () => {
    const text = `data: ${final}\n\n`;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const bytes = new TextEncoder().encode(text);
        controller.enqueue(bytes.slice(0, 11));
        controller.enqueue(bytes.slice(11));
        controller.close();
      },
    });
    const chunks = await collect(backendReturning(new Response(body)).reactToObject(reactReq));
    expect(chunks.map((c) => c.kind)).toEqual(['final']);
  });

  test('a stream that closes with no terminal chunk yields one upstream_failed error chunk', async () => {
    const chunks = await collect(backendReturning(sseOf(delta)).reactToObject(reactReq));
    expect(chunks.map((c) => c.kind)).toEqual(['delta', 'error']);
    expect(chunks[1]).toMatchObject({ code: 'upstream_failed' });
  });

  test('a network failure mid-stream yields one upstream_failed error chunk', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: ${delta}\n\n`));
      },
      pull(controller) {
        controller.error(new Error('reset'));
      },
    });
    const chunks = await collect(backendReturning(new Response(body)).reactToObject(reactReq));
    expect(chunks.at(-1)).toMatchObject({ kind: 'error', code: 'upstream_failed' });
    expect(chunks.filter(isTerminal)).toHaveLength(1);
  });

  test('a network failure before the stream starts yields one error chunk', async () => {
    const api = createHttpBackend({ baseUrl: 'http://x', fetch: async () => { throw new TypeError('offline'); } });
    const chunks = await collect(api.reactToObject(reactReq));
    expect(chunks).toEqual([expect.objectContaining({ kind: 'error', code: 'upstream_failed' })]);
  });

  test('a typed HTTP error on a stream route yields one error chunk with that code', async () => {
    const body = { error: { code: 'quota_exceeded', retryable: false, message: 'cap' } };
    const chunks = await collect(backendReturning(json(body, 429)).reactToObject(reactReq));
    expect(chunks).toEqual([expect.objectContaining({ kind: 'error', code: 'quota_exceeded' })]);
  });

  test('a malformed SSE line yields one invalid_output error chunk', async () => {
    const chunks = await collect(backendReturning(sseOf('not json', final)).reactToObject(reactReq));
    expect(chunks).toEqual([expect.objectContaining({ kind: 'error', code: 'invalid_output' })]);
  });

  test('a chunk that fails the schema yields one invalid_output error chunk', async () => {
    const chunks = await collect(backendReturning(sseOf(JSON.stringify({ kind: 'nope' }))).reactToObject(reactReq));
    expect(chunks).toEqual([expect.objectContaining({ kind: 'error', code: 'invalid_output' })]);
  });
});

test('every route name has a route', () => {
  expect(Object.keys(routes).sort()).toEqual([...ROUTE_NAMES].sort());
});

test('every route path is unique and starts with /v1/', () => {
  const paths = Object.values(routes).map((r) => r.path);
  expect(new Set(paths).size).toBe(paths.length);
  for (const path of paths) expect(path.startsWith('/v1/')).toBe(true);
});

test('exactly the two reply routes and the storyteller turn stream', () => {
  const streaming = Object.entries(routes).filter(([, r]) => 'stream' in r).map(([name]) => name);
  expect(streaming.sort()).toEqual(['reactToObject', 'replyAsCharacter', 'storyTurn']);
});

describe('the storyteller over HTTP', () => {
  const turnReq = {
    storyId: 'story-1',
    turnId: 'turn-1',
    phase: 'closing' as const,
    activeSeconds: 600,
    library: fixtureLibrary(),
    stage: { setId: fixtureLibrary().sets[0]!.id, cast: [], objects: [], light: 'dusk' as const, lampLit: false },
    room: [],
    input: { kind: 'close' as const, reason: 'time' as const },
    history: [],
  };
  const events = async (stream: AsyncIterable<TurnEvent>) => {
    const out: TurnEvent[] = [];
    for await (const e of stream) out.push(e);
    return out;
  };

  test.each([
    ['ending', { kind: 'ending', title: 'The odd sock', summary: 'It found its pair.' }],
    ['recover', { kind: 'recover' }],
  ])('a turn stops at %s', async (_name, last) => {
    const titled = JSON.stringify({ kind: 'titled', title: 'The odd sock' });
    const got = await events(backendReturning(sseOf(titled, JSON.stringify(last), titled)).storyTurn(turnReq));
    expect(got).toEqual([JSON.parse(titled), last]);
  });

  test('end and list round-trip their shapes', async () => {
    const record = { id: 'story-1', title: 'The odd sock', summary: null, things: ['paper boat'], startedAt: '2026-11-16T10:00:00.000Z', endedAt: '2026-11-16T10:10:00.000Z', updatedAt: '2026-11-16T10:10:00.000Z' };
    const seen: { url?: string } = {};
    expect(await backendReturning(json({ record }), seen).endStory({ storyId: 'story-1', reason: 'time', page: { title: 'The odd sock', summary: null, things: ['paper boat'] } })).toEqual({ record });
    expect(seen.url).toBe('http://x/v1/storyteller/end');
    expect(await backendReturning(json({ stories: [record] })).listStories({})).toEqual({ stories: [record] });
  });

  test('availability says when it resets, and nothing else', async () => {
    const body = { status: 'ready', storiesLeftToday: 3, resetsAt: '2026-11-17T00:00:00.000Z' };
    expect(await backendReturning(json(body)).storytellerAvailability({})).toEqual(body);
    await expect(backendReturning(json({ ...body, extra: 1 })).storytellerAvailability({})).rejects.toMatchObject({ code: 'invalid_output' });
  });

  test('a turn request is strict: no client session ids or canon', () => {
    expect(StoryTurnRequest.safeParse(turnReq).success).toBe(true);
    expect(StoryTurnRequest.safeParse({ ...turnReq, sessionId: 'x' }).success).toBe(false);
    expect(StoryTurnRequest.safeParse({ ...turnReq, canon: [] }).success).toBe(false);
  });

  test('a saved page has a title, and at most 12 things', () => {
    expect(StoryPage.safeParse({ title: '', summary: null, things: [] }).success).toBe(false);
    expect(StoryPage.safeParse({ title: 'A', summary: null, things: Array.from({ length: 13 }, () => 'x') }).success).toBe(false);
  });
});
