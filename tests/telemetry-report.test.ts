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

describe('the report per frame-rate fixture', async () => {
  const { byCase } = await import('../scripts/telemetry-report.ts');
  const at = (s: number) => new Date(Date.UTC(2026, 10, 17, 10, 0, s)).toISOString();
  const summary = (s: number, medianFps: number, lowFps: number, slowFrames: number, worstFrameMs: number) => ({ kind: 'frame_summary', at: at(s), windowSeconds: 10, medianFps, lowFps, slowFrames, worstFrameMs });
  const session = (id: string, testCase: string, events: Row['event'][]) => [{ kind: 'session', at: at(0), testCase }, ...events].map((event) => row(id, event as Row['event']));

  test('reads each fixture apart from getting into it, and checks its effects were really on', () => {
    const rows = [
      ...session('s1', 'rain+sea', [
        summary(10, 90, 85, 0, 14), // the first window: getting into the fixture, never counted
        { kind: 'room_fx', at: at(12), on: ['rain'] },
        { kind: 'room_fx', at: at(13), on: ['rain', 'sea'] },
        summary(20, 80, 70, 4, 30), // straddles the change at 13 s: not counted
        summary(30, 82, 66, 2, 25),
        summary(40, 84, 61, 1, 41),
        { kind: 'hitch', at: at(41), ms: 120 },
      ]),
      ...session('s2', 'window', [summary(10, 90, 88, 0, 12), summary(20, 90, 88, 0, 12)]),
    ];
    const [rainSea, window] = byCase(rows);
    expect(rainSea).toMatchObject({ testCase: 'rain+sea', sessions: 1, windows: 2, medianFps: 84, low1PercentFps: 61, slowFrames: 3, worstFrameMs: 41, hitches: 1, expected: ['rain', 'sea'], missing: [] });
    // The window never came on: the fixture didn't hold what it says, so its numbers mean nothing.
    expect(window).toMatchObject({ testCase: 'window', windows: 1, expected: ['window'], seen: [], missing: ['window'] });
  });

  test('sessions without a fixture are left to the per-session report', () => {
    expect(byCase([row('x', { kind: 'session', device: 'Quest' }), row('x', { kind: 'frame_summary', medianFps: 90, lowFps: 80 })])).toEqual([]);
  });
});
