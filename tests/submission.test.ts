import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

/** The Devpost form's copy, from docs/submission.md, between its <!-- name --> markers. */
const doc = readFileSync(new URL('../docs/submission.md', import.meta.url), 'utf8');
const field = (name: string): string => {
  const match = new RegExp(`<!-- ${name} -->\\n([\\s\\S]*?)\\n<!-- /${name} -->`).exec(doc);
  if (!match) throw new Error(`docs/submission.md has no ${name} field`);
  return match[1]!.trim();
};
const words = (text: string): number => text.replace(/\*\*\[if merged\]\*\*/g, '').replace(/\*\*/g, '').split(/\s+/).filter(Boolean).length;

describe('the submission form copy', () => {
  test('the tagline is under 140 characters, on one line', () => {
    const tagline = field('tagline');
    expect(tagline.length).toBeLessThan(140);
    expect(tagline).not.toContain('\n');
  });

  test('the description is about 500 words, whatever merges', () => {
    const description = field('description');
    expect(words(description)).toBeGreaterThanOrEqual(400);
    expect(words(description)).toBeLessThanOrEqual(600);
    // With every [if merged] sentence removed, it still says enough.
    expect(words(description.replace(/\*\*\[if merged\]\*\*[^\n]*/g, ''))).toBeGreaterThanOrEqual(300);
  });

  test('every other field the form asks for is written', () => {
    for (const name of ['hands', 'fov', 'testing']) expect(words(field(name))).toBeGreaterThan(30);
    expect(field('testing')).toContain('https://www.foldtales.xyz');
  });
});
