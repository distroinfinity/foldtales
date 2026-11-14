import { z } from 'zod';
import { FallbackReason } from './events.ts';
import { ErrorCode, Id, RouteName } from './primitives.ts';
import { RoomEffect } from './stage-actions.ts';

const Count = z.number().nonnegative();
const event = <K extends string, F extends z.ZodRawShape>(kind: K, fields: F) =>
  z.strictObject({ at: z.iso.datetime(), kind: z.literal(kind), ...fields });

const variants = [
  event('session', { xrMode: z.enum(['ar', 'vr', 'none']), device: z.string().min(1), passthrough: z.boolean() }),
  event('frame_summary', { windowSeconds: Count, medianFps: Count, lowFps: Count, drawCalls: Count, triangles: Count }),
  event('hitch', { ms: Count, phase: z.string().min(1) }),
  event('ai_call', { route: RouteName, ms: Count, outcome: z.union([z.literal('ok'), ErrorCode]) }),
  event('beat_gap', { ms: Count }),
  event('fallback', { reason: FallbackReason, beatId: Id }),
  event('error', { where: z.string().min(1), message: z.string().min(1) }),
  event('stage_fit', { surface: z.enum(['hit_test', 'plane', 'fallback']), widthM: Count, scale: Count }),
  /** The room effects showing, each time that changes, so frame summaries can be read per effect. */
  event('room_fx', { on: z.array(RoomEffect).max(30) }),
] as const;

const TelemetryEvent = z.discriminatedUnion('kind', variants);

/** Strict on purpose: a transcript has nowhere to go. */
export const TelemetryBatch = z.strictObject({
  v: z.literal(1),
  buildId: z.string().min(1),
  sessionId: z.string().min(1),
  events: z.array(TelemetryEvent).max(500),
});
export type TelemetryBatch = z.infer<typeof TelemetryBatch>;

export const telemetryKinds = variants.map((variant) => variant.shape.kind.value) as TelemetryBatch['events'][number]['kind'][];
