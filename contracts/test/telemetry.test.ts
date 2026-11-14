import { describe, expect, test } from 'vitest';
import { TelemetryBatch, telemetryKinds } from '../src/telemetry.ts';

const at = '2026-11-10T00:00:00.000Z';

const examples: Record<string, { valid: object; invalid: object }> = {
  session: { valid: { xrMode: 'ar', device: 'quest3', passthrough: true }, invalid: { xrMode: 'xr', device: 'quest3', passthrough: true } },
  frame_summary: {
    valid: { windowSeconds: 10, medianFps: 90, lowFps: 83, drawCalls: 105, triangles: 56000 },
    invalid: { windowSeconds: 10, medianFps: 90, lowFps: 83, drawCalls: 105 },
  },
  hitch: { valid: { ms: 280, phase: 'session_start' }, invalid: { ms: -1, phase: 'session_start' } },
  ai_call: { valid: { route: 'planBeat', ms: 5000, outcome: 'ok' }, invalid: { route: 'makeCoffee', ms: 5000, outcome: 'ok' } },
  beat_gap: { valid: { ms: 12 }, invalid: {} },
  fallback: { valid: { reason: 'slow', beatId: 'ask' }, invalid: { reason: 'tired', beatId: 'ask' } },
  error: { valid: { where: 'frame', message: 'boom' }, invalid: { where: 'frame' } },
  stage_fit: { valid: { surface: 'hit_test', widthM: 0.6, scale: 1 }, invalid: { surface: 'moon', widthM: 0.6, scale: 1 } },
  room_fx: { valid: { on: ['rain', 'shadows'] }, invalid: { on: ['hurricane'] } },
};

const batch = (events: unknown[]) => ({ v: 1, buildId: 'b1', sessionId: 's1', events });

describe('TelemetryBatch', () => {
  test('every kind has both examples', () => {
    expect(new Set(Object.keys(examples))).toEqual(new Set(telemetryKinds));
  });
  test.each(telemetryKinds)('%s accepts', (kind) => {
    expect(TelemetryBatch.safeParse(batch([{ at, kind, ...examples[kind]!.valid }])).success).toBe(true);
  });
  test.each(telemetryKinds)('%s rejects a malformed event', (kind) => {
    expect(TelemetryBatch.safeParse(batch([{ at, kind, ...examples[kind]!.invalid }])).success).toBe(false);
  });
  test('a telemetry field not in the schema is rejected', () => {
    const event = { at, kind: 'ai_call', ...examples.ai_call!.valid, transcript: 'hello' };
    expect(TelemetryBatch.safeParse(batch([event])).success).toBe(false);
  });
  test('ai_call accepts an error code as its outcome', () => {
    const event = { at, kind: 'ai_call', route: 'planBeat', ms: 5, outcome: 'quota_exceeded' };
    expect(TelemetryBatch.safeParse(batch([event])).success).toBe(true);
  });
});
