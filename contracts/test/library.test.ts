import { expect, test } from 'vitest';
import { CastMember, checkLibrary, type StageLibrary } from '../src/library.ts';
import { fixtureLibrary } from '../src/mocks/fixtures.ts';
import { ObjectDef, ShowObject, TAG_VOCABULARY } from '../src/objects.ts';

const lib = (change: (l: StageLibrary) => void): StageLibrary => {
  const l = fixtureLibrary();
  change(l);
  return l;
};
const codes = (l: StageLibrary) => checkLibrary(l).map((i) => i.code);

test('the fixture library is clean', () => {
  expect(checkLibrary(fixtureLibrary())).toEqual([]);
});

test('the seed vocabulary has lightweight and not the ambiguous light', () => {
  const ids = TAG_VOCABULARY.map((t) => t.id);
  expect(ids).toContain('lightweight');
  expect(ids).not.toContain('light');
});

test('an object tag outside the vocabulary is an issue', () => {
  expect(codes(lib((l) => l.objects[0]!.tags.push('flying')))).toEqual(['unknown_tag']);
});

test.each([
  ['cast', (l: StageLibrary) => l.cast.push(l.cast[0]!)],
  ['object', (l: StageLibrary) => l.objects.push(l.objects[0]!)],
  ['set', (l: StageLibrary) => l.sets.push(l.sets[0]!)],
  ['cue', (l: StageLibrary) => l.cues.push(l.cues[0]!)],
  ['tag', (l: StageLibrary) => l.tags.push(l.tags[0]!)],
  ['mark', (l: StageLibrary) => l.sets[0]!.marks.push(l.sets[0]!.marks[0]!)],
])('a duplicate %s id is an issue', (_kind, change) => {
  expect(codes(lib(change))).toEqual(['duplicate_id']);
});

test('a cast member named narrator is an issue', () => {
  expect(codes(lib((l) => (l.cast[0]!.id = 'narrator')))).toEqual(['reserved_id']);
});

test('history is rejected on ObjectDef', () => {
  expect(ObjectDef.safeParse({ ...fixtureLibrary().objects[0], history: [] }).success).toBe(false);
});

test('two ShowObjects can share one def', () => {
  const def = fixtureLibrary().objects[1]!;
  const mine = ShowObject.parse({ id: 'string#a', def, owner: 'ann', origin: 'satchel', history: [] });
  const yours = ShowObject.parse({ id: 'string#b', def, owner: 'ben', origin: 'satchel', history: [] });
  expect(mine.id).not.toBe(yours.id);
  expect(mine.def).toEqual(yours.def);
});

test('art accepts asset and url forms and nothing else', () => {
  const base = fixtureLibrary().objects[0]!;
  expect(ObjectDef.safeParse({ ...base, art: { kind: 'url', url: 'https://example.com/a.png' } }).success).toBe(true);
  expect(ObjectDef.safeParse({ ...base, art: { kind: 'asset', path: 'a.png' } }).success).toBe(true);
  expect(ObjectDef.safeParse({ ...base, art: 'a.png' }).success).toBe(false);
});

test('an acting id outside the table is rejected on a cast member', () => {
  expect(CastMember.safeParse({ ...fixtureLibrary().cast[0], acting: ['somersault'] }).success).toBe(false);
});

test('actingHeads may be partial', () => {
  expect(CastMember.safeParse(fixtureLibrary().cast[1]).success).toBe(true);
});

test('chapters 2 and 3 can name the spool as thread and the logbook as pages, apart from the bottle', () => {
  const ids = TAG_VOCABULARY.map((t) => t.id);
  expect(ids).toEqual(expect.arrayContaining(['thread', 'pages', 'message']));
  expect(codes(lib((l) => l.objects[0]!.tags.push('thread', 'pages')))).toEqual([]);
});
