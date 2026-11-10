import { z } from 'zod';
import { ShowEvent } from './events.ts';
import { Entity, Id, Player, Vec3 } from './primitives.ts';

export const MAX_ROOM_PLAYERS = 4;

const Part = z.union([Entity, z.enum(['head', 'hand_left', 'hand_right'])]);
const Quaternion = z.tuple([z.number(), z.number(), z.number(), z.number()]);
const pose = { part: Part, position: Vec3, rotation: Quaternion };

export const RelayClientMessage = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('join'),
    room: z.string().min(1),
    player: Player,
    /** Resume after this seq. Null on a first join. */
    afterSeq: z.number().int().nonnegative().nullable(),
    /** Used only by the first joiner, who opens the room: the host's last seq plus one. */
    startSeq: z.number().int().nonnegative().nullable(),
    /** Used only by the first joiner: the host's series, which this room's events belong to. */
    seriesId: Id.nullable(),
  }),
  z.strictObject({ kind: z.literal('append'), event: ShowEvent }),
  z.strictObject({ kind: z.literal('pose'), ...pose }),
  z.strictObject({ kind: z.literal('request_grab'), entity: Entity }),
  z.strictObject({ kind: z.literal('release_grab'), entity: Entity }),
  z.strictObject({ kind: z.literal('request_speak'), castId: Id }),
  z.strictObject({ kind: z.literal('release_speak') }),
]);
export type RelayClientMessage = z.infer<typeof RelayClientMessage>;

export const RelayServerMessage = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('joined'),
    room: z.string().min(1),
    hostId: Id,
    players: z.array(Player),
    lastSeq: z.number().int().nonnegative().nullable(),
  }),
  z.strictObject({ kind: z.literal('event'), event: ShowEvent }),
  z.strictObject({ kind: z.literal('pose'), playerId: Id, ...pose }),
  z.strictObject({
    kind: z.literal('error'),
    code: z.enum(['grab_denied', 'speak_denied', 'room_full', 'bad_message']),
    message: z.string().min(1),
  }),
]);
export type RelayServerMessage = z.infer<typeof RelayServerMessage>;
