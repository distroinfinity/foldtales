import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { PERF_CASES, shows } from '../client/src/review/perf-cases.ts';
import { roomAt } from '../client/src/room-fx/state.ts';

const episode = JSON.parse(readFileSync(new URL('../client/public/show/episode-1.json', import.meta.url), 'utf8')) as { scenes: Array<{ beats: Array<{ id: string }> }> };
const beats = new Set(episode.scenes.flatMap((s) => s.beats.map((b) => b.id)));

describe('the frame-rate fixtures', () => {
  test.each(PERF_CASES.map((c) => [c.id, c] as const))('%s starts at a real beat and holds everything it names for a minute', (_id, c) => {
    expect(beats.has(c.jump)).toBe(true);
    const items = c.hold.map((h) => ({ action: { do: 'room' as const, withPrev: false, effect: h.effect, what: h.what ?? null, at: h.at ?? null }, startMs: 0 }));
    for (const ms of [10_000, 30_000, 60_000]) {
      const now = roomAt(items, ms);
      expect(c.hold.filter((h) => !shows(now, h.effect)).map((h) => `${h.effect} off at ${ms} ms`)).toEqual([]);
    }
  });

  test('ids are unique', () => {
    expect(new Set(PERF_CASES.map((c) => c.id)).size).toBe(PERF_CASES.length);
  });
});
