import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

/** docs/devpost-draft.md is what gets pasted; docs/submission.md is where the copy is kept. They must say the same. */
const read = (name: string) => readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8');
const field = (doc: string, name: string): string => {
  const match = new RegExp(`<!-- ${name} -->\\n([\\s\\S]*?)\\n<!-- /${name} -->`).exec(doc);
  if (!match) throw new Error(`no ${name} field`);
  return match[1]!.trim();
};

describe('the Devpost draft', () => {
  const draft = read('devpost-draft.md');
  const kept = read('submission.md');
  test.each(['tagline', 'description', 'hands', 'fov', 'testing'])('its %s matches docs/submission.md', (name) => {
    expect(field(draft, name)).toBe(field(kept, name));
  });

  test('it carries every shot of the video plan', () => {
    for (let n = 1; n <= 9; n++) expect(draft).toMatch(new RegExp(`^\\| ${n} \\| `, 'm'));
  });
});
