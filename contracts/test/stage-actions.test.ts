import { describe, expect, test } from 'vitest';
import { ACTING } from '../src/acting.ts';
import { Entity, Id } from '../src/primitives.ts';
import { ROOM_EFFECTS, StageAction, stageActionsJsonSchema } from '../src/stage-actions.ts';

const validActions = [
  { do: 'speak', withPrev: false, who: 'bramble', text: 'Oh, hello.', mood: 'warm', to: null },
  { do: 'narrate', withPrev: false, text: 'The glade was quiet.', mood: 'neutral' },
  { do: 'place', withPrev: false, what: 'object:string', at: 'stump' },
  { do: 'move', withPrev: false, who: 'bramble', to: 'mark:brook' },
  { do: 'emote', withPrev: true, who: 'bramble', acting: 'look', target: 'reader' },
  { do: 'give', withPrev: false, from: 'bramble', to: 'quill', object: 'string' },
  { do: 'use', withPrev: false, who: 'bramble', object: 'string', on: 'mark:brook', problem: 'the-brook' },
  { do: 'light', withPrev: false, mood: 'dusk', seconds: 4 },
  { do: 'music', withPrev: false, mood: 'wonder' },
  { do: 'cue', withPrev: false, cue: 'sparkle', target: null },
  {
    do: 'ask_reader',
    withPrev: false,
    who: 'bramble',
    player: null,
    problem: 'the-brook',
    text: 'If only we could cross...',
    mood: 'tense',
    opensDrawer: true,
    waitSeconds: 12,
  },
  { do: 'wait', withPrev: false, seconds: 1.5 },
  { do: 'resolve', withPrev: false, problem: 'the-brook', outcome: 'crossed on a string' },
  { do: 'room', withPrev: false, effect: 'hunt', what: 'object:string', at: 'room:couch' },
] as const;

const invalidActions: Record<string, unknown> = {
  speak: { do: 'speak', withPrev: false, who: 'bramble', text: 'Hi', mood: 'furious', to: null },
  narrate: { do: 'narrate', withPrev: false, text: '', mood: 'neutral' },
  place: { do: 'place', withPrev: false, what: 'mark:stump', at: 'stump' },
  move: { do: 'move', withPrev: false, who: 'Bramble', to: 'mark:brook' },
  emote: { do: 'emote', withPrev: false, who: 'bramble', target: null },
  give: { do: 'give', withPrev: false, from: 'bramble', to: 'quill', object: null },
  use: { do: 'use', withPrev: false, who: 'bramble', object: 'string', on: 'nowhere', problem: null },
  light: { do: 'light', withPrev: false, mood: 'neon', seconds: 4 },
  music: { do: 'music', withPrev: false, mood: null },
  cue: { do: 'cue', withPrev: false, cue: 'SPARKLE', target: null },
  ask_reader: {
    do: 'ask_reader',
    withPrev: false,
    who: 'bramble',
    player: null,
    problem: null,
    text: 'Help?',
    mood: 'warm',
    opensDrawer: 'yes',
    waitSeconds: 10,
  },
  wait: { do: 'wait', withPrev: false, seconds: -1 },
  resolve: { do: 'resolve', withPrev: false, problem: null, outcome: 'done' },
  room: { do: 'room', withPrev: false, effect: 'hurricane', what: null, at: 'room:attic' },
};

describe('StageAction', () => {
  test.each(validActions)('$do accepts', (action) => {
    expect(StageAction.safeParse(action).success).toBe(true);
  });

  test.each(Object.entries(invalidActions))('%s rejects a malformed action', (_name, action) => {
    expect(StageAction.safeParse(action).success).toBe(false);
  });

  test('every action kind has both examples', () => {
    expect(new Set(validActions.map((a) => a.do))).toEqual(new Set(Object.keys(invalidActions)));
  });

  test('unknown do is rejected', () => {
    expect(StageAction.safeParse({ do: 'teleport', withPrev: false }).success).toBe(false);
  });

  test('unknown field is rejected', () => {
    expect(StageAction.safeParse({ ...validActions[1], camera: 'pan' }).success).toBe(false);
  });

  test('speak with null who is rejected', () => {
    expect(StageAction.safeParse({ ...validActions[0], who: null }).success).toBe(false);
  });

  test('speak with null to is accepted', () => {
    expect(StageAction.safeParse({ ...validActions[0], to: null }).success).toBe(true);
  });

  test('acting outside the table is rejected', () => {
    expect(StageAction.safeParse({ ...validActions[4], acting: 'somersault' }).success).toBe(false);
  });

  test('a coordinate on move is rejected', () => {
    expect(StageAction.safeParse({ ...validActions[3], to: [0, 0, 0] }).success).toBe(false);
  });

  test('placeholders parse where an authored branch needs them', () => {
    const accepted = [
      { do: 'use', withPrev: false, who: '$receiver', object: '$offered', on: null, problem: 'gap' },
      { do: 'emote', withPrev: false, who: '$receiver', acting: 'examine', target: 'object:$offered' },
      { do: 'speak', withPrev: false, who: '$receiver', text: 'Thanks!', mood: 'warm', to: 'player:$giver' },
    ];
    for (const action of accepted) expect(StageAction.safeParse(action).success).toBe(true);
  });

  test('a placeholder of the wrong kind is rejected', () => {
    expect(StageAction.safeParse({ ...validActions[4], who: '$offered' }).success).toBe(false);
  });
});

test('the acting table has the twelve frozen ids', () => {
  expect(Object.keys(ACTING).sort()).toEqual(
    ['examine', 'flutter', 'grumble', 'hop', 'idle', 'look', 'raise', 'reach', 'scared', 'seek_light', 'take', 'turn'].sort(),
  );
});

const FORBIDDEN = [
  'oneOf',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'maxItems',
];

function walk(node: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
  } else if (node !== null && typeof node === 'object') {
    visit(node as Record<string, unknown>);
    for (const value of Object.values(node)) walk(value, visit);
  }
}

test('the JSON Schema uses only what structured outputs accept', () => {
  let objects = 0;
  walk(stageActionsJsonSchema(), (node) => {
    for (const key of FORBIDDEN) expect(node).not.toHaveProperty(key);
    if (node.type === 'object') {
      objects += 1;
      expect(node.additionalProperties).toBe(false);
    }
    if (node.type === 'array') expect((node.minItems as number | undefined) ?? 0).toBeLessThanOrEqual(1);
  });
  expect(objects).toBe(14);
});

test('a generated UUID is a valid id, and capitals are not', () => {
  for (let i = 0; i < 200; i += 1) expect(Id.safeParse(crypto.randomUUID()).success).toBe(true);
  expect(Id.safeParse('Bramble').success).toBe(false);
});

test('an entity can name a UUID copy', () => {
  expect(Entity.safeParse('object:0f3a9c1e-7b2d-4c11-9e4a-1234567890ab').success).toBe(true);
});

test('the circling boat can be sent home, as a room effect that takes no object', () => {
  expect(ROOM_EFFECTS['boat-home']).toEqual({ ms: 9000, what: false });
  expect(StageAction.safeParse({ do: 'room', withPrev: true, effect: 'boat-home', what: null, at: null }).success).toBe(true);
});
