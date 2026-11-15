import { z } from 'zod';
import { ReadyBeat, VoiceAsset } from './beats.ts';
import { StageLibrary } from './library.ts';
import { ObjectDef, ShowObject } from './objects.ts';
import { ErrorCode, Id, LightMood, RoomLabel, RoomPlaceId, Vec3 } from './primitives.ts';
import { RoomEffect } from './stage-actions.ts';

/**
 * The AI Storyteller: a story of about ten minutes, made up live with the reader. The backend owns
 * the story's record (who it belongs to, its counts, title, plan and saved page); the client owns
 * its clock and its ending. Each turn the client sends the stage as it stands, the reader's room
 * and what just happened; the backend streams back voiced beats in order, built only from the
 * stage library, until the cast turns to listen.
 */

/**
 * Refusals the client tells apart without parsing text, beside `SIGN_IN_REQUIRED`. Each is the
 * message of a `quota_exceeded` error, except `STORYTELLER_RESTING` (`upstream_failed`, not
 * retryable) and `NO_STORY` (`bad_request`).
 */
export const STORIES_TODAY_USED = 'tonight\'s stories are told';
export const STORYTELLER_RESTING = 'the storyteller is resting';
export const STORY_OVER = 'this story has ended';
export const PAINTINGS_USED = 'no more paintings for this story';
export const NO_STORY = 'no story in progress';

/** Where a story is in its shape. The client decides it from its clock and turn count. */
export const StoryPhase = z.enum(['welcome', 'middle', 'closing']);
export type StoryPhase = z.infer<typeof StoryPhase>;

/** Why a story ended. */
export const EndReason = z.enum(['time', 'turns', 'reader', 'cap', 'failed', 'left']);
export type EndReason = z.infer<typeof EndReason>;

/** Whether this reader can start a story now. Asking reserves nothing. */
export const StorytellerAvailability = z.strictObject({
  status: z.enum(['ready', 'used-today', 'resting']),
  storiesLeftToday: z.number().int().nonnegative(),
  /** When today's allowance starts again (the next UTC midnight). */
  resetsAt: z.iso.datetime(),
});
export type StorytellerAvailability = z.infer<typeof StorytellerAvailability>;

/** What one story may still use. */
export const StoryAllowance = z.strictObject({
  turns: z.number().int().nonnegative(),
  paintings: z.number().int().nonnegative(),
});
export type StoryAllowance = z.infer<typeof StoryAllowance>;

/** Reserves one of today's stories. The same `requestId` from the same reader returns the same story. */
export const StartStoryRequest = z.strictObject({ requestId: Id });
export type StartStoryRequest = z.infer<typeof StartStoryRequest>;

export const StartStoryResponse = z.strictObject({
  storyId: Id,
  allowance: StoryAllowance,
  availability: StorytellerAvailability,
});
export type StartStoryResponse = z.infer<typeof StartStoryResponse>;

/** The page the headset shows at the end, as it saves it. */
export const StoryPage = z.strictObject({
  title: z.string().min(1).max(80),
  summary: z.string().min(1).max(400).nullable(),
  /** Names of the things painted for this story that really arrived on the page. */
  things: z.array(z.string().min(1).max(60)).max(12),
});
export type StoryPage = z.infer<typeof StoryPage>;

/** Ends a story and saves its page. Idempotent: a second call returns the saved record. */
export const EndStoryRequest = z.strictObject({ storyId: Id, reason: EndReason, page: StoryPage });
export type EndStoryRequest = z.infer<typeof EndStoryRequest>;

/** A story on the reader's shelf, as saved after moderation. */
export const StoryRecord = z.strictObject({
  id: Id,
  title: z.string().min(1).max(80),
  summary: z.string().min(1).max(400).nullable(),
  things: z.array(z.string().min(1).max(60)).max(12),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  /** The last change, for the library's list. */
  updatedAt: z.iso.datetime(),
});
export type StoryRecord = z.infer<typeof StoryRecord>;

export const EndStoryResponse = z.strictObject({ record: StoryRecord });
export type EndStoryResponse = z.infer<typeof EndStoryResponse>;

/** The reader's shelf, newest first. */
export const ListStoriesResponse = z.strictObject({ stories: z.array(StoryRecord).max(30) });
export type ListStoriesResponse = z.infer<typeof ListStoriesResponse>;

/** A place in the reader's real room, from Space Setup, in stage space (metres from the book's spine). */
export const RoomPlace = z.strictObject({
  /** Its kind and a number, such as `couch-2`. */
  id: RoomPlaceId,
  label: RoomLabel,
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
  /** Room effects showing now, and the ones this room and build can show. Absent means none at all. */
  roomFx: z.strictObject({ on: z.array(RoomEffect), available: z.array(RoomEffect) }).optional(),
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
  /** Time to end: the story's last turn, which closes it with an `ending`. */
  z.strictObject({ kind: z.literal('close'), reason: EndReason }),
]);
export type TurnInput = z.infer<typeof TurnInput>;

export const StoryTurnRequest = z.strictObject({
  /** From `startStory`. */
  storyId: Id,
  /** New for every turn. A turn id runs once: a repeat gets `recover`, never a second performance. */
  turnId: Id,
  phase: StoryPhase,
  /** Time with the book open since the story began, seconds. */
  activeSeconds: z.number().nonnegative(),
  library: StageLibrary,
  stage: StageNow,
  room: z.array(RoomPlace).max(24),
  input: TurnInput,
  /** The evening so far as plain lines, oldest first ('reader' for what the reader said). */
  history: z.array(z.strictObject({ who: z.string().min(1), text: z.string().min(1) })).max(120),
});
export type StoryTurnRequest = z.infer<typeof StoryTurnRequest>;

/**
 * One turn, in order. `beat` is validated, checked and voiced: its lines' `voice.url` is the audio
 * itself as a data URL. A turn ends with exactly one of `listen`, `redirect`, `ending`, `recover`
 * or `error`.
 */
export const TurnEvent = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('beat'), ready: ReadyBeat }),
  /** Turn the page to this set before the next beat. */
  z.strictObject({ kind: z.literal('set'), setId: Id }),
  /** Something new is being painted for the story; collect it with `paintResult`. A character goes to fetch it meanwhile. */
  z.strictObject({ kind: z.literal('paint'), jobId: Id, objectId: Id, description: z.string().min(1).max(200) }),
  /** The cast turns to the reader and waits. */
  z.strictObject({ kind: z.literal('listen'), who: Id.nullable() }),
  /** The story has its name (checked, and saved with the story). */
  z.strictObject({ kind: z.literal('titled'), title: z.string().min(1).max(80) }),
  /** Moderation's in-story narrator line, instead of the rest of the turn. The page turns somewhere cozier. */
  z.strictObject({ kind: z.literal('redirect'), text: z.string().min(1), voice: VoiceAsset }),
  /** The close turn's last word: the story's title and summary, checked and saved. */
  z.strictObject({ kind: z.literal('ending'), title: z.string().min(1).max(80), summary: z.string().min(1).max(400).nullable() }),
  /** This turn id already ran (or is running): nothing is performed again. The client plays its own line and moves on. */
  z.strictObject({ kind: z.literal('recover') }),
  z.strictObject({ kind: z.literal('error'), code: ErrorCode, message: z.string() }),
]);
export type TurnEvent = z.infer<typeof TurnEvent>;

export const isTurnEnd = (event: TurnEvent): boolean =>
  event.kind === 'listen' || event.kind === 'redirect' || event.kind === 'ending' || event.kind === 'recover' || event.kind === 'error';

/** Painting belongs to a story, and is identified by the object it becomes: asking twice paints once. */
export const PaintRequest = z.strictObject({
  storyId: Id,
  objectId: Id,
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
