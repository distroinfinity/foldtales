import { z } from 'zod';
import raw from '../data/tags.json' with { type: 'json' };
import { Id, Percent2 } from './primitives.ts';

export const ArtRef = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('asset'), path: z.string().min(1) }),
  z.strictObject({ kind: z.literal('url'), url: z.url() }),
]);
export type ArtRef = z.infer<typeof ArtRef>;

export const TagDef = z.strictObject({ id: Id, meaning: z.string().min(1) });
export type TagDef = z.infer<typeof TagDef>;

/** The seed vocabulary. A new tag is a one-line change to data/tags.json. */
export const TAG_VOCABULARY: TagDef[] = z.array(TagDef).parse(raw);

/** The design of an object. The art library writes one per object as `object.json`. */
export const ObjectDef = z.strictObject({
  id: Id,
  name: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(Id).min(1),
  art: ArtRef,
  size: z.strictObject({ heightM: z.number().positive() }),
  pivot: Percent2,
  provenance: z.enum(['library', 'live']),
});
export type ObjectDef = z.infer<typeof ObjectDef>;

export const ObjectOrigin = z.enum(['set', 'drawer', 'satchel']);

/**
 * One copy on this stage. Two friends can each bring a kite: two ShowObjects, one def.
 * Actions and events address this id. The def is inline so a live-painted find or a
 * reloaded log needs no lookup. A satchel is a player's ShowObjects with origin 'satchel'.
 */
export const ShowObject = z.strictObject({
  id: Id,
  def: ObjectDef,
  owner: Id.nullable(),
  origin: ObjectOrigin,
  history: z.array(z.strictObject({ episodeId: Id, text: z.string().min(1) })),
});
export type ShowObject = z.infer<typeof ShowObject>;
