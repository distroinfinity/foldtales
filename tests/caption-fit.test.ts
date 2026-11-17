import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { captionChunks, captionFit, chunkAt, textWidthEm, wrapLines } from '../client/src/book/caption-fit.ts';

const showDir = join(fileURLToPath(new URL('.', import.meta.url)), '../client/public/show');
/** Every printed line the chapters and the Storyteller's recorded moments say. */
const lines = (): string[] => {
  const out = new Set<string>();
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      const text = (o as { text?: unknown }).text;
      if (typeof text === 'string') out.add(text);
      Object.values(o).forEach(walk);
    }
  };
  for (const f of readdirSync(showDir)) if (f.endsWith('.json')) walk(JSON.parse(readFileSync(join(showDir, f), 'utf8')));
  return [...out];
};

const WIDTH = 0.42 * 0.8;
const BAND = 0.045;
// The authored size, the seated size on the smallest fallback book (0.7), and the smallest book a hand can make.
const SIZES = [0.012, 0.0187, 0.0218, 0.026];
// The longest live line the contracts allow, and the Storyteller's longest hints.
const LIVE = [
  'Once, when the tide was very low and the moon was very bright, Wick walked all the way out to the end of the long rocks, where nobody ever went, and found a little brass bell that rang by itself whenever a boat was lost at sea, and he kept it.',
  'Your turn: hold the button to talk to them, or hand them something. Paintings: Powered by Runway.',
  'I couldn’t hear you just then. Hold the button and try again, or hand them something.',
  'No internet connection. The AI Storyteller needs the internet.',
];

describe('captions fit the band', () => {
  test('every chapter line and live line, at every size: each chunk fits, no word is cut or lost, order kept', () => {
    const all = [...lines(), ...LIVE];
    expect(all.length).toBeGreaterThan(200);
    for (const size of SIZES) {
      const fit = captionFit(WIDTH, BAND, size);
      expect(((fit.maxLines - 1) * 1.15 + 1) * size).toBeLessThanOrEqual(BAND);
      for (const line of all) {
        const chunks = captionChunks(line, fit);
        expect(chunks.join(' ')).toBe(line.trim().split(/\s+/).join(' '));
        for (const c of chunks) expect(wrapLines(c, fit.lineEm).length).toBeLessThanOrEqual(fit.maxLines);
      }
    }
  });

  test('at most two lines, even when the band has room for three', () => {
    expect(captionFit(WIDTH, BAND, 0.012).maxLines).toBe(2);
    expect(captionFit(WIDTH, BAND, 0.026).maxLines).toBe(1);
  });

  test('the longest line splits into even chunks that end at a pause', () => {
    const line = 'The next night, up at the very top of the tall lighthouse, the lamp burned bright, and a new keeper stood on its gallery. A very small one, in a very big coat.';
    const chunks = captionChunks(line, captionFit(WIDTH, BAND, 0.0187));
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const c of chunks.slice(0, -1)) expect(c).toMatch(/[.,;:!?…—]['’”]?$/);
    const widths = chunks.map(textWidthEm);
    expect(Math.min(...widths) / Math.max(...widths)).toBeGreaterThan(0.3);
  });

  test('a word wider than the line stays whole', () => {
    const chunks = captionChunks('a supercalifragilisticexpialidocious word', { lineEm: 6, maxLines: 1 });
    expect(chunks).toContain('supercalifragilisticexpialidocious');
  });

  test('each chunk shows for its share of the voice, in order, to the end', () => {
    const chunks = ['one two three', 'four five six'];
    expect(chunkAt(chunks, 2600, 0).text).toBe('one two three');
    expect(chunkAt(chunks, 2600, 1400).text).toBe('four five six');
    expect(chunkAt(chunks, 2600, 9999).endMs).toBe(2600);
  });
});
