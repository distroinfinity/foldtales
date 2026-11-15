import { SESSION_HEADER, SIGN_IN_REQUIRED, STORYTELLER_RESTING, createHttpBackend, type BackendError, type ShowEvent } from '@tabletop/contracts';
import { createMockBackend } from '@tabletop/contracts/mocks';
import { describe, expect, test } from 'vitest';
import { createApp } from '../src/app.ts';
import { guard, readCaps } from '../src/guard.ts';
import { realRoutes } from '../src/real-routes.ts';
import { openStore } from '../src/store.ts';

/**
 * Rollback is the Storyteller off, never sign-in off (stage 2, ruling 1). Whatever the switches
 * say, a guest never starts a story; off refuses every AI route; the chapters' routes always work.
 * TT_ACCOUNTS no longer reaches the guard, so it can't open the AI to guests.
 */

const NOON = new Date('2026-11-16T12:00:00.000Z');

function app(storytellerOn: boolean) {
  const store = openStore(':memory:');
  const now = () => NOON;
  const hono = createApp({ ...createMockBackend(), ...realRoutes(store, 'secret', now) }, () => undefined, {
    afterContract: [guard(store, { secret: 'secret', caps: readCaps({}), now, sessionUser: async (t) => t.match(/^session-(.+)$/)?.[1] ?? null, storytellerOn: () => storytellerOn })],
  });
  const api = (token?: string, session?: string) =>
    createHttpBackend({
      baseUrl: '',
      token,
      fetch: ((input: string | URL | Request, init?: RequestInit) =>
        hono.request(String(input), { ...init, headers: { ...(init?.headers as Record<string, string>), ...(session ? { [SESSION_HEADER]: session } : {}) } })) as typeof fetch,
    });
  return { api };
}

const failure = (call: Promise<unknown>) => call.then(() => null, (e: BackendError) => ({ code: e.code, message: e.message }));
const event: ShowEvent = { v: 1, id: 'e1', seq: 1, seriesId: 's', episodeId: null, actor: { kind: 'app' }, showMs: 0, at: NOON.toISOString(), type: 'session.resumed', data: {} } as ShowEvent;

describe.each([
  ['on', true],
  ['off', false],
] as const)('the Storyteller %s', (_name, on) => {
  test.each([
    ['a guest', null],
    ['a signed-in reader', 'session-ann'],
  ] as const)('%s', async (_who, session) => {
    const { api } = app(on);
    const { token } = await api().issueDevice({});
    const client = api(token, session ?? undefined);

    const start = await failure(client.startStory({ requestId: 'r1' }));
    const speech = await failure(client.speechToken({}));
    if (!on) {
      // Off: everyone hears that it's resting, and nothing paid is reached.
      expect(start).toEqual({ code: 'upstream_failed', message: STORYTELLER_RESTING });
      expect(speech).toEqual({ code: 'upstream_failed', message: STORYTELLER_RESTING });
    } else if (!session) {
      expect(start).toEqual({ code: 'unauthorized', message: SIGN_IN_REQUIRED });
      expect(speech).toEqual({ code: 'unauthorized', message: SIGN_IN_REQUIRED });
    } else {
      expect(start).toBeNull();
    }
    // The door and the shelf need a reader, and stay open while it rests.
    const availability = await failure(client.storytellerAvailability({}));
    expect(availability).toEqual(session ? null : { code: 'unauthorized', message: SIGN_IN_REQUIRED });

    // The chapters' routes work in every combination.
    await expect(client.memoryAppend({ seriesId: 's', events: [event] })).resolves.toBeDefined();
    await expect(client.memoryRead({ seriesId: 's', afterSeq: null })).resolves.toMatchObject({ events: [expect.objectContaining({ id: 'e1' })] });
    await expect(client.sendTelemetry({ v: 1, buildId: 'b', sessionId: 's', events: [] })).resolves.toBeDefined();
  });
});

test('a turn from a guest is refused before any story is touched, even with the Storyteller on', async () => {
  const { api } = app(true);
  const { token } = await api().issueDevice({});
  const events = [];
  for await (const e of api(token).storyTurn({
    storyId: 'st-x',
    turnId: 't1',
    phase: 'welcome',
    activeSeconds: 0,
    library: (await import('@tabletop/contracts/mocks')).fixtureLibrary(),
    stage: { setId: 'glade', cast: [], objects: [], light: 'dusk', lampLit: false },
    room: [],
    input: { kind: 'open' },
    history: [],
  }))
    events.push(e);
  expect(events).toEqual([{ kind: 'error', code: 'unauthorized', message: SIGN_IN_REQUIRED }]);
});
