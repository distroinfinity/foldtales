import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { answers, answerTags, cueStrength, noteHandover, readHandovers } from '../client/src/objects/hand-over-cue.ts';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('the first-time hand-over cue', () => {
  test('strongest for a first-timer, settling to a quiet hint, never gone', () => {
    expect(cueStrength(0)).toBe(1);
    expect(cueStrength(2)).toBeLessThan(cueStrength(1));
    expect(cueStrength(50)).toBeCloseTo(0.4);
  });

  test('the count persists, and blocked storage never throws', () => {
    const store = memory();
    expect(readHandovers(store)).toBe(0);
    noteHandover(store);
    expect(noteHandover(store)).toBe(2);
    expect(readHandovers(store)).toBe(2);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readHandovers(blocked)).toBe(0);
    expect(noteHandover(blocked)).toBe(1);
    expect(readHandovers(null)).toBe(0);
  });

  test('a choice is never given away: every object the story has a scene for is cued alike', () => {
    const spine = JSON.parse(readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), '../client/public/show/episode-1.json'), 'utf8'));
    const gap = spine.scenes.map((s: { problem: unknown }) => s.problem).find((p: { id: string } | null) => p?.id === 'the-gap');
    const tags = answerTags(gap);
    // Solved (kite, thread, ladder) and partial (sock, key) answers alike.
    for (const t of ['flies', 'rope', 'spans', 'soft', 'opens']) expect(tags.has(t)).toBe(true);
    expect(answers({ tags: ['flies'] }, tags)).toBe(true);
    expect(answers({ tags: ['soft'] }, tags)).toBe(true);
    expect(answers({ tags: ['glows'] }, tags)).toBe(false);
    expect(answers(undefined, tags)).toBe(false);
  });
});
