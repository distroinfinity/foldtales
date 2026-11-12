import { z } from 'zod';
import { Beat, CastMember, Cue, Id, LineId, Mark, NARRATOR, TAG_VOCABULARY, VoiceAsset, lineIdOf, type StageLibrary } from '@tabletop/contracts';

const Px2 = z.tuple([z.number(), z.number()]);

/** What the contracts leave to the client: how a character's held light, variants and shadow are drawn. */
export const CastEntry = z.strictObject({
  member: CastMember,
  /** Alternate images for a rig part, by state name. The rig's own file is the state `base`. */
  variants: z.record(z.string().min(1), z.record(z.string().min(1), z.string().min(1))),
  /** A light the character carries. Points are rig pixels, like the rig itself. */
  light: z
    .strictObject({ part: z.string().min(1), glowAt: Px2, glowSizePx: z.number().positive(), smokeFrom: Px2, outVariant: z.string().min(1) })
    .nullable(),
  shadow: z.strictObject({ widthM: z.number().positive(), depthM: z.number().positive() }),
  /** Mirror the art, so the character turns toward the other side. */
  flip: z.boolean(),
});
export type CastEntry = z.infer<typeof CastEntry>;

export const CueKind = z.enum(['unfold', 'gust', 'light-out', 'beam']);
export type CueKind = z.infer<typeof CueKind>;

export const ShowManifest = z.strictObject({
  v: z.literal(1),
  libraryVersion: z.string().min(1),
  title: z.string().min(1),
  /** The only art folders the client may load. The art plugin serves exactly these. */
  artFolders: z.array(z.string().min(1)).min(1),
  book: z.string().min(1),
  /** The painted reading room for no-passthrough mode, if there is one. */
  room: z.string().min(1).optional(),
  set: z.strictObject({ id: Id, name: z.string().min(1), description: z.string().min(1), file: z.string().min(1), marks: z.array(Mark).min(1) }),
  cast: z.array(CastEntry).min(1),
  /** Who stands where when the book opens. */
  onStage: z.array(z.strictObject({ cast: Id, mark: Id })),
  cues: z.array(Cue.extend({ kind: CueKind })),
  narrator: z.strictObject({ voice: z.string().min(1) }),
  /** Finished clips for every sound the show makes. Several files are variations, picked in turn. */
  sounds: z.record(z.string().min(1), z.strictObject({ files: z.array(z.string().min(1)).min(1), voice: z.boolean().optional(), loop: z.boolean().optional() })),
  /** Prepared lines, keyed by the contract's line id, so a beat is timed by its real voice. */
  voiceLines: z.record(LineId, VoiceAsset),
  opening: Beat,
});
export type ShowManifest = z.infer<typeof ShowManifest>;

/** The library the director and the beat checks see. Nothing outside it can be named. */
export function libraryOf(manifest: ShowManifest): StageLibrary {
  return {
    version: manifest.libraryVersion,
    cast: manifest.cast.map((entry) => entry.member),
    objects: [],
    sets: [{ id: manifest.set.id, name: manifest.set.name, description: manifest.set.description, marks: manifest.set.marks }],
    cues: manifest.cues.map(({ id, summary, nominalMs }) => ({ id, summary, nominalMs })),
    tags: TAG_VOCABULARY,
  };
}

/** How long a prepared line really is, or null to time it from its caption. */
export function voiceMsOf(manifest: ShowManifest): (speaker: string, text: string) => number | null {
  return (speaker, text) => manifest.voiceLines[lineIdOf(speaker === NARRATOR ? NARRATOR : speaker, text)]?.durationMs ?? null;
}
