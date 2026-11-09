import { z } from 'zod';
import { Percent2 } from './primitives.ts';

const Pixels2 = z.tuple([z.number(), z.number()]);

const Part = z.strictObject({
  file: z.string().min(1),
  x: z.number(),
  y: z.number(),
  pivot: Percent2,
  z: z.number(),
  scale: z.number().positive(),
  rotation: z.number().optional(),
  /** Painted once. The renderer also draws the opposite-side counterpart. */
  mirrored: z.boolean().optional(),
});

const Head = z.strictObject({
  x: z.number(),
  y: z.number(),
  pivot: Percent2,
  z: z.number(),
  scale: z.number().positive(),
  offsets: z.record(z.string().min(1), Pixels2),
  /** A template. `<name>` expands to each key of `offsets`. */
  files: z.string().includes('<name>'),
});

/** How a character's painted parts join. Accepts `art/cast/<who>/rig.json` unchanged. */
export const Rig = z.strictObject({
  note: z.string().optional(),
  rules: z.array(z.string()).optional(),
  parts: z.record(z.string().min(1), Part),
  chinShadow: z
    .strictObject({ x: z.number(), y: z.number(), width: z.number(), height: z.number(), z: z.number() })
    .optional(),
  head: Head.optional(),
});
export type Rig = z.infer<typeof Rig>;
