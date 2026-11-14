import { z } from 'zod';
import { ReadyBeat, VoiceAsset } from './beats.ts';
import { CanonEntry } from './events.ts';
import { StageLibrary } from './library.ts';
import { ObjectDef, ShowObject } from './objects.ts';
import { ErrorCode, Id, LightMood, Vec3 } from './primitives.ts';

/**
 * The AI Storyteller: an evening made up live with the reader. Each turn the client sends the
 * stage as it stands, the reader's room and what just happened; the backend streams back voiced
 * beats in order, built only from the stage library, until the cast turns to listen.
 */

/** A place in the reader's real room, from Space Setup, in stage space (metres from the book's spine). */
export const RoomPlace = z.strictObject({
  id: Id,
  label: z.enum(['table', 'couch', 'bed', 'wall', 'window', 'door', 'floor', 'shelf', 'storage', 'screen', 'lamp', 'plant', 'other']),
  /** The middle of its top or face. */
  at: Vec3,
  /** Width and depth (or height, for a wall), metres. */
  sizeM: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
});
export type RoomPlace = z.infer<typeof RoomPlace>;

/** The stage as it stands when a turn begins. */
export const StageNow = z.strictObject({
  setId: Id,
  /** Who is on this spread, at which mark (null: somewhere between marks), holding what. */
  cast: z.array(z.strictObject({ id: Id, mark: Id.nullable(), holding: Id.nullable() })),
  /** Every object the story may name: on the page, in a paw, in the drawer, in the satchel. */
  objects: z.array(ShowObject),
  light: LightMood,
  lampLit: z.boolean(),
});
export type StageNow = z.infer<typeof StageNow>;

/** What starts a turn. */
export const TurnInput = z.discriminatedUnion('kind', [
  /** The evening begins. */
  z.strictObject({ kind: z.literal('open') }),
  /** The reader said something, perhaps to someone in particular. */
  z.strictObject({ kind: z.literal('heard'), text: z.string().min(1).max(600), to: Id.nullable() }),
  /** The reader handed something over. */
  z.strictObject({ kind: z.literal('gift'), objectId: Id, castId: Id }),
  /** Something painted for the story has arrived on the page. */
  z.strictObject({ kind: z.literal('arrived'), objectId: Id }),
  /** The reader has been quiet this long since the cast turned to listen. */
  z.strictObject({ kind: z.literal('quiet'), seconds: z.number().nonnegative() }),
]);
export type TurnInput = z.infer<typeof TurnInput>;

export const StoryTurnRequest = z.strictObject({
  sessionId: Id,
  library: StageLibrary,
  stage: StageNow,
  room: z.array(RoomPlace).max(24),
  input: TurnInput,
  /** The evening so far as plain lines, oldest first ('reader' for what the reader said). */
  history: z.array(z.strictObject({ who: z.string().min(1), text: z.string().min(1) })).max(120),
  canon: z.array(CanonEntry),
});
export type StoryTurnRequest = z.infer<typeof StoryTurnRequest>;

/**
 * One turn, in order. `beat` is validated and voiced: its lines' `voice.url` is the audio itself as
 * a data URL. A turn ends with exactly one of `listen`, `redirect` or `error`.
 */
export const TurnEvent = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('beat'), ready: ReadyBeat }),
  /** Turn the page to this set before the next beat. */
  z.strictObject({ kind: z.literal('set'), setId: Id }),
  /** Something new is being painted for the story; collect it with `paintResult`. A character goes to fetch it meanwhile. */
  z.strictObject({ kind: z.literal('paint'), jobId: Id, objectId: Id, description: z.string().min(1).max(200) }),
  /** The cast turns to the reader and waits. */
  z.strictObject({ kind: z.literal('listen'), who: Id.nullable() }),
  /** Moderation's in-story narrator line, instead of the turn. Voiced, like a beat's lines. */
  z.strictObject({ kind: z.literal('redirect'), text: z.string().min(1), voice: VoiceAsset }),
  z.strictObject({ kind: z.literal('error'), code: ErrorCode, message: z.string() }),
]);
export type TurnEvent = z.infer<typeof TurnEvent>;

export const isTurnEnd = (event: TurnEvent): boolean => event.kind === 'listen' || event.kind === 'redirect' || event.kind === 'error';

export const PaintRequest = z.strictObject({
  sessionId: Id,
  /** What to paint, in the story's words. */
  description: z.string().min(1).max(200),
  /** A camera frame of a real thing the reader showed, if they agreed to send it. */
  image: z.strictObject({ mime: z.enum(['image/jpeg', 'image/png']), base64: z.string().min(1).max(400_000) }).nullable(),
});
export type PaintRequest = z.infer<typeof PaintRequest>;

export const PaintResult = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('pending') }),
  /** The finished object: its art is a cut-out PNG as a data URL, provenance 'live'. */
  z.strictObject({ status: z.literal('done'), object: ObjectDef }),
  z.strictObject({ status: z.literal('failed'), reason: z.string().min(1) }),
]);
export type PaintResult = z.infer<typeof PaintResult>;
