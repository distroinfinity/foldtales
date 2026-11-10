import { describe, expect, test } from 'vitest';
import { eventTypes, ShowEvent } from '../src/events.ts';
import { estimateSpeechMs, linesOf, type ReadyBeat } from '../src/beats.ts';
import { fixtureLibrary, fixtureSpine } from '../src/mocks/fixtures.ts';
import type { ShowObject } from '../src/objects.ts';
import { RelayClientMessage, RelayServerMessage } from '../src/relay.ts';

const base = {
  v: 1,
  id: 'evt-1',
  seq: 4,
  seriesId: 'series',
  episodeId: 'ep-1',
  actor: { kind: 'app' },
  showMs: 1200,
  at: '2026-11-10T00:00:00.000Z',
};

const spine = fixtureSpine();
const beat = spine.scenes[0]!.beats[0]!;
const ready: ReadyBeat = {
  beat,
  voice: Object.fromEntries(linesOf(beat).map((l) => [l.lineId, { url: null, durationMs: estimateSpeechMs(l.text) }])),
};
const object: ShowObject = { id: 'string#a', def: fixtureLibrary().objects[1]!, owner: 'ann', origin: 'satchel', history: [] };
const player = { id: 'ann', name: 'Ann' };
const entry = { id: 'c1', kind: 'keepsake', text: 'The string stayed.', episodeId: 'ep-1', sourceEventId: 'evt-1' };
const page = { episodeId: 'ep-1', title: 'The brook', text: ['We crossed.'], art: [{ kind: 'asset', path: 'a.png' }], keepsakes: ['string#a'] };

const examples: Record<string, { valid: unknown; invalid: unknown }> = {
  'session.paused': { valid: { reason: 'book_closed' }, invalid: { reason: 'bored' } },
  'session.resumed': { valid: {}, invalid: { reason: 'x' } },
  'episode.started': {
    valid: { spine, libraryVersion: 'v1', objects: [object], players: [player] },
    invalid: { spine, libraryVersion: 'v1', players: [player] },
  },
  'episode.ended': { valid: { outcome: 'resolved', durationMs: 360000 }, invalid: { outcome: 'won', durationMs: 1 } },
  'beat.queued': { valid: { ready }, invalid: { ready: { beat } } },
  'beat.started': { valid: { beatId: 'ask', fallback: null }, invalid: { beatId: 'ask', fallback: 'tired' } },
  'beat.completed': { valid: { beatId: 'ask' }, invalid: {} },
  'beat.preempted': { valid: { beatId: 'ask', byEventId: 'evt-2' }, invalid: { beatId: 'ask' } },
  'entity.grabbed': { valid: { entity: 'object:string#a', playerId: 'ann' }, invalid: { entity: 'mark:stump', playerId: 'ann' } },
  'entity.placed': { valid: { entity: 'cast:bramble', playerId: 'ann', at: [0, 0, 0] }, invalid: { entity: 'cast:bramble', playerId: 'ann', at: [0, 0] } },
  'drawer.opened': { valid: { by: 'beat' }, invalid: { by: 'wind' } },
  'drawer.closed': { valid: {}, invalid: { by: 'beat' } },
  'object.added': { valid: { object }, invalid: { object: { id: 'x' } } },
  'object.handed': { valid: { objectId: 'string#a', toCast: 'bramble', playerId: 'ann' }, invalid: { objectId: 'string#a', playerId: 'ann' } },
  'object.used': { valid: { objectId: 'string#a', beatId: 'ask', problemId: null }, invalid: { objectId: 'string#a', beatId: 'ask' } },
  'object.kept': { valid: { objectId: 'string#a', playerId: 'ann', history: 'It held.' }, invalid: { objectId: 'string#a', playerId: 'ann', history: '' } },
  'problem.attempted': { valid: { problemId: 'p', objectId: 'string#a', playerId: 'ann', ruleId: null }, invalid: { problemId: 'p', objectId: 'string#a', playerId: 'ann' } },
  'problem.resolved': { valid: { problemId: 'p', outcome: 'crossed', objectId: null }, invalid: { problemId: 'p', objectId: null } },
  'talk.heard': { valid: { castId: 'bramble', playerId: 'ann', text: 'hello' }, invalid: { castId: 'bramble', playerId: 'ann' } },
  'canon.recorded': { valid: { entry }, invalid: { entry: { ...entry, kind: 'rumour' } } },
  'canon.reverted': { valid: { entryId: 'c1' }, invalid: {} },
  'page.composed': { valid: { page }, invalid: { page: { ...page, art: ['a.png'] } } },
  'player.joined': { valid: { player }, invalid: { player: { id: 'ann' } } },
  'player.left': { valid: { playerId: 'ann' }, invalid: {} },
  'host.changed': { valid: { playerId: 'ben', resumeBeatId: null }, invalid: { playerId: 'ben' } },
  'ownership.granted': { valid: { entity: 'object:string#a', playerId: 'ann' }, invalid: { entity: 'reader', playerId: 'ann' } },
  'ownership.released': { valid: { entity: 'object:string#a', playerId: 'ann' }, invalid: { entity: 'object:string#a' } },
  'speaker.locked': { valid: { playerId: 'ann', castId: 'bramble' }, invalid: { playerId: 'ann' } },
  'speaker.unlocked': { valid: { playerId: 'ann' }, invalid: {} },
  'fairness.credited': { valid: { playerId: 'ann', eventId: 'evt-1' }, invalid: { playerId: 'ann' } },
};

describe('ShowEvent', () => {
  test('every event type has a valid and an invalid example', () => {
    expect(new Set(Object.keys(examples))).toEqual(new Set(eventTypes));
  });
  test.each(eventTypes)('%s accepts its payload', (type) => {
    const parsed = ShowEvent.safeParse({ ...base, type, data: examples[type]!.valid });
    expect(parsed.error?.message).toBeUndefined();
  });
  test.each(eventTypes)('%s rejects a malformed payload', (type) => {
    expect(ShowEvent.safeParse({ ...base, type, data: examples[type]!.invalid }).success).toBe(false);
  });
  const resumed = { ...base, type: 'session.resumed', data: {} };
  test('a null seq is accepted, a negative one is not', () => {
    expect(ShowEvent.safeParse({ ...resumed, seq: null }).success).toBe(true);
    expect(ShowEvent.safeParse({ ...resumed, seq: -1 }).success).toBe(false);
  });
  test('an unknown type is rejected', () => {
    expect(ShowEvent.safeParse({ ...resumed, type: 'session.exploded' }).success).toBe(false);
  });
  test('a future v is rejected', () => {
    expect(ShowEvent.safeParse({ ...resumed, v: 2 }).success).toBe(false);
  });
  test('actors are a player, the app or the director', () => {
    expect(ShowEvent.safeParse({ ...resumed, actor: { kind: 'player', id: 'ann' } }).success).toBe(true);
    expect(ShowEvent.safeParse({ ...resumed, actor: { kind: 'director' } }).success).toBe(true);
    expect(ShowEvent.safeParse({ ...resumed, actor: { kind: 'player' } }).success).toBe(false);
  });
});

const pose = { position: [0, 1, 0], rotation: [0, 0, 0, 1] };
const event = { ...base, type: 'session.resumed', data: {} };

const clientMessages: Record<string, { valid: unknown; invalid: unknown }> = {
  join: { valid: { room: 'abc', player, afterSeq: null, startSeq: 10 }, invalid: { room: 'abc', player, afterSeq: null } },
  append: { valid: { event }, invalid: { event: {} } },
  pose: { valid: { part: 'head', ...pose }, invalid: { part: 'knee', ...pose } },
  request_grab: { valid: { entity: 'object:string#a' }, invalid: { entity: 'reader' } },
  release_grab: { valid: { entity: 'object:string#a' }, invalid: {} },
  request_speak: { valid: { castId: 'bramble' }, invalid: {} },
  release_speak: { valid: {}, invalid: { castId: 'bramble' } },
};
const serverMessages: Record<string, { valid: unknown; invalid: unknown }> = {
  joined: { valid: { room: 'abc', hostId: 'ann', players: [player], lastSeq: 9 }, invalid: { room: 'abc', hostId: 'ann', players: [player] } },
  event: { valid: { event }, invalid: {} },
  pose: { valid: { playerId: 'ann', part: 'object:string#a', ...pose }, invalid: { part: 'head', ...pose } },
  error: { valid: { code: 'grab_denied', message: 'held' }, invalid: { code: 'nope', message: 'held' } },
};

describe.each([
  ['client', RelayClientMessage, clientMessages],
  ['server', RelayServerMessage, serverMessages],
] as const)('relay %s messages', (_side, schema, table) => {
  test.each(Object.keys(table))('%s accepts', (kind) => {
    expect(schema.safeParse({ kind, ...(table[kind]!.valid as object) }).success).toBe(true);
  });
  test.each(Object.keys(table))('%s rejects a malformed message', (kind) => {
    expect(schema.safeParse({ kind, ...(table[kind]!.invalid as object) }).success).toBe(false);
  });
});
