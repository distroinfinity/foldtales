import { z } from 'zod';

const V3 = z.tuple([z.number(), z.number(), z.number()]);
const M2 = z.tuple([z.number(), z.number()]);

/** `art/book/book.json`, as the art wrote it. Extra notes are allowed. */
export const BookSpec = z.object({
  closedSizeM: M2,
  openSizeM: M2,
  thicknessM: z.number().positive(),
  parts: z.object({
    cover: z.object({ file: z.string(), sizeM: M2 }),
    spine: z.object({ file: z.string(), sizeM: M2 }),
    'page-edge': z.object({ file: z.string(), sizeM: M2 }),
    ribbon: z.object({ file: z.string(), sizeM: M2 }),
    'tab-gold': z.object({ file: z.string(), sizeM: M2 }),
    'tab-sage': z.object({ file: z.string(), sizeM: M2 }),
    'drawer-pull': z.object({ file: z.string(), sizeM: M2 }),
  }),
  pageColor: z.string(),
});
export type BookSpec = z.infer<typeof BookSpec>;

const Layer = z.object({
  id: z.string(),
  file: z.string(),
  sizePx: M2,
  sizeM: M2,
  hinge: z.tuple([V3, V3]),
  splitColumnPx: z.number(),
});

/** `art/sets/<set>/set.json`, as the art wrote it. */
export const SetSpec = z.object({
  pxPerM: z.number().positive(),
  ground: z.object({ file: z.string(), sizeM: M2, captionBandM: z.number() }),
  layers: z.array(Layer).min(1),
  stack: z.object({ topToBottom: z.array(z.string()), flatOffsetM: z.number(), backColor: z.string() }),
  anchors: z.record(z.string(), z.object({ position: V3 }).loose()),
  marks: z.array(z.object({ id: z.string(), label: z.string(), position: V3 })),
  effects: z.record(z.string(), z.object({ file: z.string() }).loose()),
  moods: z.object({ dusk: V3, night: V3, gold: V3 }),
});
export type SetSpec = z.infer<typeof SetSpec>;
