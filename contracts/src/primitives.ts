import { z } from 'zod';

const ID = '[a-z0-9][a-z0-9_-]*(?:#[a-z0-9_-]+)?';

/** Any id: cast, object copy, mark, set, cue, tag, beat, series, episode, player. Lowercase, so a crypto.randomUUID() fits. Never an enum. */
export const Id = z.string().regex(new RegExp(`^${ID}$`));

/**
 * Authored branches can't know which copy was handed over, so authored beats may use these
 * placeholders. `bindBeat` replaces them at runtime, and director beats may not use them.
 */
export const PLACEHOLDERS = { offered: '$offered', receiver: '$receiver', giver: '$giver' } as const;

export const CastRef = z.string().regex(new RegExp(`^(?:${ID}|\\$receiver)$`));
export const ObjectRef = z.string().regex(new RegExp(`^(?:${ID}|\\$offered)$`));
export const PlayerRef = z.string().regex(new RegExp(`^(?:${ID}|\\$giver)$`));

const CAST_TARGET = `cast:(?:${ID}|\\$receiver)`;
const OBJECT_TARGET = `object:(?:${ID}|\\$offered)`;

/**
 * Kinds of place in the reader's real room, from Space Setup. A place's id is its kind and a
 * number (`couch-2`); a bare kind (`couch`) means the best place of that kind, or the next best.
 */
export const ROOM_LABELS = ['table', 'couch', 'bed', 'wall', 'window', 'door', 'floor', 'ceiling', 'shelf', 'storage', 'screen', 'lamp', 'plant', 'other'] as const;
export const RoomLabel = z.enum(ROOM_LABELS);
export type RoomLabel = z.infer<typeof RoomLabel>;
const ROOM_PLACE = `(?:${ROOM_LABELS.join('|')})(?:-[0-9]+)?`;
/** A room place's own id, such as `couch-2`. */
export const RoomPlaceId = z.string().regex(new RegExp(`^(?:${ROOM_LABELS.join('|')})-[0-9]+$`));
const ROOM_TARGET = `room:${ROOM_PLACE}`;
/** A place in the reader's room: `room:couch` (the best couch, or the next best place) or `room:couch-2` (that one). */
export const RoomRef = z.string().regex(new RegExp(`^${ROOM_TARGET}$`));
export type RoomRef = z.infer<typeof RoomRef>;

/** A character or an object on stage. */
export const EntityRef = z.string().regex(new RegExp(`^(?:${CAST_TARGET}|${OBJECT_TARGET})$`));

/** Where something points. The director names targets, marks and room places, never coordinates. */
export const Target = z
  .string()
  .regex(new RegExp(`^(?:reader|player:(?:${ID}|\\$giver)|${CAST_TARGET}|${OBJECT_TARGET}|mark:${ID}|${ROOM_TARGET})$`));

export const Mood = z.enum(['neutral', 'warm', 'tense', 'wonder', 'silly', 'sad', 'relief']);
export type Mood = z.infer<typeof Mood>;

export const LightMood = z.enum(['dusk', 'night', 'gold']);
export type LightMood = z.infer<typeof LightMood>;

/**
 * A point in stage space: right-handed, y up, origin at the centre of the book's spine on
 * the table, +z toward the host Reader, metres at reference desk size. Each client maps
 * this onto its own surface with one uniform scale.
 */
export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3>;

/** A percentage of an image, as rig pivots use: [0..100, 0..100]. */
export const Percent2 = z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]);

export interface Issue {
  code: string;
  path: string;
  message: string;
}

/** Every backend call. `api.ts` keys its route table by these. */
export const ROUTE_NAMES = [
  'issueDevice',
  'planBeat',
  'planSpine',
  'reactToObject',
  'replyAsCharacter',
  'storytellerAvailability',
  'startStory',
  'storyTurn',
  'endStory',
  'listStories',
  'paintProp',
  'paintResult',
  'soundEffect',
  'speakLine',
  'transcribe',
  'memoryAppend',
  'memoryRead',
  'memoryDelete',
  'sendTelemetry',
] as const;
export const RouteName = z.enum(ROUTE_NAMES);
export type RouteName = z.infer<typeof RouteName>;

export const ErrorCode = z.enum([
  'upstream_failed',
  'quota_exceeded',
  'invalid_output',
  'unauthorized',
  'contract_mismatch',
  'moderated',
  'bad_request',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const Player = z.strictObject({ id: Id, name: z.string().min(1).max(40) });
export type Player = z.infer<typeof Player>;

const ENTITY = `(?:cast|object):${ID}`;

/** A character or object copy that exists on stage. Unlike EntityRef, never a placeholder. */
export const Entity = z.string().regex(new RegExp(`^${ENTITY}$`));
