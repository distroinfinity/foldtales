import { TAG_VOCABULARY } from '../objects.ts';
import type { Spine } from '../beats.ts';
import type { StageLibrary } from '../library.ts';

/** An invented cast, so any name hard-coded in the engine fails these fixtures. */
export function fixtureLibrary(): StageLibrary {
  return {
    version: 'fixture-1',
    cast: [
      {
        id: 'bramble',
        name: 'Bramble',
        description: 'A nervous hedgehog in a borrowed scarf',
        persona: 'Speaks softly, apologises to furniture',
        voice: 'voice-bramble',
        rig: 'fixtures/bramble/rig.json',
        acting: ['idle', 'look', 'scared', 'hop', 'turn', 'examine', 'reach', 'take'],
        heightM: 0.1,
        facing: 'right',
        anatomy: { torso: 'body', grip: { part: 'arm', at: [50, 90] }, held: null, arms: ['arm'], tail: null, wings: [] },
        actingHeads: { scared: 'scared' },
      },
      {
        id: 'quill',
        name: 'Quill',
        description: 'A silent wren who collects buttons',
        persona: 'Never speaks',
        voice: null,
        rig: 'fixtures/quill/rig.json',
        acting: ['idle', 'look', 'flutter', 'seek_light'],
        heightM: 0.04,
        facing: 'left',
        anatomy: { torso: 'body', grip: null, held: null, arms: [], tail: null, wings: ['wing'] },
        actingHeads: {},
      },
    ],
    objects: [
      {
        id: 'tin-whistle',
        name: 'tin whistle',
        description: 'A dented tin whistle',
        tags: ['makes-sound', 'shiny'],
        art: { kind: 'asset', path: 'fixtures/tin-whistle.png' },
        size: { heightM: 0.05 },
        pivot: [50, 90],
        provenance: 'library',
      },
      {
        id: 'string',
        name: 'ball of string',
        description: 'A fat ball of red string',
        tags: ['ties', 'rope'],
        art: { kind: 'asset', path: 'fixtures/string.png' },
        size: { heightM: 0.04 },
        pivot: [50, 50],
        provenance: 'library',
      },
    ],
    sets: [
      {
        id: 'glade',
        name: 'The glade',
        description: 'A mossy clearing with a brook across it',
        marks: [
          { id: 'stump', label: 'the old stump', position: [-0.1, 0, 0.05] },
          { id: 'brook', label: 'the near bank', position: [0.1, 0, 0.05] },
        ],
      },
    ],
    cues: [{ id: 'sparkle', summary: 'A little shimmer of light', nominalMs: 1200 }],
    tags: TAG_VOCABULARY.map((tag) => ({ ...tag })),
  };
}

const authored = { source: 'authored', sceneId: 'at-the-brook', replaces: null } as const;

/** One scene with a tag rule, a funny failure and a doing-nothing path, all of which resolve. */
export function fixtureSpine(): Spine {
  return {
    v: 1,
    id: 'fixture-spine',
    title: 'The brook',
    premise: 'Bramble must cross the brook before dark',
    source: 'authored',
    targetSeconds: { min: 300, max: 420 },
    bridges: [
      {
        id: 'bridge-one',
        source: 'bridge',
        sceneId: null,
        estSeconds: 4,
        next: null,
        replaces: null,
        actions: [{ do: 'narrate', withPrev: false, text: 'The brook went on babbling to itself.', mood: 'neutral' }],
      },
    ],
    scenes: [
      {
        id: 'at-the-brook',
        setId: 'glade',
        summary: 'The path stops at the brook',
        objects: [{ id: 'string', defId: 'string', origin: 'drawer' }],
        problem: {
          id: 'the-brook',
          summary: 'Bramble cannot cross',
          rules: [{ id: 'tie-across', anyTags: ['rope', 'ties'], beat: 'crossed', outcome: 'solved' }],
          fallback: { beat: 'funny' },
          ignored: { beat: 'help-arrives', afterSeconds: 20 },
        },
        entry: 'ask',
        beats: [
          {
            ...authored,
            id: 'ask',
            estSeconds: 16,
            next: null,
            actions: [
              { do: 'narrate', withPrev: false, text: 'The path simply stopped.', mood: 'neutral' },
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
            ],
          },
          {
            ...authored,
            id: 'crossed',
            estSeconds: 8,
            next: null,
            actions: [
              { do: 'emote', withPrev: false, who: '$receiver', acting: 'examine', target: 'object:$offered' },
              { do: 'use', withPrev: false, who: '$receiver', object: '$offered', on: 'mark:brook', problem: 'the-brook' },
              { do: 'resolve', withPrev: false, problem: 'the-brook', outcome: 'crossed with the gift' },
            ],
          },
          {
            ...authored,
            id: 'funny',
            estSeconds: 5,
            next: 'help-arrives',
            actions: [{ do: 'speak', withPrev: false, who: 'bramble', text: 'I shall keep this, thank you.', mood: 'silly', to: 'reader' }],
          },
          {
            ...authored,
            id: 'help-arrives',
            estSeconds: 6,
            next: null,
            actions: [
              { do: 'cue', withPrev: false, cue: 'sparkle', target: 'mark:brook' },
              { do: 'resolve', withPrev: false, problem: 'the-brook', outcome: 'the water went down by itself' },
            ],
          },
        ],
      },
    ],
  };
}
