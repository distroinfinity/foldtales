import { z } from 'zod';
import { ReadyBeat, Spine } from './beats.ts';
import { ArtRef, ShowObject } from './objects.ts';
import { Entity, Id, Player, Vec3 } from './primitives.ts';

export const CanonEntry = z.strictObject({
  id: Id,
  kind: z.enum(['cast', 'relationship', 'event', 'keepsake']),
  text: z.string().min(1),
  episodeId: Id,
  sourceEventId: z.string().min(1),
});
export type CanonEntry = z.infer<typeof CanonEntry>;

export const Page = z.strictObject({
  episodeId: Id,
  title: z.string().min(1),
  text: z.array(z.string()),
  art: z.array(ArtRef),
  keepsakes: z.array(Id),
});
export type Page = z.infer<typeof Page>;

export const FallbackReason = z.enum(['slow', 'failed', 'cap', 'offline']);
export type FallbackReason = z.infer<typeof FallbackReason>;

const Actor = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('player'), id: Id }),
  z.strictObject({ kind: z.literal('app') }),
  z.strictObject({ kind: z.literal('director') }),
]);

/**
 * `id` is client-generated, so a resend after a reconnect is idempotent. `seq` is one
 * series-wide counter: the local log assigns it solo, a Story Circle room opens at the
 * host's last seq plus one and the relay assigns from there, and memory keeps what it's
 * given. Null means not yet ordered. `showMs` is the scheduler clock, which stops while
 * paused, and `at` is the wall clock.
 */
const envelope = {
  v: z.literal(1),
  id: z.string().min(1),
  seq: z.number().int().nonnegative().nullable(),
  seriesId: Id,
  episodeId: Id.nullable(),
  actor: Actor,
  showMs: z.number().nonnegative(),
  at: z.iso.datetime(),
};

const event = <T extends string, D extends z.ZodRawShape>(type: T, data: D) =>
  z.strictObject({ ...envelope, type: z.literal(type), data: z.strictObject(data) });

const beatRef = { beatId: Id };
const grip = { entity: Entity, playerId: Id };

const variants = [
  event('session.paused', { reason: z.enum(['book_closed', 'ribbon', 'headset_off', 'hands_lost']) }),
  event('session.resumed', {}),
  // The spine and every copy are here so a generated story survives a reload or a new host.
  event('episode.started', { spine: Spine, libraryVersion: z.string().min(1), objects: z.array(ShowObject), players: z.array(Player) }),
  event('episode.ended', { outcome: z.enum(['resolved', 'abandoned']), durationMs: z.number().nonnegative() }),
  event('beat.queued', { ready: ReadyBeat }),
  event('beat.started', { ...beatRef, fallback: FallbackReason.nullable() }),
  event('beat.completed', beatRef),
  event('beat.preempted', { ...beatRef, byEventId: z.string().min(1) }),
  event('entity.grabbed', grip),
  event('entity.placed', { ...grip, at: Vec3 }),
  event('drawer.opened', { by: z.enum(['beat', 'player']) }),
  event('drawer.closed', {}),
  event('object.added', { object: ShowObject }),
  event('object.handed', { objectId: Id, toCast: Id, playerId: Id }),
  event('object.used', { objectId: Id, beatId: Id, problemId: Id.nullable() }),
  event('object.kept', { objectId: Id, playerId: Id, history: z.string().min(1) }),
  event('problem.attempted', { problemId: Id, objectId: Id, playerId: Id, ruleId: Id.nullable() }),
  event('problem.resolved', { problemId: Id, outcome: z.string().min(1), objectId: Id.nullable() }),
  event('talk.heard', { castId: Id, playerId: Id, text: z.string().min(1) }),
  event('canon.recorded', { entry: CanonEntry }),
  event('canon.reverted', { entryId: Id }),
  event('page.composed', { page: Page }),
  event('player.joined', { player: Player }),
  event('player.left', { playerId: Id }),
  event('host.changed', { playerId: Id, resumeBeatId: Id.nullable() }),
  event('ownership.granted', grip),
  event('ownership.released', grip),
  event('speaker.locked', { playerId: Id, castId: Id }),
  event('speaker.unlocked', { playerId: Id }),
  event('fairness.credited', { playerId: Id, eventId: z.string().min(1) }),
] as const;

export const ShowEvent = z.discriminatedUnion('type', variants);
export type ShowEvent = z.infer<typeof ShowEvent>;

export const eventTypes = variants.map((variant) => variant.shape.type.value) as ShowEvent['type'][];
