import { z } from 'zod';
import { ReadyBeat, SceneProblem, Spine, VoiceAsset } from './beats.ts';
import { CanonEntry, ShowEvent } from './events.ts';
import { StageLibrary } from './library.ts';
import { ShowObject } from './objects.ts';
import { ErrorCode, Id, Mood, type RouteName } from './primitives.ts';
import { EndStoryRequest, EndStoryResponse, ListStoriesResponse, PaintRequest, PaintResult, StartStoryRequest, StartStoryResponse, StoryTurnRequest, StorytellerAvailability, TranscribeRequest, TranscribeResponse, TurnEvent, isTurnEnd } from './storyteller.ts';
import { TelemetryBatch } from './telemetry.ts';
import { CONTRACT_VERSION } from './version.ts';

/**
 * The header every call carries. A change to any wire shape in this package bumps
 * CONTRACT_VERSION, additive or not, and is its own small PR.
 */
export const CONTRACT_HEADER = 'x-tabletop-contract';

export const Trigger = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('lookahead') }),
  z.strictObject({ kind: z.literal('gift'), objectId: Id, castId: Id, playerId: Id }),
  z.strictObject({ kind: z.literal('talk'), castId: Id, playerId: Id, text: z.string().min(1) }),
]);

/** This episode's durable state, reduced by the client, so an intervention can't age out of `recent`. */
export const ShowState = z.strictObject({
  problems: z.array(
    z.strictObject({
      problemId: Id,
      status: z.enum(['open', 'solved', 'failed', 'ignored']),
      objectId: Id.nullable(),
      ruleId: Id.nullable(),
    }),
  ),
  holding: z.array(z.strictObject({ castId: Id, objectId: Id })),
  used: z.array(Id),
});
export type ShowState = z.infer<typeof ShowState>;

export const BeatRequest = z.strictObject({
  episodeId: Id,
  spine: Spine,
  library: StageLibrary,
  objects: z.array(ShowObject),
  position: z.strictObject({ sceneId: Id, cursor: Id.nullable(), elapsedSeconds: z.number().nonnegative() }),
  show: ShowState,
  canon: z.array(CanonEntry),
  recent: z.array(ShowEvent).max(40),
  trigger: Trigger,
  usedLineIds: z.array(z.string()),
  owedPlayers: z.array(Id),
});
export type BeatRequest = z.infer<typeof BeatRequest>;

export const Premise = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('object'), objectId: Id }),
  z.strictObject({ kind: z.literal('spoken'), text: z.string().min(1) }),
]);

export const SpineRequest = z.strictObject({
  seriesId: Id,
  library: StageLibrary,
  objects: z.array(ShowObject),
  canon: z.array(CanonEntry),
  premise: Premise,
});
export type SpineRequest = z.infer<typeof SpineRequest>;

export const ObjectReactRequest = z.strictObject({
  objectId: Id,
  castId: Id,
  problem: SceneProblem.nullable(),
  library: StageLibrary,
  objects: z.array(ShowObject),
  canon: z.array(CanonEntry),
});
export type ObjectReactRequest = z.infer<typeof ObjectReactRequest>;

export const CharacterReplyRequest = z.strictObject({
  castId: Id,
  playerId: Id,
  heard: z.string().min(1),
  sceneSummary: z.string(),
  library: StageLibrary,
  objects: z.array(ShowObject),
  canon: z.array(CanonEntry),
  recent: z.array(ShowEvent).max(40),
});
export type CharacterReplyRequest = z.infer<typeof CharacterReplyRequest>;

/** A stream ends with exactly one of final, redirect or error. */
export const ReplyChunk = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('delta'), text: z.string() }),
  z.strictObject({
    kind: z.literal('final'),
    line: z.strictObject({ who: Id, text: z.string().min(1), mood: Mood }),
    voice: VoiceAsset.nullable(),
    changesScene: z.boolean(),
  }),
  /** Moderation's in-story narrator line. */
  z.strictObject({ kind: z.literal('redirect'), text: z.string().min(1) }),
  z.strictObject({ kind: z.literal('error'), code: ErrorCode, message: z.string() }),
]);
export type ReplyChunk = z.infer<typeof ReplyChunk>;

export const isTerminal = (chunk: ReplyChunk): boolean => chunk.kind !== 'delta';

const empty = z.strictObject({});

export const routes = {
  issueDevice: {
    path: '/v1/device',
    request: empty,
    response: z.strictObject({ deviceId: z.string().min(1), token: z.string().min(1), expiresAt: z.iso.datetime() }),
  },
  planBeat: { path: '/v1/director/beat', request: BeatRequest, response: ReadyBeat },
  planSpine: { path: '/v1/director/spine', request: SpineRequest, response: Spine },
  reactToObject: { path: '/v1/objects/react', request: ObjectReactRequest, stream: ReplyChunk },
  replyAsCharacter: { path: '/v1/characters/reply', request: CharacterReplyRequest, stream: ReplyChunk },
  /** The door's view, for the signed-in reader. Reserves nothing. */
  storytellerAvailability: { path: '/v1/storyteller/availability', request: empty, response: StorytellerAvailability },
  startStory: { path: '/v1/storyteller/start', request: StartStoryRequest, response: StartStoryResponse },
  storyTurn: { path: '/v1/storyteller/turn', request: StoryTurnRequest, stream: TurnEvent },
  endStory: { path: '/v1/storyteller/end', request: EndStoryRequest, response: EndStoryResponse },
  /** The reader's shelf. */
  listStories: { path: '/v1/storyteller/stories', request: empty, response: ListStoriesResponse },
  paintProp: { path: '/v1/storyteller/paint', request: PaintRequest, response: z.strictObject({ jobId: Id }) },
  paintResult: { path: '/v1/storyteller/paint/result', request: z.strictObject({ jobId: Id }), response: PaintResult },
  soundEffect: {
    path: '/v1/storyteller/sound',
    request: z.strictObject({ storyId: Id, description: z.string().min(1).max(200), seconds: z.number().min(0.5).max(6) }),
    response: VoiceAsset,
  },
  speakLine: {
    path: '/v1/voice/line',
    request: z.strictObject({ speaker: Id, text: z.string().min(1), mood: Mood }),
    response: VoiceAsset,
  },
  /** Hold to talk: the clip goes to the backend, which returns the words. The headset never holds a speech vendor's token. */
  transcribe: { path: '/v1/storyteller/transcribe', request: TranscribeRequest, response: TranscribeResponse },
  memoryAppend: {
    path: '/v1/memory/append',
    request: z.strictObject({ seriesId: Id, events: z.array(ShowEvent) }),
    response: z.strictObject({ lastSeq: z.number().int().nonnegative().nullable() }),
  },
  memoryRead: {
    path: '/v1/memory/read',
    request: z.strictObject({ seriesId: Id, afterSeq: z.number().int().nonnegative().nullable() }),
    response: z.strictObject({ events: z.array(ShowEvent) }),
  },
  memoryDelete: {
    path: '/v1/memory/delete',
    request: z.strictObject({ seriesId: Id }),
    response: z.strictObject({ deleted: z.number().int().nonnegative() }),
  },
  sendTelemetry: {
    path: '/v1/telemetry',
    request: TelemetryBatch,
    response: z.strictObject({ accepted: z.number().int().nonnegative() }),
  },
} as const satisfies Record<RouteName, { path: string; request: z.ZodType } & ({ response: z.ZodType } | { stream: typeof ReplyChunk | typeof TurnEvent })>;

type Routes = typeof routes;

export type BackendApi = {
  [K in RouteName]: Routes[K] extends { stream: z.ZodType }
    ? (request: z.input<Routes[K]['request']>) => AsyncIterable<z.output<Routes[K]['stream']>>
    : Routes[K] extends { response: z.ZodType }
      ? (request: z.input<Routes[K]['request']>) => Promise<z.output<Routes[K]['response']>>
      : never;
};

export const ErrorBody = z.strictObject({
  error: z.strictObject({ code: ErrorCode, retryable: z.boolean(), message: z.string() }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

export class BackendError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
    this.retryable = retryable;
  }
}

export interface HttpBackendOptions {
  baseUrl: string;
  token?: string;
  fetch?: typeof fetch;
}

async function errorFrom(response: Response): Promise<BackendError> {
  const text = await response.text().catch(() => '');
  try {
    const { error } = ErrorBody.parse(JSON.parse(text));
    return new BackendError(error.code, error.message, error.retryable);
  } catch {
    return new BackendError('upstream_failed', `backend answered ${response.status}`, true);
  }
}

const errorChunk = (code: ErrorCode, message: string): ReplyChunk => ({ kind: 'error', code, message });

/** The same BackendApi as the mock, over HTTP. Stream methods never throw. */
export function createHttpBackend(options: HttpBackendOptions): BackendApi {
  const send = options.fetch ?? ((input, init) => fetch(input, init));

  const post = (path: string, body: unknown, accept: string): Promise<Response> =>
    send(`${options.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept,
        [CONTRACT_HEADER]: String(CONTRACT_VERSION),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  async function call(route: { path: string; response: z.ZodType }, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await post(route.path, body, 'application/json');
    } catch (cause) {
      throw new BackendError('upstream_failed', `network failure: ${String(cause)}`, true);
    }
    if (!response.ok) throw await errorFrom(response);
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new BackendError('invalid_output', `${route.path} did not return JSON`);
    }
    const parsed = route.response.safeParse(value);
    if (!parsed.success) throw new BackendError('invalid_output', `${route.path} returned the wrong shape`);
    return parsed.data;
  }

  /** Both stream types end in the same error shape. */
  async function* stream<C extends { kind: string }>(path: string, body: unknown, schema: z.ZodType<C>, ends: (chunk: C) => boolean): AsyncGenerator<C> {
    const fail = (code: ErrorCode, message: string): C => errorChunk(code, message) as unknown as C;
    let response: Response;
    try {
      response = await post(path, body, 'text/event-stream');
    } catch (cause) {
      yield fail('upstream_failed', `network failure: ${String(cause)}`);
      return;
    }
    if (!response.ok) {
      const error = await errorFrom(response);
      yield fail(error.code, error.message);
      return;
    }
    if (!response.body) {
      yield fail('upstream_failed', `${path} sent no body`);
      return;
    }
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value.replaceAll('\r\n', '\n');
        for (let end = buffer.indexOf('\n\n'); end !== -1; end = buffer.indexOf('\n\n')) {
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n');
          if (data === '') continue;
          let chunk: C;
          try {
            chunk = schema.parse(JSON.parse(data));
          } catch {
            yield fail('invalid_output', `${path} sent a bad chunk`);
            return;
          }
          yield chunk;
          if (ends(chunk)) return;
        }
      }
    } catch (cause) {
      yield fail('upstream_failed', `stream broke: ${String(cause)}`);
      return;
    } finally {
      reader.cancel().catch(() => {});
    }
    yield fail('upstream_failed', `${path} closed without a final chunk`);
  }

  const api: Record<string, unknown> = {};
  for (const [name, route] of Object.entries(routes)) {
    api[name] =
      'stream' in route
        ? route.stream === TurnEvent
          ? (body: unknown) => stream(route.path, body, TurnEvent, isTurnEnd)
          : (body: unknown) => stream(route.path, body, ReplyChunk, isTerminal)
        : (body: unknown) => call(route, body);
  }
  return api as BackendApi;
}
