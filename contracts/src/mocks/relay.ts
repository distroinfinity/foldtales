import type { ShowEvent } from '../events.ts';
import { MAX_ROOM_PLAYERS, RelayClientMessage, type RelayServerMessage } from '../relay.ts';
import type { Player } from '../primitives.ts';

type Send = (message: RelayServerMessage) => void;

interface Room {
  name: string;
  seriesId: string;
  hostId: string;
  nextSeq: number;
  members: Map<string, { player: Player; send: Send }>;
  log: ShowEvent[];
  byId: Map<string, ShowEvent>;
  grabs: Map<string, string>;
  speaker: string | null;
  lastCompletedBeat: string | null;
}

export interface MockRelayConnection {
  send(message: RelayClientMessage): void;
  close(): void;
}

/** In-process, with the ordering and lock semantics a real relay must keep. */
export function createMockRelay(): { connect(onMessage: Send): MockRelayConnection } {
  const rooms = new Map<string, Room>();
  let generated = 0;

  function broadcast(room: Room, event: ShowEvent): void {
    for (const { send } of room.members.values()) send({ kind: 'event', event });
  }

  function order(room: Room, event: ShowEvent): ShowEvent {
    const ordered = { ...event, seq: room.nextSeq } as ShowEvent;
    room.nextSeq += 1;
    room.log.push(ordered);
    room.byId.set(ordered.id, ordered);
    if (ordered.type === 'beat.completed') room.lastCompletedBeat = ordered.data.beatId;
    broadcast(room, ordered);
    return ordered;
  }

  /** Appends an event the relay itself originated, in the room's latest episode and show time. */
  function announce(room: Room, body: Pick<ShowEvent, 'type' | 'data'>): void {
    const latest = room.log.at(-1);
    generated += 1;
    order(room, {
      v: 1,
      id: `relay-${generated}`,
      seq: null,
      seriesId: room.seriesId,
      episodeId: latest?.episodeId ?? null,
      actor: { kind: 'app' },
      showMs: latest?.showMs ?? 0,
      at: new Date().toISOString(),
      ...body,
    } as ShowEvent);
  }

  function leave(room: Room, playerId: string): void {
    room.members.delete(playerId);
    for (const [entity, owner] of room.grabs) {
      if (owner === playerId) {
        room.grabs.delete(entity);
        announce(room, { type: 'ownership.released', data: { entity, playerId } });
      }
    }
    if (room.speaker === playerId) {
      room.speaker = null;
      announce(room, { type: 'speaker.unlocked', data: { playerId } });
    }
    announce(room, { type: 'player.left', data: { playerId } });
    const next = room.members.keys().next().value;
    if (room.hostId === playerId && next !== undefined) {
      room.hostId = next;
      announce(room, { type: 'host.changed', data: { playerId: next, resumeBeatId: room.lastCompletedBeat } });
    }
  }

  return {
    connect(onMessage) {
      let joined: { room: Room; playerId: string } | null = null;
      const error = (code: Extract<RelayServerMessage, { kind: 'error' }>['code'], message: string) =>
        onMessage({ kind: 'error', code, message });

      function join(message: Extract<RelayClientMessage, { kind: 'join' }>): void {
        let room = rooms.get(message.room);
        if (!room) {
          room = {
            name: message.room,
            seriesId: message.seriesId ?? 'unknown-series',
            hostId: message.player.id,
            nextSeq: message.startSeq ?? 1,
            members: new Map(),
            log: [],
            byId: new Map(),
            grabs: new Map(),
            speaker: null,
            lastCompletedBeat: null,
          };
          rooms.set(message.room, room);
        }
        const arriving = !room.members.has(message.player.id);
        if (arriving && room.members.size >= MAX_ROOM_PLAYERS) {
          error('room_full', `${message.room} is full`);
          return;
        }
        if (room.members.size === 0) room.hostId = message.player.id;
        room.members.set(message.player.id, { player: message.player, send: onMessage });
        joined = { room, playerId: message.player.id };
        announceJoin(room, message, arriving);
      }

      function announceJoin(room: Room, message: Extract<RelayClientMessage, { kind: 'join' }>, arriving: boolean): void {
        const after = message.afterSeq ?? -1;
        const backlog = room.log.filter((e) => (e.seq ?? -1) > after);
        onMessage({
          kind: 'joined',
          room: room.name,
          hostId: room.hostId,
          players: [...room.members.values()].map((m) => m.player),
          lastSeq: room.log.at(-1)?.seq ?? null,
        });
        for (const event of backlog) onMessage({ kind: 'event', event });
        if (arriving) announce(room, { type: 'player.joined', data: { player: message.player } });
      }

      return {
        send(raw) {
          const parsed = RelayClientMessage.safeParse(raw);
          if (!parsed.success) {
            error('bad_message', 'that message does not match the contract');
            return;
          }
          const message = parsed.data;
          if (message.kind === 'join') {
            join(message);
            return;
          }
          if (!joined) {
            error('bad_message', 'join a room first');
            return;
          }
          const { room, playerId } = joined;
          switch (message.kind) {
            case 'append': {
              const existing = room.byId.get(message.event.id);
              if (existing) onMessage({ kind: 'event', event: existing });
              else order(room, message.event);
              break;
            }
            case 'pose': {
              const { part, position, rotation } = message;
              for (const [id, member] of room.members) {
                if (id !== playerId) member.send({ kind: 'pose', playerId, part, position, rotation });
              }
              break;
            }
            case 'request_grab': {
              const owner = room.grabs.get(message.entity);
              if (owner && owner !== playerId) {
                error('grab_denied', `${message.entity} is held`);
              } else if (!owner) {
                room.grabs.set(message.entity, playerId);
                announce(room, { type: 'ownership.granted', data: { entity: message.entity, playerId } });
              }
              break;
            }
            case 'release_grab':
              if (room.grabs.get(message.entity) === playerId) {
                room.grabs.delete(message.entity);
                announce(room, { type: 'ownership.released', data: { entity: message.entity, playerId } });
              }
              break;
            case 'request_speak':
              if (room.speaker && room.speaker !== playerId) {
                error('speak_denied', 'someone else is talking');
              } else if (!room.speaker) {
                room.speaker = playerId;
                announce(room, { type: 'speaker.locked', data: { playerId, castId: message.castId } });
              }
              break;
            case 'release_speak':
              if (room.speaker === playerId) {
                room.speaker = null;
                announce(room, { type: 'speaker.unlocked', data: { playerId } });
              }
              break;
          }
        },
        close() {
          if (!joined) return;
          leave(joined.room, joined.playerId);
          joined = null;
        },
      };
    },
  };
}
