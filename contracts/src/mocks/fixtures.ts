import { TAG_VOCABULARY } from '../objects.ts';
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
