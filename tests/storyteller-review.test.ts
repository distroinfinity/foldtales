import { describe, expect, test } from 'vitest';
import { createMockBackend, fixtureLibrary } from '../contracts/src/mocks/index.ts';
import type { BackendApi, Beat, StoryTurnRequest, TurnEvent } from '../contracts/src/index.ts';
import storyteller from '../client/public/show/storyteller.json';
import { SHAPE, createStorySession, type StoryEnding } from '../client/src/storyteller/session.ts';
import { createStorytellerProvider, type ProviderDeps } from '../client/src/storyteller/provider.ts';
import { forgetReaderPending, type PendingStory } from '../client/src/storyteller/pending.ts';
import type { RecordedLines } from '../client/src/storyteller/recorded.ts';
import type { LiveScheduler } from '../client/src/storyteller/live.ts';
import type { SoundEngine } from '../client/src/sound/engine.ts';

/** Regression tests for Codex's review of PR #30, findings 7–10 (the client's side). */

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const RECORDED = storyteller.recorded as RecordedLines;

/** A live scheduler with a real queue: an interruption empties it. */
function queueLive() {
  let queue: Beat[] = [];
  let interrupts = 0;
  const live = {
    enqueue: (beat: Beat) => void queue.push(beat),
    enqueueSet: () => {},
    interrupt: () => {
      interrupts += 1;
      queue = [];
    },
    get idle() {
      return true;
    },
    setId: 'glade',
    timeline: () => [],
  } as unknown as LiveScheduler;
  const texts = () => queue.flatMap((b) => b.actions.flatMap((a) => (a.do === 'speak' || a.do === 'narrate' ? [a.text] : [])));
  return { live, texts, interrupts: () => interrupts, queue: () => queue };
}

const beat = (text: string): TurnEvent => ({
  kind: 'beat',
  ready: { beat: { id: `b-${text}`, source: 'director', sceneId: null, estSeconds: 2, actions: [{ do: 'narrate', withPrev: false, text, mood: 'warm' }], next: null, replaces: null }, voice: { [`narrator:${text}`]: { url: 'data:x', durationMs: 900 } } },
});

function session(stream: (r: StoryTurnRequest) => AsyncIterable<TurnEvent>, opts: { addLine?: () => Promise<boolean>; api?: BackendApi } = {}) {
  const clock = { ms: 0 };
  const q = queueLive();
  const ended: StoryEnding[] = [];
  const api = opts.api ?? createMockBackend();
  const s = createStorySession({
    withBackend: async (call) => call(api),
    stream: (r) => stream(r),
    live: q.live,
    sound: { addLine: opts.addLine ?? (async () => true) } as unknown as SoundEngine,
    library: fixtureLibrary(),
    objects: () => [],
    cast: () => [{ id: 'bramble', mark: 'stump', holding: null }],
    room: () => [],
    nowMs: () => clock.ms,
    onEnded: (e) => ended.push(e),
    recorded: RECORDED,
  });
  const run = async (seconds: number) => {
    for (let i = 0; i < seconds; i++) {
      clock.ms += 1000;
      s.frame();
      await tick();
      await tick();
    }
  };
  return { s, q, clock, ended, run };
}

describe('7: a forced stop', () => {
  test('end() clears what was queued: only the closing line and the closing light remain', async () => {
    const h = session(() =>
      (async function* () {
        yield beat('an old line still queued');
        yield { kind: 'listen', who: null } as TurnEvent;
      })(),
    );
    h.s.open();
    await h.run(1);
    expect(h.q.texts()).toContain('an old line still queued');
    await h.s.end();
    expect(h.q.texts()).not.toContain('an old line still queued');
    expect(h.q.texts()).toEqual([RECORDED['close-fallback']!.text]);
    expect(h.q.queue().at(-1)!.actions.some((a) => a.do === 'cue' && a.cue === 'beam')).toBe(true);
  });

  test("a close turn still decoding when the hard stop comes adds nothing after it", async () => {
    let release!: () => void;
    const decoding = new Promise<boolean>((r) => (release = () => r(true)));
    let closing = false;
    const h = session(
      (r) =>
        (async function* () {
          if (r.input.kind === 'close') {
            closing = true;
            yield beat('a closing line, too late');
            return;
          }
          yield { kind: 'listen', who: null } as TurnEvent;
        })(),
      { addLine: () => (closing ? decoding : Promise.resolve(true)) },
    );
    h.s.open();
    await h.run(SHAPE.closeAtS + 2);
    expect(closing).toBe(true);
    await h.run(SHAPE.hardStopS - SHAPE.closeAtS);
    expect(h.s.ended).toBe(true);
    release();
    await h.run(2);
    expect(h.q.texts()).not.toContain('a closing line, too late');
  });
});

describe('10: one ending', () => {
  test('a story ended by a limit: end() returns that same ending, settled', async () => {
    const h = session(() =>
      (async function* () {
        yield { kind: 'error', code: 'quota_exceeded', message: 'this story has ended' } as TurnEvent;
      })(),
    );
    h.s.open();
    await h.run(1);
    expect(h.ended).toHaveLength(1);
    const first = await Promise.race([h.s.end(), new Promise((r) => setTimeout(() => r('pending'), 200))]);
    expect(first).toEqual(h.ended[0]);
    expect(await h.s.end()).toBe(first);
  });

  test('the hard stop: end() afterwards resolves to the same ending', async () => {
    const h = session(() =>
      (async function* () {
        await new Promise(() => {});
      })(),
    );
    h.s.open();
    await h.run(SHAPE.hardStopS + 1);
    expect(await Promise.race([h.s.end(), new Promise((r) => setTimeout(() => r('pending'), 200))])).toEqual(h.ended[0]);
  });
});

describe('8 and 9: a reader change', () => {
  function provider() {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
    const items = new Map<string, PendingStory>();
    let gate: Promise<void> | null = null;
    const pending = {
      put: async (i: PendingStory) => {
        if (gate) await gate;
        items.set(i.id, i);
      },
      all: async () => {
        if (gate) await gate;
        return [...items.values()];
      },
      remove: async (id: string) => void items.delete(id),
    };
    const state = { reader: { id: 'ann' } as { id: string } | null, generation: 1 };
    const api = {
      storytellerAvailability: async () => ({ status: 'ready', storiesLeftToday: 3, resetsAt: '2026-11-17T00:00:00.000Z' }),
      listStories: async () => ({ stories: [{ id: 'st-ann', title: "Ann's private story", summary: 'Hers.', things: [], startedAt: '2026-11-16T20:00:00.000Z', endedAt: '2026-11-16T20:10:00.000Z', updatedAt: '2026-11-16T20:10:00.000Z' }] }),
      endStory: async (r: { storyId: string }) => ({ record: { id: r.storyId } }),
    } as unknown as BackendApi;
    const deps: ProviderDeps = {
      built: () => true,
      cachedReader: () => state.reader,
      session: async () => state.reader,
      lapsed: () => false,
      generation: () => state.generation,
      mic: async () => 'granted',
      backend: (call) => call(api),
      online: () => true,
      storage,
      pending,
    };
    const p = createStorytellerProvider(deps);
    let release!: () => void;
    return {
      p,
      map,
      items,
      state,
      hold: () => (gate = new Promise((r) => (release = () => ((gate = null), r())))),
      release: () => release(),
      switchTo: (id: string | null) => {
        state.reader = id ? { id } : null;
        state.generation += 1;
        map.delete('tt.storyteller.shelf.ann');
      },
    };
  }

  test("8: a refresh that was waiting when Ann signed out never shows or re-caches Ann's shelf", async () => {
    const t = provider();
    t.hold();
    const running = t.p.refresh();
    await tick();
    t.switchTo('bob');
    t.release();
    await running;
    expect(t.p.snapshot().finished.map((f) => f.title)).not.toContain("Ann's private story");
    expect(t.map.has('tt.storyteller.shelf.ann')).toBe(false);
  });

  test("9: a finished page being written when the reader changes doesn't stay behind", async () => {
    const t = provider();
    t.hold();
    const writing = t.p.recordFinished({ id: 'st-ann-2', title: 'Hers', lines: ['A.', 'B.'], things: [] });
    await tick();
    t.switchTo(null);
    t.release();
    await writing;
    expect(t.items.has('st-ann-2')).toBe(false);
    expect(t.p.snapshot().finished.map((f) => f.id)).not.toContain('st-ann-2');
  });

  test("9: sign-out and deletion remove that reader's waiting pages, and only theirs", async () => {
    const items = new Map<string, PendingStory>([
      ['a', { id: 'a', readerId: 'ann', page: { title: 'A', summary: null, things: [] }, endedAt: '' }],
      ['b', { id: 'b', readerId: 'bob', page: { title: 'B', summary: null, things: [] }, endedAt: '' }],
    ]);
    await forgetReaderPending('ann', { put: async () => {}, all: async () => [...items.values()], remove: async (id) => void items.delete(id) });
    expect([...items.keys()]).toEqual(['b']);
  });
});
