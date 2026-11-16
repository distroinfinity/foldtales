import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { checkSpine, linesOf, ObjectDef, Spine, type Beat, type StageAction } from '../contracts/src/index.ts';
import { libraryOf, ShowManifest } from '../client/src/show/manifest.ts';

/**
 * Chapter 3, "The longest night" (lane C): its own data, checked on every path it can take.
 * Plan: docs/plans/2026-11-16-finish-chapter-3.md. Checks that need lane B's library (the landing,
 * Thimble, the `pages` tag, the new marks and cues) or run 021's voices switch on by themselves
 * once those land; until then they're reported as skipped, by name.
 */
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = ShowManifest.parse(read('../client/public/show/manifest.json'));
/** Both versions of the chapter (ruling 3): the hunt in your room, and its page version if the hunt fails. */
const VERSIONS = [
  {
    name: 'room hunt',
    episode: 'episode-3.json',
    canon: 'episode-3.canon.json',
  },
  {
    name: 'page hunt',
    episode: 'episode-3.page-hunt.json',
    canon: 'episode-3.page-hunt.canon.json',
  },
] as const;
const carry = read('../client/public/show/episode-3.carry.json') as {
  episodeId: string;
  slots: Array<{
    after: string;
    otherwise: string;
    pick: Array<{
      when: { fact: string; is: string; has?: string };
      beat: string;
    }>;
  }>;
};
type Canon = {
  episodeId: string;
  facts: Array<{ key: string; value: string; beats: string[] }>;
  history: Record<string, Array<{ beats?: string[] }>>;
};

const askIn = (b: Beat) => b.actions.find((a): a is Extract<StageAction, { do: 'ask_reader' }> => a.do === 'ask_reader');

/** The story's room effects, and nothing else (the story file, chapter 3). */
const ROOM = new Set(['snow', 'hunt', 'clear', 'night-sky', 'stars-lantern', 'stars-kite', 'stars-fox', 'shooting-star', 'day']);
const CEILING = new Set(['night-sky', 'stars-lantern', 'stars-kite', 'stars-fox', 'shooting-star']);
/** Cues that take what's in a paw out of it: a crossing poses it, set-down and pocket put it away. */
const EMPTIES_PAW = (cue: string) => cue === 'set-down' || cue === 'pocket' || cue.startsWith('wick-') || cue.startsWith('cross-');

/**
 * Every way through the chapter, as beat ids: at each ask, every rule, the fallback and the
 * ignored path; at each carry slot, every pick and the default. A scene's last beat leads to the
 * next scene's entry.
 */
function paths(spine: Spine, beats: Map<string, Beat>, sceneOf: Map<string, number>): string[][] {
  const slots = new Map(carry.slots.map((s) => [s.after, [s.otherwise, ...s.pick.map((p) => p.beat)]]));
  const out: string[][] = [];
  const walk = (id: string, so: string[]) => {
    if (so.length > 80) throw new Error(`a loop through ${so.slice(-6).join(' → ')}`);
    const beat = beats.get(id)!;
    const here = [...so, id];
    const scene = spine.scenes[sceneOf.get(id)!]!;
    const ask = askIn(beat);
    let nexts: string[];
    if (slots.has(id)) nexts = slots.get(id)!;
    else if (ask) {
      const p = scene.problem!;
      nexts = [...p.rules.map((r) => r.beat), p.fallback.beat, ...(p.ignored ? [p.ignored.beat] : [])];
    } else if (beat.next) nexts = [beat.next];
    else {
      const following = spine.scenes[sceneOf.get(id)! + 1];
      nexts = following ? [following.entry] : [];
    }
    if (!nexts.length) out.push(here);
    for (const n of nexts) walk(n, here);
  };
  walk(spine.scenes[0]!.entry, []);
  return out;
}

// Lane B's library for chapter 3 (E10, runs 017 and 018, contracts v6): until it's in the manifest, these wait.
const objectDefs = [...manifest.objectFiles.map((f) => ObjectDef.parse(read(`../art/${f}`))), ...manifest.extraObjects];
const libraryReady = manifest.cast.some((c) => c.member.id === 'thimble') && manifest.sets.some((s) => s.id === 'the-landing') && objectDefs.some((o) => o.id === 'logbook');

for (const version of VERSIONS) {
  const spine = Spine.parse(read(`../client/public/show/${version.episode}`));
  const canon = read(`../client/public/show/${version.canon}`) as Canon;
  const beats = new Map<string, Beat>(spine.scenes.flatMap((s) => s.beats.map((b) => [b.id, b] as const)));
  const sceneOf = new Map<string, number>(spine.scenes.flatMap((s, i) => s.beats.map((b) => [b.id, i] as const)));
  const all = paths(spine, beats, sceneOf);

  describe(`chapter 3 (${version.name}): the spine`, () => {
    test('is "The longest night", three spreads on the lamp, the landing and the gap', () => {
      expect(spine.id).toBe('chapter-3');
      expect(spine.title).toBe('The longest night');
      expect(spine.scenes.map((s) => s.setId.replace(/-snow$/, ''))).toEqual(['the-lamp', 'the-landing', 'the-gap']);
      expect(carry.episodeId).toBe('chapter-3');
      expect(canon.episodeId).toBe('chapter-3');
    });

    test('every path reaches the end page, and no beat is unreachable', () => {
      expect(all.length).toBeGreaterThan(0);
      for (const p of all) expect(p.at(-1)).toBe('chapter-end');
      const reached = new Set(all.flat());
      expect([...beats.keys()].filter((id) => !reached.has(id))).toEqual([]);
    });

    test('it can be finished without a hand lifted: every ask has an ignored path', () => {
      for (const scene of spine.scenes) {
        if (!scene.beats.some(askIn)) continue;
        expect(scene.problem?.ignored, scene.id).toBeTruthy();
      }
      const silent = all.find((p) => p.includes('frost-thimble') && p.includes('log-return') && p.includes('wick-rope-self'));
      expect(silent).toBeTruthy();
    });

    test('a hand moment on every spread', () => {
      expect(spine.scenes.map((s) => s.beats.filter(askIn).length)).toEqual([1, 1, 1]);
    });

    test("room effects are only the story's, and nothing reaches the ceiling before the stars", () => {
      const sky = new Set(
        spine.scenes
          .flatMap((s) => s.beats)
          .filter((b) => b.actions.some((a) => a.do === 'room' && CEILING.has(a.effect)))
          .map((b) => b.id),
      );
      expect([...sky]).toEqual(['the-sky']);
      for (const b of [...beats.values(), ...spine.bridges]) for (const a of b.actions) if (a.do === 'room') expect(ROOM.has(a.effect), `${b.id}: ${a.effect}`).toBe(true);
      // The wow by minute 1: snow is the opening's own room effect.
      expect(beats.get('opening')!.actions.some((a) => a.do === 'room' && a.effect === 'snow')).toBe(true);
    });

    test("the keeper's light is in the chapter from the start (ruling 2)", () => {
      expect(spine.scenes[0]!.objects.some((o) => o.id === 'lantern' && o.defId === 'lantern')).toBe(true);
    });

    test("Pip's paw is empty at every ask, on every path (ruling 1)", () => {
      for (const p of all) {
        let paw: string | null = null;
        for (const id of p) {
          const beat = beats.get(id)!;
          for (const a of beat.actions) {
            if (a.do === 'ask_reader') expect(paw, `${p.join(' → ')}: ${id} asks while Pip holds ${paw}`).toBeNull();
            else if (a.do === 'emote' && a.who === 'pip' && a.acting === 'take' && a.target === 'object:$offered') paw = 'the gift';
            else if (a.do === 'use' && a.who === 'pip' && a.object !== 'lantern') paw = a.object;
            else if (a.do === 'give' && a.from === 'pip') paw = null;
            else if (a.do === 'give' && a.to === 'pip') paw = a.object;
            else if (a.do === 'cue' && EMPTIES_PAW(a.cue)) paw = null;
          }
        }
        // At the end the logbook is Pip's, tucked in his coat, so `keep` leaves it with him.
        expect(paw, p.join(' → ')).toBeNull();
      }
    });

    test('the logbook is with Pip from the moment he has it, on every path (ruling 4)', () => {
      for (const id of ['log-found', 'log-return']) {
        const acts = beats.get(id)!.actions;
        expect(acts.some((a) => (a.do === 'use' && a.object === 'logbook') || (a.do === 'emote' && a.acting === 'take' && a.target === 'object:$offered'))).toBe(true);
      }
      // The ignored path: the narrator plays over the logbook's drift home, then Pip collects it.
      const ret = beats.get('log-return')!.actions;
      expect(ret[0]!.do).toBe('narrate');
      expect(ret.findIndex((a) => a.do === 'use')).toBeGreaterThan(0);
      expect(beats.get('lost')!.actions[0]).toMatchObject({
        do: 'cue',
        cue: 'pocket',
        target: 'object:logbook',
      });
    });

    test('carry: every slot, pick and default names a beat, and each pick is a beat only a slot reaches', () => {
      for (const slot of carry.slots) {
        expect(beats.has(slot.after), slot.after).toBe(true);
        expect(beats.has(slot.otherwise), slot.otherwise).toBe(true);
        for (const pick of slot.pick) {
          expect(beats.has(pick.beat), pick.beat).toBe(true);
          expect(beats.get(pick.beat)!.next).toBe(beats.get(slot.otherwise)!.next);
        }
      }
      // The visible consequence: the beacon borrows the very kite or ladder from your satchel.
      const beacon = carry.slots.find((s) => s.after === 'lost')!;
      expect(beacon.pick.map((p) => p.when)).toEqual([
        { fact: 'light-high', is: 'kite', has: 'kite' },
        { fact: 'light-high', is: 'ladder', has: 'ladder' },
      ]);
    });

    test('canon: every fact and history names beats in the chapter', () => {
      for (const f of canon.facts) for (const b of f.beats) expect(beats.has(b), `${f.key}=${f.value}: ${b}`).toBe(true);
      for (const [def, entries] of Object.entries(canon.history)) for (const e of entries) for (const b of e.beats ?? []) expect(beats.has(b), `${def}: ${b}`).toBe(true);
    });

    test('no line is over 200 characters (1 credit a line)', () => {
      for (const b of [...beats.values(), ...spine.bridges]) for (const l of linesOf(b)) expect(l.text.length, l.text).toBeLessThanOrEqual(200);
    });

    test.skipIf(!libraryReady)('passes checkSpine against the real library (waits for lane B: Thimble, the landing, the logbook, the new marks and cues)', () => {
      expect(checkSpine(spine, libraryOf(manifest, objectDefs))).toEqual([]);
    });
  });
}

describe('chapter 3 against the real library', () => {
  const snowy = manifest.sets.filter((s) => s.id.endsWith('-snow'));
  test.skipIf(!snowy.length)("each snowy set has exactly its base set's marks", () => {
    for (const set of snowy) {
      const base = manifest.sets.find((s) => s.id === set.id.replace(/-snow$/, ''));
      expect(base, set.id).toBeTruthy();
      expect(set.marks).toEqual(base!.marks);
    }
  });
});

// Run 021: once chapter 3 has any voice, every playable line (scene beats and bridges) must have one.
const playable = new Map(
  VERSIONS.flatMap((v) => {
    const s = Spine.parse(read(`../client/public/show/${v.episode}`));
    return [...s.scenes.flatMap((sc) => sc.beats), ...s.bridges].flatMap((b) => linesOf(b).map((l) => [l.lineId, l] as const));
  }),
);
/** Chapter 1's two closing lines are voiced already; any more means run 021 has started landing. */
const voicedHere = [...playable.keys()].filter((id) => manifest.voiceLines[id]).length;
/** Thimble's voice counts as chosen once run 021's plan records it (lane B's choice, confirmed through the sprint master). */
const run021 = read('../art/runs/021-chapter-3-voices/plan.json') as { thimblePreset?: string | null };
const chosen = (speaker: string) => speaker !== 'thimble' || Boolean(run021.thimblePreset);
const hasVoice = (id: string) => {
  const voice = manifest.voiceLines[id];
  return Boolean(voice?.url && existsSync(new URL(`../art/${voice.url}`, import.meta.url)));
};
describe('chapter 3: voices', () => {
  test.skipIf(voicedHere <= 2)('every playable line of a chosen voice has its clip (scene beats and bridges, both versions)', () => {
    for (const [id, line] of playable) if (chosen(line.speaker)) expect(hasVoice(id), `${line.speaker}: ${line.text}`).toBe(true);
  });
  test.skipIf(voicedHere <= 2 || !chosen('thimble'))("Thimble's lines too, once her voice is chosen", () => {
    for (const [id, line] of playable) if (line.speaker === 'thimble') expect(hasVoice(id), line.text).toBe(true);
  });
});
