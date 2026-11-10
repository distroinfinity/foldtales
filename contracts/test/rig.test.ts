import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { checkCastRig, type CastMember } from '../src/library.ts';
import { ObjectDef } from '../src/objects.ts';
import { Rig } from '../src/rig.ts';

const ART = fileURLToPath(new URL('../../art', import.meta.url));
const casts = ['pip', 'wick', 'moth'];

function rawRig(who: string): unknown {
  return JSON.parse(readFileSync(join(ART, 'cast', who, 'rig.json'), 'utf8'));
}
const rigOf = (who: string) => Rig.parse(rawRig(who));

describe('the real rigs', () => {
  test('every cast folder is covered', () => {
    const folders = readdirSync(join(ART, 'cast'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    expect(folders.sort()).toEqual([...casts].sort());
  });

  test.each(casts)('%s rig parses', (who) => {
    expect(Rig.safeParse(rawRig(who)).success).toBe(true);
  });

  test.each(casts)('%s referenced files exist', (who) => {
    const rig = rigOf(who);
    const dir = join(ART, 'cast', who);
    for (const part of Object.values(rig.parts)) expect(existsSync(join(dir, part.file)), part.file).toBe(true);
    if (rig.head) {
      for (const name of Object.keys(rig.head.offsets)) {
        const file = rig.head.files.replace('<name>', name);
        expect(existsSync(join(dir, file)), file).toBe(true);
      }
    }
  });

  test('a typo in a part is rejected', () => {
    const rig = JSON.parse(JSON.stringify(rawRig('pip')));
    rig.parts.tail.pviot = rig.parts.tail.pivot;
    delete rig.parts.tail.pivot;
    expect(Rig.safeParse(rig).success).toBe(false);
  });

  test('a head without the name template is rejected', () => {
    const rig = JSON.parse(JSON.stringify(rawRig('pip')));
    rig.head.files = 'heads/forward.png';
    expect(Rig.safeParse(rig).success).toBe(false);
  });
});

test('art/objects/*/object.json parse when present', () => {
  const dir = join(ART, 'objects');
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name, 'object.json');
    if (!entry.isDirectory() || !existsSync(file)) continue;
    expect(ObjectDef.safeParse(JSON.parse(readFileSync(file, 'utf8'))).success, file).toBe(true);
  }
});

// Test data only. The real cast records arrive with ticket 1.
const BINDINGS: Record<string, CastMember['anatomy']> = {
  pip: { torso: 'coat', grip: { part: 'arm', at: [50, 90] }, held: 'lantern', arms: ['arm'], tail: 'tail', wings: [] },
  wick: {
    torso: 'body',
    grip: { part: 'armRight', at: [50, 90] },
    held: 'logbook',
    arms: ['armLeft', 'armRight'],
    tail: 'tail',
    wings: [],
  },
  moth: { torso: 'body', grip: null, held: null, arms: [], tail: null, wings: ['lowerWing', 'upperWing'] },
};
const HEADS: Record<string, CastMember['actingHeads']> = { pip: { scared: 'scared' }, wick: { grumble: 'grumpy' }, moth: {} };

function castFor(who: string, anatomy = BINDINGS[who]!, actingHeads = HEADS[who]!): CastMember {
  return {
    id: who,
    name: who,
    description: 'test',
    persona: 'test',
    voice: null,
    rig: `art/cast/${who}/rig.json`,
    acting: ['idle'],
    heightM: 0.1,
    facing: 'right',
    anatomy,
    actingHeads,
  };
}

describe('checkCastRig', () => {
  test.each(casts)('%s binds to its rig', (who) => {
    expect(checkCastRig(castFor(who), rigOf(who))).toEqual([]);
  });

  test('anatomy naming a part the rig lacks is an issue', () => {
    const issues = checkCastRig(castFor('pip', { ...BINDINGS.pip!, torso: 'body' }), rigOf('pip'));
    expect(issues.map((i) => i.code)).toEqual(['unknown_part']);
  });

  test('a grip on a part the rig lacks is an issue', () => {
    const issues = checkCastRig(castFor('pip', { ...BINDINGS.pip!, grip: { part: 'paw', at: [1, 1] } }), rigOf('pip'));
    expect(issues.map((i) => i.code)).toEqual(['unknown_part']);
  });

  test('actingHeads naming a head the rig lacks is an issue', () => {
    const issues = checkCastRig(castFor('pip', BINDINGS.pip!, { scared: 'terrified' }), rigOf('pip'));
    expect(issues.map((i) => i.code)).toEqual(['unknown_head']);
  });

  test('a head on a character with no head is an issue', () => {
    const issues = checkCastRig(castFor('moth', BINDINGS.moth!, { scared: 'scared' }), rigOf('moth'));
    expect(issues.map((i) => i.code)).toEqual(['unknown_head']);
  });
});
