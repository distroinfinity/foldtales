import { createMockBackend, fixtureLibrary, MOCK_PROFILES, type MockOptions } from '../contracts/src/mocks/index.ts';
import type { BackendApi, Beat, StoryTurnRequest, TurnEvent } from '../contracts/src/index.ts';
import { describe, expect, test } from 'vitest';
import storyteller from '../client/public/show/storyteller.json';
import { RECORDED_IDS, type RecordedId, type RecordedLines } from '../client/src/storyteller/recorded.ts';

const RECORDED = storyteller.recorded as Record<RecordedId, { speaker: string; text: string }>;
import { SHAPE, UNTITLED, createStorySession, type StoryEnding } from '../client/src/storyteller/session.ts';
import type { LiveScheduler } from '../client/src/storyteller/live.ts';
import type { SoundEngine } from '../client/src/sound/engine.ts';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A live scheduler that plays everything at once, recording what it was given. */
function fakeLive() {
  const played: Array<{ kind: 'beat'; beat: Beat } | { kind: 'set'; setId: string }> = [];
  let setId = 'glade';
  const live = {
    enqueue: (beat: Beat) => void played.push({ kind: 'beat', beat }),
    enqueueSet: (id: string) => {
      played.push({ kind: 'set', setId: id });
      setId = id;
    },
    interrupt: () => {},
    get idle() {
      return true;
    },
    get setId() {
      return setId;
    },
    timeline: () => [],
  } as unknown as LiveScheduler;
  const said = () => played.flatMap((p) => (p.kind === 'beat' ? p.beat.actions.flatMap((a) => (a.do === 'speak' || a.do === 'narrate' ? [a.text] : [])) : []));
  return { live, played, said };
}

function harness(options: { api?: BackendApi; mock?: MockOptions; stream?: (r: StoryTurnRequest) => AsyncIterable<TurnEvent> | null } = {}) {
  const api = options.api ?? createMockBackend(options.mock ?? {});
  const clock = { ms: 0 };
  const { live, played, said } = fakeLive();
  const requests: StoryTurnRequest[] = [];
  const ended: StoryEnding[] = [];
  const errors: string[] = [];
  const session = createStorySession({
    withBackend: async (call) => call(api),
    stream: (request) => {
      requests.push(request);
      return options.stream ? options.stream(request) : api.storyTurn(request);
    },
    live,
    sound: { addLine: async () => true } as unknown as SoundEngine,
    library: fixtureLibrary(),
    objects: () => [],
    cast: () => [{ id: 'bramble', mark: 'stump', holding: null }],
    room: () => [],
    nowMs: () => clock.ms,
    onEnded: (e) => ended.push(e),
    onError: (code, message) => errors.push(`${code}: ${message}`),
    recorded: RECORDED as RecordedLines,
  });
  /** Moves the show clock on, a second at a time, letting the story answer between. */
  const run = async (seconds: number) => {
    for (let i = 0; i < seconds; i++) {
      clock.ms += 1000;
      session.frame();
      await tick();
      await tick();
    }
  };
  return { session, clock, played, said, requests, ended, errors, run };
}

describe('a story without a word', () => {
  test('waits at the welcome, carries itself on, winds down at 8:00, and ends by 10:00 on its own page', async () => {
    const h = harness();
    h.session.open();
    await h.run(SHAPE.closeAtS + 15);
    const phases = h.requests.map((r) => r.phase);
    const inputs = h.requests.map((r) => r.input.kind);
    expect(inputs[0]).toBe('open');
    // The first quiet comes after the welcome's 30 s, at the welcome; it names the story.
    expect(inputs[1]).toBe('quiet');
    expect(h.requests[1]!.activeSeconds).toBeGreaterThanOrEqual(SHAPE.quietWelcomeMs / 1000);
    expect(phases[1]).toBe('welcome');
    expect(phases).toContain('middle');
    expect(phases).toContain('closing');
    expect(inputs.at(-1)).toBe('close');
    expect(new Set(h.requests.map((r) => r.turnId)).size).toBe(h.requests.length);
    expect(new Set(h.requests.map((r) => r.storyId)).size).toBe(1);
    expect(h.session.ended).toBe(true);
    expect(h.ended).toHaveLength(1);
    expect(h.ended[0]!.title).toMatch(/^Mock story/);
    expect(h.ended[0]!.lines.length).toBeGreaterThanOrEqual(1);
    // The closing light and the beam always play.
    expect(h.played.some((p) => p.kind === 'beat' && p.beat.actions.some((a) => a.do === 'cue' && a.cue === 'beam'))).toBe(true);
  });

  test('with the service failing (no story reserved), it greets once from the recording, then rests and ends: no repeated filler', async () => {
    const h = harness({ mock: MOCK_PROFILES.fail });
    h.session.open();
    await h.run(SHAPE.hardStopS + 5);
    expect(h.session.ended).toBe(true);
    expect(h.ended[0]).toMatchObject({ title: UNTITLED });
    expect(h.ended[0]!.lines).toHaveLength(3);
    expect(h.said().filter((t) => t === RECORDED['welcome-fallback'].text)).toHaveLength(1);
    expect(h.said()).toContain(RECORDED.resting.text);
    // It rests after three tries, long before the clock would have ended it.
    expect(h.requests.length).toBe(0);
  });

  test('offline from the start: said once, then quiet; the clock still brings the ending', async () => {
    const h = harness({ api: { ...createMockBackend(), startStory: () => Promise.reject(Object.assign(new Error('network failure: offline'), { code: 'upstream_failed' })) } as BackendApi });
    h.session.open();
    await h.run(SHAPE.hardStopS + 5);
    expect(h.session.ended).toBe(true);
    const said = h.said();
    expect(said.filter((t) => t === RECORDED['welcome-fallback'].text)).toHaveLength(1);
    expect(said.filter((t) => t === RECORDED.offline.text)).toHaveLength(0);
    expect(said).not.toContain(RECORDED.resting.text);
  });

  test('with speech recognition down, the same story still ends: nothing in it needs speech', async () => {
    // Speech down means no `heard` ever reaches the session; the clock and the quiet turns carry it.
    const h = harness();
    h.session.open();
    await h.run(SHAPE.closeAtS + 15);
    expect(h.requests.some((r) => r.input.kind === 'heard')).toBe(false);
    expect(h.session.ended).toBe(true);
  });
});

describe('the shape', () => {
  test('turn 40 closes the story', async () => {
    const h = harness();
    h.session.open();
    await h.run(2);
    for (let i = 0; i < SHAPE.closeTurn; i++) {
      h.session.heard(`line number ${i}`);
      await h.run(1);
    }
    await h.run(3);
    expect(h.requests.filter((r) => r.input.kind !== 'close').length).toBeLessThanOrEqual(SHAPE.closeTurn);
    expect(h.requests.at(-1)!.input).toMatchObject({ kind: 'close', reason: 'turns' });
    expect(h.session.ended).toBe(true);
  });

  test('a paused clock never ends the story', async () => {
    const h = harness();
    h.session.open();
    await h.run(5);
    for (let i = 0; i < 50; i++) {
      h.session.frame();
      await tick();
    }
    expect(h.session.ended).toBe(false);
  });

  test('11:00 is a hard stop, even mid-performance', async () => {
    let calls = 0;
    // A stream that never ends: the story is "performing" for ever.
    const h = harness({
      stream: () => {
        calls += 1;
        return (async function* () {
          await new Promise(() => {});
        })();
      },
    });
    h.session.open();
    await h.run(SHAPE.hardStopS + 2);
    expect(h.session.ended).toBe(true);
    expect(h.said()).toContain(RECORDED['close-time'].text);
    expect(calls).toBeGreaterThan(0);
  });

  test('after the end, nothing more is sent or played', async () => {
    const h = harness();
    h.session.open();
    await h.run(2);
    await h.session.end();
    const sent = h.requests.length;
    const played = h.played.length;
    h.session.heard('are you still there');
    h.session.gift('tin-whistle', 'bramble');
    await h.run(60);
    expect(h.requests.length).toBe(sent);
    expect(h.played.length).toBe(played);
  });
});

describe('end()', () => {
  test('ends at once with no network, with a page of two or three lines', async () => {
    const h = harness({ api: { ...createMockBackend(), startStory: () => Promise.reject(Object.assign(new Error('offline'), { code: 'upstream_failed' })) } as BackendApi });
    h.session.open();
    await h.run(1);
    const ending = await h.session.end();
    expect(ending.title).toBe(UNTITLED);
    expect(ending.lines.length).toBeGreaterThanOrEqual(2);
    expect(ending.lines.length).toBeLessThanOrEqual(3);
    expect(h.said()).toContain(RECORDED['close-fallback'].text);
    // end() never calls onEnded; the host has the ending already.
    expect(h.ended).toHaveLength(0);
  });

  test('keeps the title the story was given', async () => {
    const h = harness();
    h.session.open();
    await h.run(1);
    h.session.heard('a whistle that lost its song');
    await h.run(1);
    expect(h.session.title()).toMatch(/^Mock story/);
    expect((await h.session.end()).title).toBe(h.session.title());
  });
});

describe('suspend and resume', () => {
  function controlled() {
    const queue: TurnEvent[] = [];
    let wake: (() => void) | null = null;
    const push = (e: TurnEvent) => {
      queue.push(e);
      wake?.();
    };
    const stream = () =>
      (async function* () {
        for (;;) {
          while (queue.length) {
            const e = queue.shift()!;
            yield e;
            if (e.kind === 'listen') return;
          }
          await new Promise<void>((r) => (wake = r));
        }
      })();
    return { push, stream };
  }
  const beat = (text: string): TurnEvent => ({
    kind: 'beat',
    ready: { beat: { id: `b-${text}`, source: 'director', sceneId: null, estSeconds: 2, actions: [{ do: 'narrate', withPrev: false, text, mood: 'warm' }], next: null, replaces: null }, voice: {} },
  });

  test('holds a turn while suspended, then plays it in order', async () => {
    const c = controlled();
    const h = harness({ stream: c.stream });
    h.session.open();
    await h.run(1);
    h.session.suspend();
    c.push(beat('one'));
    c.push(beat('two'));
    await h.run(3);
    expect(h.said()).not.toContain('one');
    h.session.resume();
    c.push({ kind: 'listen', who: null });
    await h.run(1);
    const said = h.said();
    expect(said.indexOf('one')).toBeGreaterThanOrEqual(0);
    expect(said.indexOf('one')).toBeLessThan(said.indexOf('two'));
  });

  test('dispose while suspended drops what was held', async () => {
    const c = controlled();
    const h = harness({ stream: c.stream });
    h.session.open();
    await h.run(1);
    h.session.suspend();
    c.push(beat('held'));
    await h.run(1);
    h.session.dispose();
    h.session.resume();
    await h.run(2);
    expect(h.said()).not.toContain('held');
  });

  test('a suspended story keeps its clock still in the session, and frame does nothing', async () => {
    const h = harness();
    h.session.open();
    await h.run(1);
    h.session.suspend();
    await h.run(SHAPE.hardStopS + 5);
    // The host stops the show clock too; here the clock moved, but a suspended story still never ends itself.
    expect(h.session.ended).toBe(false);
  });
});

describe('in story, never silent', () => {
  test('a turn that already ran recovers with the recorded line, and moves on', async () => {
    const h = harness({ stream: () => (async function* () { yield { kind: 'recover' } as TurnEvent; })() });
    h.session.open();
    await h.run(1);
    expect(h.said()).toContain(RECORDED.slow.text);
    expect(h.session.state).toBe('listening');
  });

  test('a redirect drops the words that led to it, plays the recording and really turns the page', async () => {
    let n = 0;
    const h = harness({
      stream: () =>
        (async function* () {
          n += 1;
          yield (n === 1 ? { kind: 'listen', who: null } : { kind: 'redirect', text: 'x', voice: { url: null, durationMs: 1 } }) as TurnEvent;
        })(),
    });
    // A story on another set, so the cozy one is a real turn.
    h.session.open();
    await h.run(1);
    h.session.heard('something unkind');
    await h.run(1);
    expect(h.said()).toContain(RECORDED['redirect-a'].text);
    h.session.heard('next thing');
    await h.run(1);
    expect(h.requests.at(-1)!.history.some((l) => l.text === 'something unkind')).toBe(false);
  });

  test('a closing turn that a check stops just ends: no "page turned" at the very end (live voice proof, Nov 17)', async () => {
    const h = harness({
      stream: (request: { input: { kind: string } }) =>
        (async function* () {
          yield (request.input.kind === 'close' ? { kind: 'redirect', text: 'x', voice: { url: null, durationMs: 1 } } : { kind: 'listen', who: null }) as TurnEvent;
        })(),
    });
    h.session.open();
    await h.run(SHAPE.hardStopS + 15);
    expect(h.requests.some((r) => r.input.kind === 'close')).toBe(true);
    expect(h.session.ended).toBe(true);
    expect(h.said()).not.toContain(RECORDED['redirect-a'].text);
  });

  test('tonight\'s limit mid-story ends it properly, with the recording', async () => {
    const h = harness({ stream: () => (async function* () { yield { kind: 'error', code: 'quota_exceeded', message: 'this story has ended' } as TurnEvent; })() });
    h.session.open();
    await h.run(1);
    expect(h.session.ended).toBe(true);
    expect(h.ended).toHaveLength(1);
    expect(h.said()).toContain(RECORDED['close-time'].text);
  });

  test('offline says so once, and the light coming back is said too', async () => {
    let online = false;
    const h = harness({
      stream: () =>
        online
          ? (async function* () {
              yield {
                kind: 'beat',
                ready: { beat: { id: 'b1', source: 'director', sceneId: null, estSeconds: 1, actions: [{ do: 'narrate', withPrev: false, text: 'Back again.', mood: 'warm' }], next: null, replaces: null }, voice: {} },
              } as TurnEvent;
              yield { kind: 'listen', who: null } as TurnEvent;
            })()
          : (async function* () {
              yield { kind: 'error', code: 'upstream_failed', message: 'network failure: offline' } as TurnEvent;
            })(),
    });
    h.session.open();
    await h.run(1);
    h.session.heard('hello there');
    await h.run(1);
    expect(h.said().filter((t) => t === RECORDED.offline.text)).toHaveLength(0);
    expect(h.said()).toContain(RECORDED['welcome-fallback'].text);
    online = true;
    h.session.heard('hello again');
    await h.run(1);
    expect(h.said()).toContain(RECORDED.online.text);
  });
});

describe('the recorded lines', () => {
  test("the book's data has every line, word for word as run 023 records them", async () => {
    const { readFileSync } = await import('node:fs');
    const plan = JSON.parse(readFileSync(new URL('../art/runs/023-storyteller-lines/plan.json', import.meta.url), 'utf8')) as { lineJobs: Array<{ id: string; speaker: string; text: string }> };
    expect(plan.lineJobs.map((j) => j.id).sort()).toEqual([...RECORDED_IDS].sort());
    for (const job of plan.lineJobs) expect(RECORDED[job.id as RecordedId]).toEqual({ speaker: job.speaker, text: job.text });
  });
});
