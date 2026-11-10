import { beforeEach, describe, expect, test } from 'vitest';
import type { ShowEvent } from '../src/events.ts';
import { createMockRelay } from '../src/mocks/relay.ts';
import type { RelayClientMessage, RelayServerMessage } from '../src/relay.ts';

let relay: ReturnType<typeof createMockRelay>;

beforeEach(() => {
  relay = createMockRelay();
});

function client() {
  const inbox: RelayServerMessage[] = [];
  const connection = relay.connect((message) => inbox.push(message));
  return {
    inbox,
    send: (message: RelayClientMessage) => connection.send(message),
    close: () => connection.close(),
    events: () => inbox.flatMap((m) => (m.kind === 'event' ? [m.event] : [])),
    errors: () => inbox.flatMap((m) => (m.kind === 'error' ? [m.code] : [])),
  };
}

const ann = { id: 'ann', name: 'Ann' };
const ben = { id: 'ben', name: 'Ben' };
const open = (startSeq = 10) => {
  const c = client();
  c.send({ kind: 'join', room: 'room', player: ann, afterSeq: null, startSeq, seriesId: 'hosts-series' });
  return c;
};
const join = (player = ben, afterSeq: number | null = null) => {
  const c = client();
  c.send({ kind: 'join', room: 'room', player, afterSeq, startSeq: null, seriesId: null });
  return c;
};

function local(id: string): ShowEvent {
  return { v: 1, id, seq: null, seriesId: 'hosts-series', episodeId: 'ep', actor: { kind: 'player', id: 'ann' }, showMs: 5, at: '2026-11-10T00:00:00.000Z', type: 'session.resumed', data: {} };
}

describe('ordering', () => {
  test('the first joiner opens the room at startSeq and events count up from it', () => {
    const host = open(10);
    host.send({ kind: 'append', event: local('a') });
    expect(host.events().map((e) => e.seq)).toEqual([10, 11]);
    expect(host.events()[0]).toMatchObject({ type: 'player.joined', seriesId: 'hosts-series' });
  });

  test('every member receives events in the same order', () => {
    const host = open();
    const guest = join();
    host.send({ kind: 'append', event: local('a') });
    guest.send({ kind: 'append', event: local('b') });
    const tail = (c: ReturnType<typeof client>) => c.events().filter((e) => e.type === 'session.resumed').map((e) => [e.id, e.seq]);
    expect(tail(host)).toEqual(tail(guest));
    expect(tail(host)).toHaveLength(2);
  });

  test('a late joiner is replayed the log', () => {
    const host = open();
    host.send({ kind: 'append', event: local('a') });
    const guest = join();
    expect(guest.events().map((e) => e.id)).toContain('a');
  });

  test('joined reports the host, the players and the last seq', () => {
    open(10);
    const guest = join();
    expect(guest.inbox[0]).toMatchObject({ kind: 'joined', room: 'room', hostId: 'ann', lastSeq: 10 });
  });

  test('a reconnect with afterSeq replays only later events', () => {
    const host = open();
    const guest = join();
    host.send({ kind: 'append', event: local('a') });
    const seen = guest.events().at(-1)!.seq!;
    guest.close();
    host.send({ kind: 'append', event: local('b') });
    const back = join(ben, seen);
    const replayed = back.events().filter((e) => e.seq! <= seen);
    expect(replayed).toEqual([]);
    expect(back.events().map((e) => e.id)).toContain('b');
  });

  test('a duplicate append returns the existing seq and is not re-broadcast', () => {
    const host = open();
    const guest = join();
    host.send({ kind: 'append', event: local('a') });
    const first = host.events().find((e) => e.id === 'a')!;
    const guestCount = guest.events().length;
    host.send({ kind: 'append', event: local('a') });
    expect(host.events().at(-1)).toEqual(first);
    expect(guest.events()).toHaveLength(guestCount);
  });

  test('solo log, room, then the host continues from the relay seq', () => {
    // Solo history ended at seq 9, so the room opens at 10 and the host resumes after it.
    const host = open(10);
    host.send({ kind: 'append', event: local('a') });
    const seqs = host.events().map((e) => e.seq!);
    expect(Math.min(...seqs)).toBe(10);
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
    const nextSoloSeq = Math.max(...seqs) + 1;
    expect(nextSoloSeq).toBe(12);
  });

  test('a message before joining is a bad_message', () => {
    const c = client();
    c.send({ kind: 'release_speak' });
    expect(c.errors()).toEqual(['bad_message']);
  });

  test('a fifth player is refused', () => {
    open();
    join();
    join({ id: 'cam', name: 'Cam' });
    join({ id: 'dee', name: 'Dee' });
    expect(join({ id: 'eli', name: 'Eli' }).errors()).toEqual(['room_full']);
  });
});

describe('locks', () => {
  const types = (c: ReturnType<typeof client>) => c.events().map((e) => e.type);

  test('two grabs on one copy: first gets ownership.granted, second gets an error', () => {
    const host = open();
    const guest = join();
    host.send({ kind: 'request_grab', entity: 'object:string#a' });
    guest.send({ kind: 'request_grab', entity: 'object:string#a' });
    expect(host.events().at(-1)).toMatchObject({ type: 'ownership.granted', data: { entity: 'object:string#a', playerId: 'ann' } });
    expect(guest.errors()).toEqual(['grab_denied']);
  });

  test('two players with same-def copies can hold them at once', () => {
    const host = open();
    const guest = join();
    host.send({ kind: 'request_grab', entity: 'object:string#a' });
    guest.send({ kind: 'request_grab', entity: 'object:string#b' });
    expect(guest.errors()).toEqual([]);
    expect(types(host).filter((t) => t === 'ownership.granted')).toHaveLength(2);
  });

  test('a released copy can be grabbed by someone else', () => {
    const host = open();
    const guest = join();
    host.send({ kind: 'request_grab', entity: 'object:string#a' });
    host.send({ kind: 'release_grab', entity: 'object:string#a' });
    guest.send({ kind: 'request_grab', entity: 'object:string#a' });
    expect(guest.errors()).toEqual([]);
  });

  test('speaker lock is exclusive and released on leave', () => {
    const host = open();
    const guest = join();
    host.send({ kind: 'request_speak', castId: 'bramble' });
    guest.send({ kind: 'request_speak', castId: 'bramble' });
    expect(guest.errors()).toEqual(['speak_denied']);
    host.close();
    expect(types(guest)).toContain('speaker.unlocked');
    guest.send({ kind: 'request_speak', castId: 'bramble' });
    expect(guest.errors()).toEqual(['speak_denied']);
    expect(guest.events().at(-1)).toMatchObject({ type: 'speaker.locked', data: { playerId: 'ben' } });
  });

  test('a leaving player releases what it held', () => {
    const host = open();
    const guest = join();
    guest.send({ kind: 'request_grab', entity: 'object:string#a' });
    guest.close();
    expect(types(host)).toContain('ownership.released');
    host.send({ kind: 'request_grab', entity: 'object:string#a' });
    expect(host.errors()).toEqual([]);
  });
});

test('host leaving promotes another member with host.changed', () => {
  const host = open();
  const guest = join();
  host.close();
  expect(guest.events().map((e) => e.type)).toContain('player.left');
  expect(guest.events().at(-1)).toMatchObject({ type: 'host.changed', data: { playerId: 'ben', resumeBeatId: null } });
});

test('host.changed names the last completed beat', () => {
  const host = open();
  const guest = join();
  const completed: ShowEvent = { ...local('c'), type: 'beat.completed', data: { beatId: 'ask' } };
  host.send({ kind: 'append', event: completed });
  host.close();
  expect(guest.events().at(-1)).toMatchObject({ type: 'host.changed', data: { resumeBeatId: 'ask' } });
});

test('pose messages reach others and are not logged', () => {
  const host = open();
  const guest = join();
  const before = guest.events().length;
  host.send({ kind: 'pose', part: 'head', position: [0, 1, 0], rotation: [0, 0, 0, 1] });
  expect(guest.inbox.at(-1)).toMatchObject({ kind: 'pose', playerId: 'ann', part: 'head' });
  expect(guest.events()).toHaveLength(before);
  expect(host.inbox.some((m) => m.kind === 'pose')).toBe(false);
});

test('a malformed message is a bad_message', () => {
  const host = open();
  host.send({ kind: 'request_grab', entity: 'reader' } as RelayClientMessage);
  expect(host.errors()).toEqual(['bad_message']);
});

test('a player who reconnects is announced again', () => {
  const host = open();
  const guest = join();
  const seen = guest.events().at(-1)!.seq!;
  guest.close();
  join(ben, seen);
  expect(host.events().map((e) => e.type).filter((t) => t === 'player.joined')).toHaveLength(3);
});
