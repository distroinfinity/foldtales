import { describe, expect, test } from 'vitest';
import { BackendError, SIGN_IN_REQUIRED, type BackendApi, type StoryRecord } from '../contracts/src/index.ts';
import { createStorytellerProvider, type DoorState, type PendingStory, type ProviderDeps } from '../client/src/storyteller/provider.ts';

const memoryStorage = () => {
  const map = new Map<string, string>();
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
};

const memoryPending = () => {
  const items = new Map<string, PendingStory>();
  return { items, put: async (i: PendingStory) => void items.set(i.id, i), all: async () => [...items.values()], remove: async (id: string) => void items.delete(id) };
};

const record = (id: string, title: string, endedAt: string | null = '2026-11-16T20:10:00.000Z'): StoryRecord => ({
  id,
  title,
  summary: 'The sock found its pair. Wick kept the log.',
  things: ['paper boat'],
  startedAt: '2026-11-16T20:00:00.000Z',
  endedAt,
  updatedAt: endedAt ?? '2026-11-16T20:05:00.000Z',
});

function setup(over: Partial<ProviderDeps> = {}, api: Partial<BackendApi> = {}) {
  const storage = memoryStorage();
  const pending = memoryPending();
  let reader = { id: 'ann' } as { id: string } | null;
  let generation = 1;
  const ends: string[] = [];
  const backendApi = {
    storytellerAvailability: async () => ({ status: 'ready', storiesLeftToday: 3, resetsAt: '2026-11-17T00:00:00.000Z' }),
    listStories: async () => ({ stories: [record('st-1', 'The odd sock')] }),
    endStory: async (r: { storyId: string }) => {
      ends.push(r.storyId);
      return { record: record(r.storyId, 'Saved') };
    },
    ...api,
  } as unknown as BackendApi;
  const deps: ProviderDeps = {
    built: () => true,
    cachedReader: (): { id: string } | null => reader,
    session: async (): Promise<{ id: string } | null | 'failed'> => reader,
    lapsed: () => false,
    generation: () => generation,
    mic: async (): Promise<'granted' | 'denied' | 'prompt'> => 'granted',
    backend: (call) => call(backendApi),
    online: () => true,
    storage,
    pending,
    ...over,
  };
  const provider = createStorytellerProvider(deps);
  return { provider, storage, pending, ends, setReader: (r: { id: string } | null) => (reader = r), bump: () => (generation += 1) };
}

const doorCases: Array<[string, Partial<ProviderDeps>, Partial<BackendApi>, DoorState]> = [
    ['built off', { built: () => false }, {}, { kind: 'unavailable', why: 'service' }],
    ['signed out', { cachedReader: () => null }, {}, { kind: 'signed-out' }],
    ['the server forgot the session', { cachedReader: () => null, lapsed: () => true }, {}, { kind: 'session-expired' }],
    ['the session check failed, online', { session: async () => 'failed' as const }, {}, { kind: 'auth-failed' }],
    ['offline', { session: async () => 'failed' as const, online: () => false }, {}, { kind: 'unavailable', why: 'offline' }],
    ['mic not asked', { mic: async () => 'prompt' as const }, {}, { kind: 'mic-not-asked' }],
    ['mic refused', { mic: async () => 'denied' as const }, {}, { kind: 'mic-refused' }],
    ['resting', {}, { storytellerAvailability: async () => ({ status: 'resting', storiesLeftToday: 0, resetsAt: '2026-11-17T00:00:00.000Z' }) }, { kind: 'unavailable', why: 'service' }],
    ['tonight used', {}, { storytellerAvailability: async () => ({ status: 'used-today', storiesLeftToday: 0, resetsAt: '2026-11-17T00:00:00.000Z' }) }, { kind: 'limit-reached', until: '2026-11-17T00:00:00.000Z' }],
    ['the backend can\'t be reached', {}, { storytellerAvailability: async () => Promise.reject(new BackendError('upstream_failed', 'down', true)) }, { kind: 'unavailable', why: 'service' }],
    ['a sign-in the server refuses', {}, { storytellerAvailability: async () => Promise.reject(new BackendError('unauthorized', SIGN_IN_REQUIRED)) }, { kind: 'session-expired' }],
    ['ready', {}, {}, { kind: 'ready' }],
];

describe('the door', () => {
  test.each(doorCases)('%s', async (_name, over, api, door) => {
    const { provider } = setup(over, api);
    await provider.refresh();
    expect(provider.snapshot().door).toEqual(door);
  });

  test('starts as auth-loading, and tells subscribers when it changes', async () => {
    const { provider } = setup();
    expect(provider.snapshot().door).toEqual({ kind: 'auth-loading' });
    let heard = 0;
    const stop = provider.subscribe(() => (heard += 1));
    await provider.refresh();
    expect(heard).toBeGreaterThan(0);
    stop();
  });

  test('allowing the microphone opens the door', async () => {
    const { provider } = setup({ mic: async () => 'prompt' });
    await provider.refresh();
    expect(await provider.askMicrophone(async () => 'granted')).toBe('granted');
    expect(provider.snapshot().door).toEqual({ kind: 'ready' });
  });
});

describe('the shelf', () => {
  test('only finished stories, as two or three lines; cached under the reader', async () => {
    const { provider, storage } = setup({}, { listStories: async () => ({ stories: [record('st-1', 'The odd sock'), record('st-2', 'Still going', null)] }) });
    await provider.refresh();
    expect(provider.snapshot().finished).toEqual([{ id: 'st-1', title: 'The odd sock', endedAt: '2026-11-16T20:10:00.000Z', lines: ['The sock found its pair.', 'Wick kept the log.'], things: ['paper boat'] }]);
    expect(storage.map.has('tt.storyteller.shelf.ann')).toBe(true);
    expect(storage.map.has('tt.storyteller.shelf.bob')).toBe(false);
  });

  test('a refresh that comes back after the reader changed is dropped', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const s = setup({}, { listStories: async () => (await gate, { stories: [record('st-1', "Ann's story")] }) });
    const running = s.provider.refresh();
    await new Promise((r) => setTimeout(r, 0));
    s.bump();
    s.setReader({ id: 'bob' });
    release();
    await running;
    expect(s.provider.snapshot().finished.map((f) => f.title)).not.toContain("Ann's story");
  });

  test('offline keeps the last copy', async () => {
    const online = { value: true };
    const s = setup({ online: () => online.value, session: async () => (online.value ? { id: 'ann' } : 'failed') });
    await s.provider.refresh();
    online.value = false;
    await s.provider.refresh();
    expect(s.provider.snapshot().finished.map((f) => f.title)).toEqual(['The odd sock']);
    expect(s.provider.snapshot().door).toEqual({ kind: 'unavailable', why: 'offline' });
  });

  test('signed out, the shelf is empty', async () => {
    const s = setup();
    await s.provider.refresh();
    s.setReader(null);
    await s.provider.refresh();
    expect(s.provider.snapshot().finished).toEqual([]);
  });
});

describe('a finished story', () => {
  const ending = { id: 'st-9', title: 'The paper boat', lines: ['It sailed.', 'Pip waved.'], things: ['paper boat'] };

  test('shows on the shelf at once, is sent, and leaves the pending store when the server has it', async () => {
    const s = setup();
    await s.provider.refresh();
    await s.provider.recordFinished(ending);
    expect(s.provider.snapshot().finished).toContainEqual(expect.objectContaining({ id: 'st-9', title: 'The paper boat' }));
    await new Promise((r) => setTimeout(r, 0));
    await s.provider.refresh();
    expect(s.ends).toContain('st-9');
    expect(s.pending.items.size).toBe(0);
  });

  test('offline it waits, and goes out on the next refresh', async () => {
    let up = false;
    const s = setup({}, { endStory: async (r) => (up ? { record: record(r.storyId, 'Saved') } : Promise.reject(new BackendError('upstream_failed', 'down', true))) });
    await s.provider.recordFinished(ending);
    await new Promise((r) => setTimeout(r, 0));
    expect(s.pending.items.size).toBe(1);
    up = true;
    await s.provider.refresh();
    expect(s.pending.items.size).toBe(0);
  });

  test("another reader's waiting story is never sent under this reader", async () => {
    const s = setup();
    await s.pending.put({ id: 'st-bob', readerId: 'bob', page: { title: "Bob's", summary: null, things: [] }, endedAt: '2026-11-16T19:00:00.000Z' });
    await s.provider.refresh();
    expect(s.ends).not.toContain('st-bob');
    expect(s.pending.items.has('st-bob')).toBe(false);
  });

  test('a story the server never knew is let go', async () => {
    const s = setup({}, { endStory: async () => Promise.reject(new BackendError('bad_request', 'no story in progress')) });
    await s.provider.recordFinished(ending);
    await new Promise((r) => setTimeout(r, 0));
    await s.provider.refresh();
    expect(s.pending.items.size).toBe(0);
  });
});
