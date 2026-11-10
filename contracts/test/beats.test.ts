import { describe, expect, test } from 'vitest';
import {
  bindBeat,
  checkBeat,
  checkReady,
  checkSpine,
  estimateSpeechMs,
  linesOf,
  lineIdOf,
  pickProblemRule,
  type Beat,
  type ReadyBeat,
  type Scene,
  type Spine,
} from '../src/beats.ts';
import { fixtureLibrary, fixtureSpine } from '../src/mocks/fixtures.ts';
import { checkLibrary, type StageLibrary } from '../src/library.ts';
import { TAG_VOCABULARY, type ShowObject } from '../src/objects.ts';
import type { StageAction } from '../src/stage-actions.ts';

const scene = (): Scene => fixtureSpine().scenes[0]!;
const beatById = (id: string): Beat => scene().beats.find((b) => b.id === id)!;
const problem = () => scene().problem!;

const copy = (id: string, owner: string): ShowObject => ({
  id,
  def: fixtureLibrary().objects[1]!,
  owner,
  origin: 'satchel',
  history: [],
});

function directorBeat(actions: StageAction[]): Beat {
  return { id: 'd-1', source: 'director', sceneId: 'at-the-brook', estSeconds: 10, actions, next: null, replaces: 'ask' };
}

const speak = (over: Partial<Extract<StageAction, { do: 'speak' }>> = {}): StageAction => ({
  do: 'speak',
  withPrev: false,
  who: 'bramble',
  text: 'Hello there',
  mood: 'warm',
  to: null,
  ...over,
});

describe('lineIdOf', () => {
  test('ignores case, punctuation and spacing', () => {
    expect(lineIdOf('a', 'Hello, there!')).toBe(lineIdOf('a', 'hello   there'));
  });
  test('treats leading and trailing space as nothing', () => {
    expect(lineIdOf('a', '  hello there ')).toBe(lineIdOf('a', 'hello there'));
  });
  test('differs by speaker and by words', () => {
    expect(lineIdOf('a', 'hello')).not.toBe(lineIdOf('b', 'hello'));
    expect(lineIdOf('a', 'hello')).not.toBe(lineIdOf('a', 'goodbye'));
  });
  test('is stable across unicode forms', () => {
    expect(lineIdOf('a', 'café')).toBe(lineIdOf('a', 'café'));
  });
});

describe('linesOf and checkReady', () => {
  test('covers speak, ask_reader and narrate under narrator', () => {
    const lines = linesOf(beatById('ask'));
    expect(lines.map((l) => l.speaker)).toEqual(['narrator', 'bramble']);
    const lone = linesOf(directorBeat([speak()]));
    expect(lone[0]).toEqual({ speaker: 'bramble', text: 'Hello there', lineId: lineIdOf('bramble', 'Hello there') });
  });

  const ready = (beat: Beat): ReadyBeat => ({
    beat,
    voice: Object.fromEntries(linesOf(beat).map((l) => [l.lineId, { url: null, durationMs: estimateSpeechMs(l.text) }])),
  });

  test('passes a captions-only asset with a duration', () => {
    expect(checkReady(ready(beatById('ask')))).toEqual([]);
  });
  test('reports a missing asset', () => {
    expect(checkReady({ beat: beatById('ask'), voice: {} }).map((i) => i.code)).toContain('missing_voice');
  });
  test('reports a zero duration', () => {
    const r = ready(beatById('ask'));
    for (const key of Object.keys(r.voice)) r.voice[key] = { url: null, durationMs: 0 };
    expect(checkReady(r).map((i) => i.code)).toContain('bad_duration');
  });
  test('reports an unbound placeholder', () => {
    expect(checkReady(ready(beatById('crossed'))).map((i) => i.code)).toContain('unbound_placeholder');
  });
  test('estimateSpeechMs has a floor and grows with text', () => {
    expect(estimateSpeechMs('Hi')).toBe(800);
    expect(estimateSpeechMs('x'.repeat(100))).toBe(6000);
  });
});

test('a cast member named narrator is rejected by checkLibrary', () => {
  const l = fixtureLibrary();
  l.cast[1]!.id = 'narrator';
  expect(checkLibrary(l).map((i) => i.code)).toEqual(['reserved_id']);
});

describe('pickProblemRule', () => {
  test('first matching rule wins', () => {
    const p = problem();
    p.rules.push({ id: 'second', anyTags: ['ties'], beat: 'funny', outcome: 'partial' });
    const result = pickProblemRule(p, ['ties']);
    expect(result).toMatchObject({ kind: 'rule', rule: { id: 'tie-across' } });
  });
  test('no match returns the fallback', () => {
    expect(pickProblemRule(problem(), ['edible'])).toEqual({ kind: 'fallback', beat: 'funny' });
  });
  test('empty tags return the fallback', () => {
    expect(pickProblemRule(problem(), [])).toEqual({ kind: 'fallback', beat: 'funny' });
  });
  test('any generated tag list yields a branch', () => {
    const ids = TAG_VOCABULARY.map((t) => t.id);
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    for (let i = 0; i < 200; i += 1) {
      const tags = Array.from({ length: next() % 6 }, () => ids[next() % ids.length]!);
      const result = pickProblemRule(problem(), tags);
      expect(['crossed', 'funny']).toContain(result.kind === 'rule' ? result.rule.beat : result.beat);
    }
  });
});

describe('bindBeat', () => {
  const bindings = { offered: 'string#a', receiver: 'bramble', giver: 'ann' };

  test('replaces every placeholder', () => {
    const actions: StageAction[] = [
      { do: 'use', withPrev: false, who: '$receiver', object: '$offered', on: null, problem: null },
      { do: 'emote', withPrev: false, who: '$receiver', acting: 'look', target: 'player:$giver' },
      { do: 'emote', withPrev: false, who: 'bramble', acting: 'examine', target: 'object:$offered' },
      { do: 'place', withPrev: false, what: 'cast:$receiver', at: 'stump' },
    ];
    const bound = bindBeat({ ...beatById('crossed'), actions }, bindings);
    expect(JSON.stringify(bound)).not.toContain('$');
    expect(bound.actions[0]).toMatchObject({ who: 'bramble', object: 'string#a' });
    expect(bound.actions[1]).toMatchObject({ target: 'player:ann' });
    expect(bound.actions[2]).toMatchObject({ target: 'object:string#a' });
    expect(bound.actions[3]).toMatchObject({ what: 'cast:bramble' });
  });
  test('throws when a needed binding is null', () => {
    expect(() => bindBeat(beatById('crossed'), { offered: null, receiver: 'bramble', giver: null })).toThrow(/offered/);
  });
  test('needs no binding when the beat has no placeholders', () => {
    expect(() => bindBeat(beatById('help-arrives'), { offered: null, receiver: null, giver: null })).not.toThrow();
  });
  test('leaves other ids alone and does not mutate', () => {
    const original = beatById('crossed');
    const before = JSON.stringify(original);
    bindBeat(original, bindings);
    expect(JSON.stringify(original)).toBe(before);
    expect(bindBeat(beatById('help-arrives'), bindings)).toEqual(beatById('help-arrives'));
  });
  test('does not touch spoken text', () => {
    const beat = directorBeat([speak({ text: '$offered' })]);
    expect(bindBeat(beat, bindings).actions[0]).toMatchObject({ text: '$offered' });
  });
  test('two copies of one def bind to distinct beats', () => {
    const mine = bindBeat(beatById('crossed'), { ...bindings, offered: 'string#a' });
    const yours = bindBeat(beatById('crossed'), { ...bindings, offered: 'string#b' });
    expect(mine.actions[1]).toMatchObject({ object: 'string#a' });
    expect(yours.actions[1]).toMatchObject({ object: 'string#b' });
    const objects = [copy('string#a', 'ann'), copy('string#b', 'ben')];
    expect(checkBeat(mine, fixtureLibrary(), objects, scene())).toEqual([]);
    expect(checkBeat(yours, fixtureLibrary(), objects, scene())).toEqual([]);
  });
});

describe('checkBeat', () => {
  const objects = [copy('string#a', 'ann')];
  const codes = (actions: StageAction[]) =>
    checkBeat(directorBeat(actions), fixtureLibrary(), objects, scene()).map((i) => i.code);

  test('a clean director beat passes', () => {
    expect(codes([speak(), { do: 'use', withPrev: false, who: 'bramble', object: 'string#a', on: null, problem: 'the-brook' }])).toEqual([]);
  });

  test.each<[string, StageAction[], string]>([
    ['first action withPrev true', [speak({ withPrev: true })], 'first_with_prev'],
    ['unknown cast', [speak({ who: 'nobody' })], 'unknown_cast'],
    ['acting the character lacks', [{ do: 'emote', withPrev: false, who: 'bramble', acting: 'flutter', target: null }], 'acting_unavailable'],
    ['silent character speaks', [speak({ who: 'quill' })], 'silent_speaker'],
    ['unknown object copy', [{ do: 'use', withPrev: false, who: 'bramble', object: 'kite', on: null, problem: null }], 'unknown_object'],
    ['unknown mark', [{ do: 'move', withPrev: false, who: 'bramble', to: 'mark:moon' }], 'unknown_mark'],
    ['unknown place mark', [{ do: 'place', withPrev: false, what: 'cast:bramble', at: 'moon' }], 'unknown_mark'],
    ['unknown cue', [{ do: 'cue', withPrev: false, cue: 'fireworks', target: null }], 'unknown_cue'],
    ['resolve on another scene problem', [{ do: 'resolve', withPrev: false, problem: 'other', outcome: 'done' }], 'unknown_problem'],
    ['placeholder in a director beat', [{ do: 'use', withPrev: false, who: '$receiver', object: 'string#a', on: null, problem: null }], 'placeholder_in_director'],
    ['unknown cast target', [speak({ to: 'cast:nobody' })], 'unknown_cast'],
  ])('%s', (_name, actions, code) => {
    expect(codes(actions)).toContain(code);
  });

  test('a director beat with next is an issue', () => {
    const beat = { ...directorBeat([speak()]), next: 'ask' };
    expect(checkBeat(beat, fixtureLibrary(), objects, scene()).map((i) => i.code)).toContain('director_next');
  });

  test('an authored beat with replaces is an issue', () => {
    const beat = { ...beatById('help-arrives'), replaces: 'ask' };
    expect(checkBeat(beat, fixtureLibrary(), objects, scene()).map((i) => i.code)).toContain('authored_replaces');
  });

  test('placeholders are allowed in an authored beat', () => {
    expect(checkBeat(beatById('crossed'), fixtureLibrary(), objects, scene())).toEqual([]);
  });
});

describe('checkSpine', () => {
  const issues = (change: (s: Spine, l: StageLibrary) => void) => {
    const s = fixtureSpine();
    const l = fixtureLibrary();
    change(s, l);
    return checkSpine(s, l).map((i) => i.code);
  };
  const beat = (s: Spine, id: string) => s.scenes[0]!.beats.find((b) => b.id === id)!;

  test('the fixture spine is clean', () => {
    expect(checkSpine(fixtureSpine(), fixtureLibrary())).toEqual([]);
  });

  test.each<[string, (s: Spine, l: StageLibrary) => void, string]>([
    ['next cycle', (s) => { beat(s, 'help-arrives').next = 'funny'; }, 'cycle'],
    ['dangling next', (s) => { beat(s, 'funny').next = 'nowhere'; }, 'unknown_beat'],
    ['dangling entry', (s) => { s.scenes[0]!.entry = 'nowhere'; }, 'unknown_beat'],
    ['dangling rule beat', (s) => { s.scenes[0]!.problem!.rules[0]!.beat = 'nowhere'; }, 'unknown_beat'],
    ['dangling fallback', (s) => { s.scenes[0]!.problem!.fallback.beat = 'nowhere'; }, 'unknown_beat'],
    ['final path without resolve', (s) => { beat(s, 'help-arrives').actions.pop(); }, 'unresolved_path'],
    ['a tag outside the vocabulary in a rule', (s) => { s.scenes[0]!.problem!.rules[0]!.anyTags = ['flying']; }, 'unknown_tag'],
    ['a problem nothing asks about', (s) => { beat(s, 'ask').actions.pop(); }, 'problem_never_asked'],
    ['a director-source beat in a spine', (s) => { beat(s, 'funny').source = 'director'; }, 'director_in_spine'],
    ['unknown set', (s) => { s.scenes[0]!.setId = 'moon'; }, 'unknown_set'],
    ['scene object with an unknown def', (s) => { s.scenes[0]!.objects[0]!.defId = 'kite'; }, 'unknown_object_def'],
    ['a beat in the wrong scene', (s) => { beat(s, 'funny').sceneId = 'elsewhere'; }, 'wrong_scene'],
    ['a duplicate beat id', (s) => { s.scenes[0]!.beats.push(beat(s, 'funny')); }, 'duplicate_id'],
    ['a bridge with the wrong source', (s) => { s.bridges[0]!.source = 'authored'; }, 'bad_bridge'],
  ])('%s', (_name, change, code) => {
    expect(issues(change)).toContain(code);
  });

  test('a later resolve on the path satisfies an earlier beat', () => {
    expect(issues(() => {})).toEqual([]);
    expect(beatById('funny').actions.some((a) => a.do === 'resolve')).toBe(false);
  });
});

test('a bridge has no scene, so it cannot name a mark', () => {
  const spine = fixtureSpine();
  spine.bridges[0]!.actions = [{ do: 'cue', withPrev: false, cue: 'sparkle', target: 'mark:brook' }];
  expect(checkSpine(spine, fixtureLibrary()).map((i) => i.code)).toEqual(['unknown_mark']);
});
