import { z } from 'zod';
import { ActingId } from './acting.ts';
import { CastRef, EntityRef, Id, LightMood, Mood, ObjectRef, PlayerRef, Target } from './primitives.ts';

/** Nominal hold for `move`. */
export const MOVE_MS = 1500;
/** Nominal hold for `give`, `use` and `place`. */
export const HANDLING_MS = 800;

const Line = z.string().min(1).max(240);
const Seconds = z.number().min(0).max(30);

/**
 * Timing is part of the contract. A group is one action plus every following action with
 * `withPrev: true`. The first action of a beat has `withPrev: false`. A group starts
 * together and ends when its longest member ends, and only then does the next group start.
 * Durations: speak and narrate use their voice asset, emote its acting's nominalMs, move
 * MOVE_MS, light and wait their seconds, give, use and place HANDLING_MS, cue its library
 * nominalMs, ask_reader until answered or waitSeconds, music and resolve zero. Preemption
 * stops the beat at once, and lines not yet started don't count as used.
 */
const withPrev = { withPrev: z.boolean() };

export const StageAction = z.discriminatedUnion('do', [
  z.strictObject({ do: z.literal('speak'), ...withPrev, who: CastRef, text: Line, mood: Mood, to: Target.nullable() }),
  z.strictObject({ do: z.literal('narrate'), ...withPrev, text: Line, mood: Mood }),
  z.strictObject({ do: z.literal('place'), ...withPrev, what: EntityRef, at: Id }),
  z.strictObject({ do: z.literal('move'), ...withPrev, who: CastRef, to: Target }),
  z.strictObject({ do: z.literal('emote'), ...withPrev, who: CastRef, acting: ActingId, target: Target.nullable() }),
  z.strictObject({ do: z.literal('give'), ...withPrev, from: CastRef, to: CastRef, object: ObjectRef }),
  z.strictObject({
    do: z.literal('use'),
    ...withPrev,
    who: CastRef,
    object: ObjectRef,
    on: Target.nullable(),
    problem: Id.nullable(),
  }),
  z.strictObject({ do: z.literal('light'), ...withPrev, mood: LightMood, seconds: Seconds }),
  z.strictObject({ do: z.literal('music'), ...withPrev, mood: Mood }),
  /** An authored effect named in the library, such as a beam sweep or a page turn. */
  z.strictObject({ do: z.literal('cue'), ...withPrev, cue: Id, target: Target.nullable() }),
  z.strictObject({
    do: z.literal('ask_reader'),
    ...withPrev,
    who: CastRef,
    /** Null means whoever is there. Named in Story Circle, so fairness can be directed. */
    player: PlayerRef.nullable(),
    problem: Id.nullable(),
    text: Line,
    mood: Mood,
    opensDrawer: z.boolean(),
    waitSeconds: z.number().min(1).max(30),
  }),
  z.strictObject({ do: z.literal('wait'), ...withPrev, seconds: Seconds }),
  z.strictObject({ do: z.literal('resolve'), ...withPrev, problem: Id, outcome: z.string().min(1).max(120) }),
]);
export type StageAction = z.infer<typeof StageAction>;

export const StageActions = z.array(StageAction).min(1).max(40);

/** Structured outputs reject these, so they are enforced by zod after parsing instead. */
const UNSUPPORTED = new Set([
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'maxItems',
]);

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (node === null || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED.has(key)) continue;
    out[key === 'oneOf' ? 'anyOf' : key] = clean(value);
  }
  return out;
}

/** The stage action list as a JSON Schema that Claude structured outputs accept. */
export function stageActionsJsonSchema(): Record<string, unknown> {
  return clean(z.toJSONSchema(StageActions, { reused: 'inline' })) as Record<string, unknown>;
}
