import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { MUSIC_DUCK, MUSIC_GAIN, MUSIC_URL } from '../client/src/sound/engine.ts';

const root = (path: string) => new URL(`../${path}`, import.meta.url);

describe('the music bed', () => {
  test('ships where the engine looks for it, small enough to cache', () => {
    const file = root(`client/public/${MUSIC_URL}`);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(2_500_000);
  });

  test('carries its source and licence evidence, and is credited', () => {
    const evidence = readFileSync(root('art/sound/music/LICENCE.md'), 'utf8');
    expect(evidence).toContain('https://freesound.org/people/CVLTIV8R/sounds/810857/');
    expect(evidence).toContain('CC0');
    expect(evidence).toMatch(/SHA-256 `[0-9a-f]{64}`/);
    expect(readFileSync(root('CREDITS.md'), 'utf8')).toContain('Freesound #810857');
  });

  test('sits under the voices, and lower still while anyone speaks', () => {
    expect(MUSIC_GAIN).toBeGreaterThan(0);
    expect(MUSIC_GAIN).toBeLessThan(0.3);
    expect(MUSIC_GAIN * MUSIC_DUCK).toBeLessThan(MUSIC_GAIN / 2);
  });
});
