import { BackendError, type BackendApi, type BeatRequest, type ReplyChunk, type SpineRequest } from '../api.ts';
import type { StoryRecord, StoryTurnRequest, StorytellerAvailability, TurnEvent } from '../storyteller.ts';
import { estimateSpeechMs, linesOf, lineIdOf, type Beat, type ReadyBeat, type Spine } from '../beats.ts';
import type { ShowEvent } from '../events.ts';
import type { CastMember, StageLibrary } from '../library.ts';
import { ROUTE_NAMES, type ErrorCode, type RouteName } from '../primitives.ts';
import type { StageAction } from '../stage-actions.ts';

export type MockFailure = 'upstream_failed' | 'quota_exceeded' | 'invalid_output' | 'moderated';

export interface MockOptions {
  latencyMs?: number | Partial<Record<RouteName, number>>;
  failure?: Partial<Record<RouteName, MockFailure>>;
  /** Inject a virtual clock so the simulator never really waits. */
  sleep?: (ms: number) => Promise<void>;
}

const everyRouteBut = (except: RouteName, failure: MockFailure): Partial<Record<RouteName, MockFailure>> =>
  Object.fromEntries(ROUTE_NAMES.filter((r) => r !== except).map((r) => [r, failure]));

export const MOCK_PROFILES: Record<'normal' | 'slow' | 'fail' | 'cap', MockOptions> = {
  normal: {},
  slow: { latencyMs: { planBeat: 8000, reactToObject: 8000, replyAsCharacter: 8000 } },
  fail: { failure: everyRouteBut('issueDevice', 'upstream_failed') },
  cap: { failure: everyRouteBut('issueDevice', 'quota_exceeded') },
};

const voiced = (library: StageLibrary): CastMember | undefined => library.cast.find((c) => c.voice !== null);

function ready(beat: Beat): ReadyBeat {
  return {
    beat,
    voice: Object.fromEntries(linesOf(beat).map((l) => [l.lineId, { url: null, durationMs: estimateSpeechMs(l.text) }])),
  };
}

/** Builds everything from the request's own library, so no cast is hard-coded here. */
export function createMockBackend(options: MockOptions = {}): BackendApi {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let counter = 0;
  const memory = new Map<string, ShowEvent[]>();

  const latency = async (route: RouteName): Promise<void> => {
    const { latencyMs } = options;
    const ms = typeof latencyMs === 'number' ? latencyMs : (latencyMs?.[route] ?? 0);
    if (ms > 0) await sleep(ms);
  };

  const failureOf = (route: RouteName) => options.failure?.[route];

  function fail(route: RouteName): void {
    const failure = failureOf(route);
    if (failure) throw new BackendError(failure, `mock ${failure} on ${route}`, failure === 'upstream_failed');
  }

  function freshLine(who: string, name: string, used: Set<string>): string {
    for (;;) {
      counter += 1;
      const text = `${name} thinks it over, moment ${counter}.`;
      if (!used.has(lineIdOf(who, text))) return text;
    }
  }

  function planBeatNow(request: BeatRequest): ReadyBeat {
    const { trigger, library, position } = request;
    const used = new Set(request.usedLineIds);
    const speaker = voiced(library);
    const actions: StageAction[] = [];

    if (speaker) {
      actions.push({ do: 'speak', withPrev: false, who: speaker.id, text: freshLine(speaker.id, speaker.name, used), mood: 'warm', to: null });
      if (speaker.acting.includes('look')) actions.push({ do: 'emote', withPrev: true, who: speaker.id, acting: 'look', target: 'reader' });
    } else {
      actions.push({ do: 'narrate', withPrev: false, text: freshLine('narrator', 'The narrator', used), mood: 'neutral' });
    }
    if (trigger.kind === 'gift') {
      actions.push({ do: 'use', withPrev: false, who: trigger.castId, object: trigger.objectId, on: null, problem: null });
    }

    counter += 1;
    const beat: Beat = {
      id: `mock-beat-${counter}`,
      source: 'director',
      sceneId: position.sceneId,
      estSeconds: 6,
      actions,
      next: null,
      replaces: trigger.kind === 'lookahead' ? position.cursor : null,
    };

    if (failureOf('planBeat') === 'invalid_output') {
      // Schema-valid but names a character nobody has, which is what a bad model output looks like.
      beat.actions = [{ do: 'speak', withPrev: false, who: 'no-such-cast', text: 'Who am I?', mood: 'neutral', to: null }];
    }
    return ready(beat);
  }

  function planSpineNow(request: SpineRequest): Spine {
    const { library } = request;
    const speaker = voiced(library);
    const set = library.sets[0];
    const tag = library.tags[0];
    if (!speaker || !set || !tag) throw new BackendError('invalid_output', 'the library is too empty to plan a story');
    counter += 1;
    const sceneId = `mock-scene-${counter}`;
    const problemId = `mock-problem-${counter}`;
    const authored = { source: 'authored', sceneId, replaces: null, next: null, estSeconds: 8 } as const;
    const ending = (id: string, outcome: string): Beat => ({
      ...authored,
      id,
      actions: [{ do: 'resolve', withPrev: false, problem: problemId, outcome }],
    });
    return {
      v: 1,
      id: `mock-spine-${counter}`,
      title: 'A mock story',
      premise: request.premise.kind === 'spoken' ? request.premise.text : `About ${request.premise.objectId}`,
      source: 'generated',
      targetSeconds: { min: 300, max: 420 },
      bridges: [],
      scenes: [
        {
          id: sceneId,
          setId: set.id,
          summary: 'A mock scene',
          objects: [],
          problem: {
            id: problemId,
            summary: 'A mock problem',
            rules: [{ id: 'mock-rule', anyTags: [tag.id], beat: 'solved', outcome: 'solved' }],
            fallback: { beat: 'failed' },
            ignored: { beat: 'ignored', afterSeconds: 20 },
          },
          entry: 'ask',
          beats: [
            {
              ...authored,
              id: 'ask',
              actions: [
                {
                  do: 'ask_reader',
                  withPrev: false,
                  who: speaker.id,
                  player: null,
                  problem: problemId,
                  text: `${speaker.name} looks up, hoping.`,
                  mood: 'tense',
                  opensDrawer: true,
                  waitSeconds: 12,
                },
              ],
            },
            ending('solved', 'solved with what was given'),
            ending('failed', 'got by without it'),
            ending('ignored', 'sorted itself out'),
          ],
        },
      ],
    };
  }

  async function* reply(route: RouteName, who: string, name: string): AsyncGenerator<ReplyChunk> {
    await latency(route);
    const failure = failureOf(route);
    if (failure === 'moderated') {
      yield { kind: 'redirect', text: 'The narrator turned the page, rather quickly.' };
      return;
    }
    if (failure) {
      yield { kind: 'error', code: failure satisfies ErrorCode, message: `mock ${failure} on ${route}` };
      return;
    }
    counter += 1;
    const text = `${name} has a think about that, moment ${counter}.`;
    yield { kind: 'delta', text: `${name} has a think` };
    yield { kind: 'final', line: { who, text, mood: 'warm' }, voice: { url: null, durationMs: estimateSpeechMs(text) }, changesScene: false };
  }

  /** The mock's stories, as the backend keeps them: three a day, forty turns each, a turn id once. */
  const STORIES_PER_DAY = 3;
  const stories = new Map<string, { record: StoryRecord; turns: number; titled: boolean }>();
  const startedBy = new Map<string, string>();
  const turnIds = new Set<string>();
  const nextMidnight = () => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
  };
  const availability = (): StorytellerAvailability => {
    const left = Math.max(0, STORIES_PER_DAY - stories.size);
    return { status: left > 0 ? 'ready' : 'used-today', storiesLeftToday: left, resetsAt: nextMidnight() };
  };

  /** One voiced beat from someone on the spread, then the cast turns to listen. The close ends the story. */
  async function* turn(request: StoryTurnRequest): AsyncGenerator<TurnEvent> {
    await latency('storyTurn');
    const story = stories.get(request.storyId);
    const turnKey = `${request.storyId}/${request.turnId}`;
    if (story && turnIds.has(turnKey)) {
      yield { kind: 'recover' };
      return;
    }
    turnIds.add(turnKey);
    if (story) story.turns += 1;
    const failure = failureOf('storyTurn');
    if (failure === 'moderated') {
      const text = 'The narrator turned the page, rather quickly.';
      yield { kind: 'redirect', text, voice: { url: null, durationMs: estimateSpeechMs(text) } };
      return;
    }
    if (failure) {
      yield { kind: 'error', code: failure, message: `mock ${failure} on storyTurn` };
      return;
    }
    const used = new Set(request.history.map((h) => lineIdOf(h.who, h.text)));
    const here = new Set(request.stage.cast.map((c) => c.id));
    const speaker = request.library.cast.find((c) => c.voice !== null && here.has(c.id)) ?? voiced(request.library);
    const actions: StageAction[] = speaker
      ? [{ do: 'speak', withPrev: false, who: speaker.id, text: freshLine(speaker.id, speaker.name, used), mood: 'warm', to: 'reader' }]
      : [{ do: 'narrate', withPrev: false, text: freshLine('narrator', 'The narrator', used), mood: 'neutral' }];
    counter += 1;
    yield { kind: 'beat', ready: ready({ id: `mock-turn-${counter}`, source: 'director', sceneId: null, estSeconds: 4, actions, next: null, replaces: null }) };
    if (request.input.kind === 'close') {
      yield { kind: 'ending', title: story?.record.title ?? 'Tonight\'s story', summary: 'The mock story came to a gentle end.' };
      return;
    }
    if (story && !story.titled && request.phase === 'welcome' && request.input.kind !== 'open') {
      story.titled = true;
      story.record = { ...story.record, title: `Mock story ${counter}`, updatedAt: new Date().toISOString() };
      yield { kind: 'titled', title: story.record.title };
    }
    yield { kind: 'listen', who: speaker?.id ?? null };
  }
  const jobs = new Map<string, string>();

  const nameOf = (library: StageLibrary, id: string) => library.cast.find((c) => c.id === id)?.name ?? id;
  const inAnHour = () => new Date(Date.now() + 3_600_000).toISOString();

  /** Waits, throws the configured failure, then runs the handler. */
  async function run<T>(route: RouteName, handler: () => T, failFirst = true): Promise<T> {
    await latency(route);
    if (failFirst) fail(route);
    return handler();
  }

  return {
    issueDevice: () =>
      run('issueDevice', () => {
        counter += 1;
        return { deviceId: `mock-device-${counter}`, token: `mock-token-${counter}`, expiresAt: inAnHour() };
      }),
    planBeat: (request) =>
      // invalid_output is the one failure that still returns a beat, so the validator path can be tested.
      run('planBeat', () => planBeatNow(request), failureOf('planBeat') !== 'invalid_output'),
    planSpine: (request) => run('planSpine', () => planSpineNow(request)),
    reactToObject: (request) => reply('reactToObject', request.castId, nameOf(request.library, request.castId)),
    replyAsCharacter: (request) => reply('replyAsCharacter', request.castId, nameOf(request.library, request.castId)),
    speakLine: (request) => run('speakLine', () => ({ url: null, durationMs: estimateSpeechMs(request.text) })),
    storytellerAvailability: () => run('storytellerAvailability', availability),
    startStory: (request) =>
      run('startStory', () => {
        const known = startedBy.get(request.requestId);
        if (!known) {
          if (stories.size >= STORIES_PER_DAY) throw new BackendError('quota_exceeded', "tonight's stories are told");
          counter += 1;
          const id = `mock-story-${counter}`;
          const now = new Date().toISOString();
          stories.set(id, { record: { id, title: "Tonight's story", summary: null, things: [], startedAt: now, endedAt: null, updatedAt: now }, turns: 0, titled: false });
          startedBy.set(request.requestId, id);
        }
        const storyId = startedBy.get(request.requestId)!;
        return { storyId, allowance: { turns: 40 - stories.get(storyId)!.turns, paintings: 6 }, availability: availability() };
      }),
    storyTurn: (request) => turn(request),
    endStory: (request) =>
      run('endStory', () => {
        const story = stories.get(request.storyId);
        if (!story) throw new BackendError('bad_request', 'no such story');
        if (!story.record.endedAt) {
          const now = new Date().toISOString();
          story.record = { ...story.record, ...request.page, endedAt: now, updatedAt: now };
        }
        return { record: story.record };
      }),
    listStories: () =>
      run('listStories', () => ({
        stories: [...stories.values()]
          .map((s) => s.record)
          .filter((r) => r.endedAt !== null || r.title !== "Tonight's story")
          .reverse(),
      })),
    paintProp: (request) =>
      run('paintProp', () => {
        const jobId = `mock-paint-${request.storyId}-${request.objectId}`;
        jobs.set(jobId, request.description);
        return { jobId };
      }),
    // A mock painting never finishes: the client's "couldn't find it" path is what it exercises.
    paintResult: (request) => run('paintResult', () => (jobs.has(request.jobId) ? { status: 'failed' as const, reason: 'the mock does not paint' } : { status: 'failed' as const, reason: 'no such job' })),
    soundEffect: (request) => run('soundEffect', () => ({ url: null, durationMs: request.seconds * 1000 })),
    // The mock hears nothing, so a dev build without keys shows "didn't catch that" and plays on by hand.
    transcribe: () => run('transcribe', () => ({ text: '' })),
    memoryAppend: (request) =>
      run('memoryAppend', () => {
        const log = memory.get(request.seriesId) ?? [];
        const known = new Set(log.map((e) => e.id));
        for (const event of request.events) {
          if (!known.has(event.id)) {
            log.push(event);
            known.add(event.id);
          }
        }
        memory.set(request.seriesId, log);
        const seqs = log.flatMap((e) => (e.seq === null ? [] : [e.seq]));
        return { lastSeq: seqs.length > 0 ? Math.max(...seqs) : null };
      }),
    memoryRead: (request) =>
      run('memoryRead', () => {
        const after = request.afterSeq ?? -1;
        const events = (memory.get(request.seriesId) ?? [])
          .filter((e) => (e.seq ?? -1) > after)
          .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
        return { events };
      }),
    memoryDelete: (request) =>
      run('memoryDelete', () => {
        const deleted = memory.get(request.seriesId)?.length ?? 0;
        memory.delete(request.seriesId);
        return { deleted };
      }),
    sendTelemetry: (request) => run('sendTelemetry', () => ({ accepted: request.events.length })),
  };
}
