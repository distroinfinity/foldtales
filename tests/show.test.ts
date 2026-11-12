import { describe, expect, test } from 'vitest';
import type { Beat, StageAction } from '../contracts/src/index.ts';
import { createShowClock } from '../client/src/show/clock.ts';
import { actionDuration, scheduleBeat } from '../client/src/show/schedule.ts';

describe('show clock', () => {
  test('advances while running', () => {
    const clock = createShowClock();
    clock.advance(16);
    clock.advance(16);
    expect(clock.ms).toBe(32);
  });

  test('stands still while any reason holds it', () => {
    const clock = createShowClock();
    clock.pause('ribbon');
    clock.pause('headset_off');
    clock.advance(500);
    clock.resume('ribbon');
    clock.advance(500);
    expect(clock.ms).toBe(0);
    clock.resume('headset_off');
    clock.advance(16);
    expect(clock.ms).toBe(16);
  });

  test('pausing twice for one reason is one pause', () => {
    const clock = createShowClock();
    expect(clock.pause('book_closed')).toBe(true);
    expect(clock.pause('book_closed')).toBe(false);
    expect(clock.resume('book_closed')).toBe(true);
    expect(clock.resume('book_closed')).toBe(false);
    expect(clock.paused).toBe(false);
  });

  test('a long stall moves the show by one capped step, never a jump', () => {
    const clock = createShowClock();
    clock.advance(4000);
    expect(clock.ms).toBe(100);
  });

  test('seek sets the show time, for resuming', () => {
    const clock = createShowClock();
    clock.seek(7250);
    expect(clock.ms).toBe(7250);
  });
});

const beat = (actions: StageAction[]): Beat => ({ id: 'b', source: 'authored', sceneId: null, estSeconds: 10, actions, next: null, replaces: null });
const wait = (seconds: number, withPrev = false): StageAction => ({ do: 'wait', withPrev, seconds });

describe('scheduleBeat, by the contract timing rules', () => {
  test('groups run one after another', () => {
    const { items, totalMs } = scheduleBeat(beat([wait(1), wait(2)]), actionDuration({}));
    expect(items.map((i) => [i.startMs, i.endMs])).toEqual([[0, 1000], [1000, 3000]]);
    expect(totalMs).toBe(3000);
  });

  test('withPrev starts together, and the group ends with its longest member', () => {
    const { items } = scheduleBeat(beat([wait(1), wait(3, true), wait(1)]), actionDuration({}));
    expect(items.map((i) => i.startMs)).toEqual([0, 0, 3000]);
  });

  test('durations follow the contract', () => {
    const duration = actionDuration({ cueMs: { gust: 800 }, voiceMs: () => 2100 });
    expect(duration({ do: 'cue', withPrev: false, cue: 'gust', target: null })).toBe(800);
    expect(duration({ do: 'emote', withPrev: false, who: 'a', acting: 'scared', target: null })).toBe(1400);
    expect(duration({ do: 'narrate', withPrev: false, text: 'Hello there.', mood: 'warm' })).toBe(2100);
    expect(duration({ do: 'light', withPrev: false, mood: 'night', seconds: 2 })).toBe(2000);
    expect(duration({ do: 'music', withPrev: false, mood: 'warm' })).toBe(0);
  });

  test('speech without a voice asset uses the captions-only estimate', () => {
    const duration = actionDuration({});
    expect(duration({ do: 'narrate', withPrev: false, text: 'x'.repeat(50), mood: 'warm' })).toBe(3000);
  });

  test('an unknown cue holds for nothing rather than stalling the show', () => {
    expect(actionDuration({})({ do: 'cue', withPrev: false, cue: 'missing', target: null })).toBe(0);
  });
});

import { readFileSync, existsSync } from 'node:fs';
import { CastMember, checkBeat, checkCastRig, Rig } from '../contracts/src/index.ts';
import { CueKind, ShowManifest, libraryOf } from '../client/src/show/manifest.ts';
import { stageAt } from '../client/src/show/state.ts';
import { unfoldAt, gustAt, lightOutAt } from '../client/src/show/cues.ts';

const art = (path: string) => new URL(`../art/${path}`, import.meta.url);
const manifest = ShowManifest.parse(JSON.parse(readFileSync(new URL('../client/public/show/manifest.json', import.meta.url), 'utf8')));
import { ObjectDef, Spine as SpineSchema } from '../contracts/src/index.ts';
const objectDefs = [...manifest.objectFiles.map((f) => ObjectDef.parse(JSON.parse(readFileSync(art(f), 'utf8')))), ...manifest.extraObjects];
const library = libraryOf(manifest, objectDefs);
const spineData = SpineSchema.parse(JSON.parse(readFileSync(new URL('../client/public/show/episode-1.json', import.meta.url), 'utf8')));
const openingBeat = spineData.scenes[0]!.beats[0]!;
const moods = { dusk: [0.86, 0.9, 1] as [number, number, number], night: [0.45, 0.55, 0.7] as [number, number, number], gold: [1, 0.88, 0.66] as [number, number, number] };
const opening = scheduleBeat(openingBeat, actionDuration({ cueMs: Object.fromEntries(manifest.cues.map((c) => [c.id, c.nominalMs])) }));

describe('the show manifest', () => {
  test('every cast member is a valid CastMember whose anatomy and heads exist in its rig', () => {
    for (const entry of manifest.cast) {
      CastMember.parse(entry.member);
      const rig = Rig.parse(JSON.parse(readFileSync(art(`${entry.member.rig}/rig.json`), 'utf8')));
      expect(checkCastRig(entry.member, rig)).toEqual([]);
      for (const [part, variants] of Object.entries(entry.variants)) {
        expect(rig.parts[part], part).toBeDefined();
        for (const file of Object.values(variants)) expect(existsSync(art(`${entry.member.rig}/${file}`)), file).toBe(true);
      }
      if (entry.light) expect(rig.parts[entry.light.part]).toBeDefined();
    }
  });

  test('the opening is a valid authored beat against the library', () => {
    expect(checkBeat(openingBeat, library, [], spineData.scenes[0]!)).toEqual([]);
  });

  test('every art file the manifest names is inside a served folder', () => {
    const files = [manifest.book, manifest.drawer, manifest.satchel, ...manifest.objectFiles, ...manifest.sets.map((s) => s.file), ...(manifest.room ? [manifest.room] : []), ...manifest.cast.map((c) => `${c.member.rig}/rig.json`)];
    for (const file of files) {
      expect(existsSync(art(file)), file).toBe(true);
      expect(manifest.artFolders.some((folder) => file.startsWith(`${folder}/`)), file).toBe(true);
    }
  });

  test('every cue has an implementation kind', () => {
    for (const cue of manifest.cues) expect(CueKind.options).toContain(cue.kind);
  });
});

describe('stageAt, the stage as a function of show time', () => {
  test('at the start the book is opening and nobody is acting', () => {
    const state = stageAt(opening, 0, moods);
    expect(state.cues.get('open-book')?.localMs).toBe(0);
    expect(state.acting.size).toBe(0);
    expect(state.moodRgb).toEqual(moods.dusk);
  });

  test('the narrator speaks after the cover lands, with a caption', () => {
    const narrate = opening.items.find((i) => i.action.do === 'narrate')!;
    const state = stageAt(opening, narrate.startMs + 10, moods);
    expect(state.caption?.text).toBe((narrate.action as { text: string }).text);
  });

  test('the light goes out before the look, and the mood reaches night', () => {
    const state = stageAt(opening, opening.totalMs + 5000, moods);
    expect(state.cues.has('lantern-out')).toBe(true);
    const actor = [...state.acting.values()][0]!;
    expect(actor.acting).toBe('look');
    expect(actor.target).toBe('reader');
    state.moodRgb.forEach((v, i) => expect(v).toBeCloseTo(moods.night[i]!, 5));
    expect(state.caption).toBeNull();
  });

  test('the mood blends during a light change', () => {
    const light = opening.items.find((i) => i.action.do === 'light' && i.action.mood === 'night')!;
    const mid = stageAt(opening, (light.startMs + light.endMs) / 2, moods).moodRgb[0];
    expect(mid).toBeLessThan(moods.dusk[0]);
    expect(mid).toBeGreaterThan(moods.night[0]);
  });

  test('the gust lands before the final look, and nothing speaks over the end', () => {
    const at = (cue: string) => opening.items.find((i) => i.action.do === 'cue' && i.action.cue === cue)!.startMs;
    const narrate = opening.items.find((i) => i.action.do === 'narrate')!;
    expect(narrate.endMs).toBeLessThanOrEqual(at('gust'));
    expect(at('gust')).toBeLessThan(at('lantern-out'));
    expect(opening.totalMs).toBeLessThan(12_000);
  });

  test('Pip looks up soon after the light dies, as in the approved proof', () => {
    const out = opening.items.find((i) => i.action.do === 'cue' && i.action.cue === 'lantern-out')!.startMs;
    const look = opening.items.find((i) => i.action.do === 'emote' && i.action.acting === 'look')!.startMs;
    expect(look - out).toBeLessThanOrEqual(1600);
  });
});

describe('cue timelines', () => {
  test('the book opens: the room dims first, the cover swings, then layers rise back to front', () => {
    const start = unfoldAt(0, 5);
    expect(start).toMatchObject({ dim: 0, cover: 0 });
    expect(start.layers.every((l) => l === 0)).toBe(true);
    const mid = unfoldAt(1500, 5);
    expect(mid.dim).toBeGreaterThan(0.5);
    expect(mid.cover).toBeGreaterThan(0);
    expect(mid.cover).toBeLessThan(1);
    const rising = unfoldAt(2900, 5);
    expect(rising.layers[0]!).toBeGreaterThan(rising.layers[4]!);
    const done = unfoldAt(6000, 5);
    expect(done.dim).toBe(1);
    expect(done.cover).toBe(1);
    done.layers.forEach((l) => expect(l).toBeCloseTo(1, 5));
  });

  test('layers overshoot on landing', () => {
    const peak = Math.max(...Array.from({ length: 60 }, (_, i) => unfoldAt(2500 + i * 10, 5).layers[0]!));
    expect(peak).toBeGreaterThan(1.01);
  });

  test('the gust passes', () => {
    expect(gustAt(800).strength).toBeGreaterThan(0);
    expect(gustAt(5000).strength).toBe(0);
    expect(gustAt(5000).leaves.every((l) => l === null)).toBe(true);
  });

  test('a light that goes out stays out, and its smoke clears', () => {
    expect(lightOutAt(0).lit).toBe(false);
    expect(lightOutAt(500).smoke).toBeGreaterThan(0);
    expect(lightOutAt(10_000)).toMatchObject({ lit: false, smoke: 0 });
  });
});

import { beamAt, BEAM_TURN_MS } from '../client/src/show/cues.ts';

describe('the lighthouse beam', () => {
  test('swells in, sweeps all the way round, and keeps turning', () => {
    expect(beamAt(0).strength).toBe(0);
    expect(beamAt(1200).strength).toBeGreaterThan(0.9);
    const a = beamAt(1000).azimuth;
    const b = beamAt(1000 + BEAM_TURN_MS / 4).azimuth;
    expect(Math.abs(b - a)).toBeCloseTo(Math.PI / 2, 5);
  });

  test('starts by sweeping across you, from the book outward', () => {
    expect(Math.abs(beamAt(0).azimuth)).toBeLessThan(0.01);
  });
});
