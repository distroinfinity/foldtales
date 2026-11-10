import { describe, expect, test } from 'vitest';
import { BackendError, type BackendApi, type BeatRequest, type ReplyChunk } from '../src/api.ts';
import { checkBeat, checkReady, checkSpine, lineIdOf, linesOf } from '../src/beats.ts';
import type { ShowEvent } from '../src/events.ts';
import { createMockBackend, MOCK_PROFILES } from '../src/mocks/backend.ts';
import { fixtureLibrary, fixtureSpine } from '../src/mocks/fixtures.ts';
import type { StageLibrary } from '../src/library.ts';
import type { ShowObject } from '../src/objects.ts';
import { ROUTE_NAMES, type RouteName } from '../src/primitives.ts';

function requestWith(library: StageLibrary, over: Partial<BeatRequest> = {}): BeatRequest {
  return {
    episodeId: 'ep-1',
    spine: fixtureSpine(),
    library,
    objects: [],
    position: { sceneId: 'at-the-brook', cursor: 'ask', elapsedSeconds: 10 },
    show: { problems: [], holding: [], used: [] },
    canon: [],
    recent: [],
    trigger: { kind: 'lookahead' },
    usedLineIds: [],
    owedPlayers: [],
    ...over,
  };
}

const scene = () => fixtureSpine().scenes[0]!;
const copy: ShowObject = { id: 'string#a', def: fixtureLibrary().objects[1]!, owner: 'ann', origin: 'satchel', history: [] };
const reactReq = { objectId: 'string', castId: 'bramble', problem: null, library: fixtureLibrary(), objects: [], canon: [] };
const replyReq = { castId: 'bramble', playerId: 'ann', heard: 'hello', sceneSummary: 'A brook', library: fixtureLibrary(), objects: [], canon: [], recent: [] };

async function collect(stream: AsyncIterable<ReplyChunk>): Promise<ReplyChunk[]> {
  const chunks: ReplyChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

const callers: Record<RouteName, (api: BackendApi) => Promise<unknown>> = {
  issueDevice: (api) => api.issueDevice({}),
  planBeat: (api) => api.planBeat(requestWith(fixtureLibrary())),
  planSpine: (api) => api.planSpine({ seriesId: 's', library: fixtureLibrary(), objects: [], canon: [], premise: { kind: 'object', objectId: 'string' } }),
  reactToObject: (api) => collect(api.reactToObject(reactReq)),
  replyAsCharacter: (api) => collect(api.replyAsCharacter(replyReq)),
  speakLine: (api) => api.speakLine({ speaker: 'bramble', text: 'Hi', mood: 'warm' }),
  speechToken: (api) => api.speechToken({}),
  memoryAppend: (api) => api.memoryAppend({ seriesId: 's', events: [] }),
  memoryRead: (api) => api.memoryRead({ seriesId: 's', afterSeq: null }),
  memoryDelete: (api) => api.memoryDelete({ seriesId: 's' }),
  sendTelemetry: (api) => api.sendTelemetry({ v: 1, buildId: 'b', sessionId: 's', events: [] }),
};

const spoken = (beat: { actions: unknown[] }) => (beat.actions as { do: string; text: string }[]).find((a) => a.do === 'speak')!.text;

describe('planBeat', () => {
  test('builds a beat from the request library alone', async () => {
    const { beat, voice } = await createMockBackend().planBeat(requestWith(fixtureLibrary()));
    expect(checkBeat(beat, fixtureLibrary(), [], scene())).toEqual([]);
    expect(Object.keys(voice)).toContain(lineIdOf('bramble', spoken(beat)));
  });

  test('with another library uses that library', async () => {
    const library = fixtureLibrary();
    library.cast[0]!.id = 'thistle';
    library.cast[0]!.name = 'Thistle';
    const { beat } = await createMockBackend().planBeat(requestWith(library));
    expect(checkBeat(beat, library, [], scene())).toEqual([]);
    expect(JSON.stringify(beat)).not.toContain('bramble');
    expect(JSON.stringify(beat)).toContain('thistle');
  });

  test('never returns a line in usedLineIds', async () => {
    const first = await createMockBackend().planBeat(requestWith(fixtureLibrary()));
    const used = linesOf(first.beat).map((l) => l.lineId);
    const second = await createMockBackend().planBeat(requestWith(fixtureLibrary(), { usedLineIds: used }));
    for (const line of linesOf(second.beat)) expect(used).not.toContain(line.lineId);
  });

  test('sets replaces to the cursor on lookahead', async () => {
    const { beat } = await createMockBackend().planBeat(requestWith(fixtureLibrary()));
    expect(beat).toMatchObject({ source: 'director', replaces: 'ask', next: null });
  });

  test('a gift trigger uses the offered copy', async () => {
    const trigger = { kind: 'gift', objectId: 'string#a', castId: 'bramble', playerId: 'ann' } as const;
    const { beat } = await createMockBackend().planBeat(requestWith(fixtureLibrary(), { trigger, objects: [copy] }));
    expect(beat.replaces).toBeNull();
    expect(beat.actions).toContainEqual(expect.objectContaining({ do: 'use', object: 'string#a', who: 'bramble' }));
    expect(checkBeat(beat, fixtureLibrary(), [copy], scene())).toEqual([]);
  });

  test('every voice asset is captions-only with an estimated duration', async () => {
    const ready = await createMockBackend().planBeat(requestWith(fixtureLibrary()));
    expect(checkReady(ready)).toEqual([]);
    for (const asset of Object.values(ready.voice)) {
      expect(asset.url).toBeNull();
      expect(asset.durationMs).toBeGreaterThan(0);
    }
  });

  test('invalid_output returns a beat checkBeat rejects', async () => {
    const api = createMockBackend({ failure: { planBeat: 'invalid_output' } });
    const { beat } = await api.planBeat(requestWith(fixtureLibrary()));
    expect(checkBeat(beat, fixtureLibrary(), [], scene()).length).toBeGreaterThan(0);
  });
});

test('planSpine returns a spine that passes checkSpine', async () => {
  const library = fixtureLibrary();
  const spine = await createMockBackend().planSpine({ seriesId: 's', library, objects: [], canon: [], premise: { kind: 'spoken', text: 'a lost mitten' } });
  expect(checkSpine(spine, library)).toEqual([]);
});

test.each([
  ['reactToObject', (api: BackendApi) => api.reactToObject(reactReq)],
  ['replyAsCharacter', (api: BackendApi) => api.replyAsCharacter(replyReq)],
] as const)('%s ends with one final chunk', async (_name, open) => {
  const chunks = await collect(open(createMockBackend()));
  expect(chunks.at(-1)?.kind).toBe('final');
  expect(chunks.filter((c) => c.kind !== 'delta')).toHaveLength(1);
});

describe.each(ROUTE_NAMES)('%s', (route) => {
  test('honours latency through the injected sleep', async () => {
    const slept: number[] = [];
    const api = createMockBackend({ latencyMs: { [route]: 1234 }, sleep: async (ms) => void slept.push(ms) });
    await callers[route](api);
    expect(slept).toEqual([1234]);
  });

  test('honours quota_exceeded', async () => {
    const api = createMockBackend({ failure: { [route]: 'quota_exceeded' } });
    const stream = route === 'reactToObject' || route === 'replyAsCharacter';
    if (stream) {
      const chunks = (await callers[route](api)) as ReplyChunk[];
      expect(chunks).toEqual([expect.objectContaining({ kind: 'error', code: 'quota_exceeded' })]);
    } else {
      const error = await callers[route](api).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BackendError);
      expect(error).toMatchObject({ code: 'quota_exceeded' });
    }
  });
});

test('a number latency applies to every route', async () => {
  const slept: number[] = [];
  await callers.speakLine(createMockBackend({ latencyMs: 50, sleep: async (ms) => void slept.push(ms) }));
  expect(slept).toEqual([50]);
});

test('moderated on a reply yields a redirect chunk', async () => {
  const chunks = await collect(createMockBackend({ failure: { replyAsCharacter: 'moderated' } }).replyAsCharacter(replyReq));
  expect(chunks).toEqual([expect.objectContaining({ kind: 'redirect' })]);
});

test('upstream_failed is retryable', async () => {
  await expect(callers.speakLine(createMockBackend({ failure: { speakLine: 'upstream_failed' } }))).rejects.toMatchObject({ retryable: true });
});

describe('MOCK_PROFILES', () => {
  test('slow delays the three AI routes by 8 seconds', async () => {
    const slept: number[] = [];
    await callers.planBeat(createMockBackend({ ...MOCK_PROFILES.slow, sleep: async (ms) => void slept.push(ms) }));
    expect(slept).toEqual([8000]);
  });
  test('cap and fail still issue a device token', async () => {
    await expect(callers.issueDevice(createMockBackend(MOCK_PROFILES.cap))).resolves.toBeDefined();
    await expect(callers.issueDevice(createMockBackend(MOCK_PROFILES.fail))).resolves.toBeDefined();
  });
  test('cap makes planBeat quota_exceeded', async () => {
    await expect(callers.planBeat(createMockBackend(MOCK_PROFILES.cap))).rejects.toMatchObject({ code: 'quota_exceeded' });
  });
  test('fail makes planBeat upstream_failed', async () => {
    await expect(callers.planBeat(createMockBackend(MOCK_PROFILES.fail))).rejects.toMatchObject({ code: 'upstream_failed' });
  });
});

function event(id: string, seq: number): ShowEvent {
  return { v: 1, id, seq, seriesId: 's', episodeId: null, actor: { kind: 'app' }, showMs: 0, at: '2026-11-10T00:00:00.000Z', type: 'session.resumed', data: {} };
}

describe('memory', () => {
  test('append is idempotent on id and keeps seq', async () => {
    const api = createMockBackend();
    expect(await api.memoryAppend({ seriesId: 's', events: [event('a', 7), event('b', 8)] })).toEqual({ lastSeq: 8 });
    expect(await api.memoryAppend({ seriesId: 's', events: [event('a', 7)] })).toEqual({ lastSeq: 8 });
    const { events } = await api.memoryRead({ seriesId: 's', afterSeq: null });
    expect(events.map((e) => e.seq)).toEqual([7, 8]);
  });
  test('read honours afterSeq and delete empties it', async () => {
    const api = createMockBackend();
    await api.memoryAppend({ seriesId: 's', events: [event('a', 1), event('b', 2)] });
    expect((await api.memoryRead({ seriesId: 's', afterSeq: 1 })).events.map((e) => e.id)).toEqual(['b']);
    expect(await api.memoryDelete({ seriesId: 's' })).toEqual({ deleted: 2 });
    expect((await api.memoryRead({ seriesId: 's', afterSeq: null })).events).toEqual([]);
  });
  test('series are separate', async () => {
    const api = createMockBackend();
    await api.memoryAppend({ seriesId: 'one', events: [event('a', 1)] });
    expect((await api.memoryRead({ seriesId: 'two', afterSeq: null })).events).toEqual([]);
  });
});
