import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { lineIdOf, NARRATOR } from '../contracts/src/index.ts';
import { ShowManifest, voiceMsOf } from '../client/src/show/manifest.ts';
import { actionDuration, scheduleBeat } from '../client/src/show/schedule.ts';

const manifest = ShowManifest.parse(JSON.parse(readFileSync(new URL('../client/public/show/manifest.json', import.meta.url), 'utf8')));
const art = (path: string) => new URL(`../art/${path}`, import.meta.url);
const SOUNDS = ['thump', 'bloom', 'cover', 'fold', 'gust', 'puff', 'gasp', 'tap', 'rustle', 'settle', 'felt', 'hum', 'chime'] as const;

describe('the M1 sound', () => {
  test('every sound the show and the book controls play has a finished clip in a served folder', () => {
    for (const name of SOUNDS) {
      const entry = manifest.sounds[name];
      expect(entry, name).toBeDefined();
      for (const file of entry!.files) {
        expect(existsSync(art(file)), file).toBe(true);
        expect(manifest.artFolders.some((f) => file.startsWith(`${f}/`)), file).toBe(true);
      }
    }
  });

  test('the narrator line is voiced, keyed by its contract line id, at its real length', () => {
    const narrate = manifest.opening.actions.find((a) => a.do === 'narrate')!;
    const asset = manifest.voiceLines[lineIdOf(NARRATOR, (narrate as { text: string }).text)];
    expect(asset?.url).toBeTruthy();
    expect(existsSync(art(asset!.url!))).toBe(true);
    expect(asset!.durationMs).toBeGreaterThan(4500);
  });

  test('the show times the line from its voice, and the gust still waits for it to end', () => {
    const schedule = scheduleBeat(manifest.opening, actionDuration({ cueMs: Object.fromEntries(manifest.cues.map((c) => [c.id, c.nominalMs])), voiceMs: voiceMsOf(manifest) }));
    const narrate = schedule.items.find((i) => i.action.do === 'narrate')!;
    const gust = schedule.items.find((i) => i.action.do === 'cue' && i.action.cue === 'gust')!;
    expect(narrate.endMs - narrate.startMs).toBeGreaterThan(4500);
    expect(gust.startMs).toBeGreaterThanOrEqual(narrate.endMs);
  });
});
