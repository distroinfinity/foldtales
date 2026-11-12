import { describe, expect, test } from 'vitest';
import { createFrameGuard } from '../client/src/stage/frame-guard.ts';

describe('the frame guard', () => {
  test('an error in one frame is caught, reported, and the next frame still runs', () => {
    const reports: string[] = [];
    let now = 0;
    const guard = createFrameGuard((where, cause) => reports.push(`${where}:${String(cause)}`), () => now);
    let runs = 0;
    const frame = guard('show', () => {
      runs++;
      if (runs === 2) throw new Error('boom');
    });
    frame();
    expect(() => frame()).not.toThrow();
    frame();
    expect(runs).toBe(3);
    expect(reports).toEqual(['show:Error: boom']);
  });

  test('a frame that keeps failing is reported at most once a second, with the count', () => {
    const reports: string[] = [];
    let now = 0;
    const guard = createFrameGuard((where, cause) => reports.push(String(cause)), () => now);
    const frame = guard('show', () => { throw new Error('again'); });
    for (let i = 0; i < 90; i++) { frame(); now += 16; }
    expect(reports.length).toBeLessThanOrEqual(2);
    expect(guard.failures('show')).toBe(90);
  });
});
