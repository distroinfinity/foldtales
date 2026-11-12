import { describe, expect, test } from 'vitest';
import { summarise, type Row } from '../scripts/telemetry-report.ts';

const row = (sessionId: string, event: Row['event']): Row => ({ receivedAt: 'x', deviceId: 'd', buildId: 'b', sessionId, event });

describe('the telemetry report', () => {
  const rows = [
    row('a', { kind: 'session', device: 'Quest', xrMode: 'ar' }),
    row('a', { kind: 'frame_summary', medianFps: 90, lowFps: 83 }),
    row('a', { kind: 'frame_summary', medianFps: 72, lowFps: 60 }),
    row('a', { kind: 'frame_summary', medianFps: 88, lowFps: 80 }),
    row('a', { kind: 'hitch', ms: 280 }),
    row('a', { kind: 'hitch', ms: 120 }),
    row('a', { kind: 'error', where: 'stage', message: 'no art' }),
    row('a', { kind: 'stage_fit', surface: 'hit_test' }),
    row('b', { kind: 'hitch', ms: 150 }),
  ];

  test('summarises each session', () => {
    expect(summarise(rows)[0]).toEqual({
      sessionId: 'a',
      deviceId: 'd',
      buildId: 'b',
      device: 'Quest',
      medianFps: 88,
      lowFps: 60,
      hitches: 2,
      worstHitchMs: 280,
      errors: ['stage: no art'],
      placement: ['hit_test'],
    });
  });

  test('a session with no frames has no fps, rather than a made-up one', () => {
    expect(summarise(rows)[1]).toMatchObject({ sessionId: 'b', medianFps: null, lowFps: null, device: 'unknown' });
  });
});
