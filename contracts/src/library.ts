import { z } from 'zod';
import { ActingId } from './acting.ts';
import { ObjectDef, TagDef } from './objects.ts';
import { Id, Percent2, Vec3, type Issue } from './primitives.ts';
import type { Rig } from './rig.ts';

/** The speaker id for narration. No cast member may use it. */
export const NARRATOR = 'narrator';

const PartName = z.string().min(1);

/**
 * Connects generic acting to a specific rig, so the puppet system learns no character's
 * part names. Each is a part from that character's rig, or null.
 */
const Anatomy = z.strictObject({
  torso: PartName.nullable(),
  /** Rig pivots are joints such as shoulders. `at` is where the paw holds a thing: a percentage of the part's own image, mirroring with it. */
  grip: z.strictObject({ part: PartName, at: Percent2 }).nullable(),
  held: PartName.nullable(),
  arms: z.array(PartName),
  tail: PartName.nullable(),
  wings: z.array(PartName),
});

export const CastMember = z.strictObject({
  id: Id,
  name: z.string().min(1),
  description: z.string().min(1),
  persona: z.string().min(1),
  /** Null means this character never speaks. */
  voice: z.string().min(1).nullable(),
  rig: z.string().min(1),
  acting: z.array(ActingId).min(1),
  heightM: z.number().positive(),
  /** The way the art faces when not flipped. */
  facing: z.enum(['left', 'right']),
  anatomy: Anatomy,
  /** Which head to show during an acting, such as `scared`. */
  actingHeads: z.partialRecord(ActingId, z.string().min(1)),
});
export type CastMember = z.infer<typeof CastMember>;

export const Mark = z.strictObject({ id: Id, label: z.string().min(1), position: Vec3 });

export const SetDef = z.strictObject({
  id: Id,
  name: z.string().min(1),
  description: z.string().min(1),
  marks: z.array(Mark).min(1),
});
export type SetDef = z.infer<typeof SetDef>;

/** An authored effect the show can name, such as a beam sweep. */
export const Cue = z.strictObject({ id: Id, summary: z.string().min(1), nominalMs: z.number().nonnegative() });

/** Everything the director may stage from. Nothing outside it can be named. */
export const StageLibrary = z.strictObject({
  version: z.string().min(1),
  cast: z.array(CastMember),
  objects: z.array(ObjectDef),
  sets: z.array(SetDef),
  cues: z.array(Cue),
  tags: z.array(TagDef),
});
export type StageLibrary = z.infer<typeof StageLibrary>;

function duplicates(items: { id: string }[], path: string): Issue[] {
  const seen = new Set<string>();
  const issues: Issue[] = [];
  for (const { id } of items) {
    if (seen.has(id)) issues.push({ code: 'duplicate_id', path, message: `${id} appears twice` });
    seen.add(id);
  }
  return issues;
}

export function checkLibrary(library: StageLibrary): Issue[] {
  const issues = [
    ...duplicates(library.cast, 'cast'),
    ...duplicates(library.objects, 'objects'),
    ...duplicates(library.sets, 'sets'),
    ...duplicates(library.cues, 'cues'),
    ...duplicates(library.tags, 'tags'),
    ...library.sets.flatMap((set) => duplicates(set.marks, `sets.${set.id}.marks`)),
  ];
  const tags = new Set(library.tags.map((t) => t.id));
  for (const object of library.objects) {
    for (const tag of object.tags) {
      if (!tags.has(tag)) issues.push({ code: 'unknown_tag', path: `objects.${object.id}`, message: `${tag} is not in the vocabulary` });
    }
  }
  for (const member of library.cast) {
    if (member.id === NARRATOR) issues.push({ code: 'reserved_id', path: 'cast', message: `${NARRATOR} is reserved` });
  }
  return issues;
}

/** Reports any anatomy or head name the character's rig doesn't have. */
export function checkCastRig(cast: CastMember, rig: Rig): Issue[] {
  const issues: Issue[] = [];
  const { torso, grip, held, arms, tail, wings } = cast.anatomy;
  const parts = [torso, grip?.part ?? null, held, ...arms, tail, ...wings].filter((p) => p !== null);
  for (const part of parts) {
    if (!(part in rig.parts)) issues.push({ code: 'unknown_part', path: `cast.${cast.id}.anatomy`, message: `${part} is not in the rig` });
  }
  const heads = new Set(Object.keys(rig.head?.offsets ?? {}));
  for (const [acting, head] of Object.entries(cast.actingHeads)) {
    if (!heads.has(head)) issues.push({ code: 'unknown_head', path: `cast.${cast.id}.actingHeads.${acting}`, message: `${head} is not in the rig` });
  }
  return issues;
}
