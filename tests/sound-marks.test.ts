import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { ShowManifest } from '../client/src/show/manifest.ts';
import { actionDuration, scheduleBeat } from '../client/src/show/schedule.ts';
import { crossed, soundMarks } from '../client/src/show/sound-marks.ts';

const manifest = ShowManifest.parse(JSON.parse(readFileSync(new URL('../client/public/show/manifest.json', import.meta.url), 'utf8')));
const kinds = new Map(manifest.cues.map((c) => [c.id, c.kind]));
const schedule = scheduleBeat(manifest.opening, actionDuration({ cueMs: Object.fromEntries(manifest.cues.map((c) => [c.id, c.nominalMs])) }));
const marks = soundMarks(schedule, kinds, 5);

describe('sound marks: every action has a sound', () => {
  test('the cover creaks, each card folds up, the wind gusts, the flame puffs out, and Pip gasps', () => {
    const names = marks.map((m) => m.sound);
    expect(names).toContain('cover');
    expect(names.filter((n) => n === 'fold')).toHaveLength(5);
    expect(names).toContain('gust');
    expect(names).toContain('puff');
    expect(names).toContain('gasp');
    expect(names).toContain('narration');
  });

  test('marks are in time order', () => {
    for (let i = 1; i < marks.length; i++) expect(marks[i]!.atMs).toBeGreaterThanOrEqual(marks[i - 1]!.atMs);
  });

  test('the look up is silent', () => {
    const look = schedule.items.find((i) => i.action.do === 'emote' && i.action.acting === 'look')!;
    expect(marks.some((m) => m.atMs === look.startMs)).toBe(false);
  });

  test('a mark fires once, when the clock crosses it, and never on a resume', () => {
    expect(crossed(marks, 0, 700).map((m) => m.sound)).toContain('cover');
    expect(crossed(marks, 700, 700)).toEqual([]);
    expect(crossed(marks, 700, 800).map((m) => m.sound)).not.toContain('cover');
  });
});
