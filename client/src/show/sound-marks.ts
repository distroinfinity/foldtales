import type { CueKind } from './manifest.ts';
import type { Timed } from './schedule.ts';

export type SoundName =
  | 'cover'
  | 'fold'
  | 'gust'
  | 'puff'
  | 'gasp'
  | 'narration'
  | 'speech'
  | 'chime'
  | 'clink'
  | 'flare'
  | 'settle'
  | 'rustle'
  | 'page'
  | 'whoosh'
  | 'creak'
  | 'pluck'
  | 'rope'
  | 'spark'
  | 'lamp'
  | 'satchel'
  | 'hop'
  | 'setdown'
  | 'reeds';

export interface SoundMark {
  atMs: number;
  sound: SoundName;
  /** A cast id when the sound comes from a character, otherwise the book. */
  from: string | null;
  text?: string;
  /** For speech: when its line ends on the timeline, so a cut can stop it. */
  endMs?: number;
  /** Unique across the show, so each mark plays once. */
  key: string;
}

/** Offsets inside the unfold cue, matching `unfoldAt`. */
const COVER_AT_MS = 600;
const FOLD_AT_MS = 2500;
const FOLD_STAGGER_MS = 280;
const castOf = (target: string | null): string | null => (target?.startsWith('cast:') ? target.slice(5) : null);

/** One foley sound per cue kind that has one, at the cue's start. */
const CUE_SOUNDS: Partial<Record<CueKind, SoundName>> = {
  gust: 'gust',
  'light-out': 'puff',
  beam: 'chime',
  'drop-held': 'clink',
  relight: 'flare',
  'set-down': 'setdown',
  wear: 'rustle',
  'page-turn': 'page',
  'cross-kite': 'whoosh',
  'cross-ladder': 'creak',
  'cross-thread': 'pluck',
  'cross-rope': 'rope',
  spark: 'spark',
  'lamp-lit': 'lamp',
  'lamp-out': 'puff',
  keep: 'satchel',
  'chapter-end': 'chime',
  sound: 'reeds',
};

/** Every sound the show makes, in time order. Derived from the timeline, so a resume can't replay one. */
export function soundMarks(schedule: { items: Timed[] }, cueKinds: Map<string, CueKind>, cards: number): SoundMark[] {
  const marks: SoundMark[] = [];
  for (const { action, startMs, endMs, key: itemKey, index } of schedule.items) {
    const base = itemKey ?? String(index);
    const push = (m: Omit<SoundMark, 'key'>, n = 0) => marks.push({ ...m, key: `${base}#${n}` });
    if (action.do === 'cue') {
      const kind = cueKinds.get(action.cue);
      if (kind === 'unfold') {
        push({ atMs: startMs + COVER_AT_MS, sound: 'cover', from: null });
        for (let i = 0; i < cards; i++) push({ atMs: startMs + FOLD_AT_MS + i * FOLD_STAGGER_MS, sound: 'fold', from: null }, i + 1);
      } else if (kind === 'page-turn') {
        push({ atMs: startMs + 900, sound: 'page', from: null });
        for (let i = 0; i < cards; i++) push({ atMs: startMs + 1900 + i * 150, sound: 'fold', from: null }, i + 1);
      } else if (kind && CUE_SOUNDS[kind]) push({ atMs: startMs, sound: CUE_SOUNDS[kind]!, from: castOf(action.target) });
    } else if (action.do === 'emote' && action.acting === 'scared') {
      push({ atMs: startMs, sound: 'gasp', from: action.who });
    } else if (action.do === 'emote' && action.acting === 'hop') {
      push({ atMs: startMs, sound: 'hop', from: action.who });
    } else if (action.do === 'narrate') {
      push({ atMs: startMs, sound: 'narration', from: null, text: action.text, endMs });
    } else if (action.do === 'speak' || action.do === 'ask_reader') {
      push({ atMs: startMs, sound: 'speech', from: action.who, text: action.text, endMs });
    }
  }
  return marks.sort((a, b) => a.atMs - b.atMs);
}

/** The marks passed between two clock readings: after `fromMs`, up to and including `toMs`. */
export function crossed(marks: SoundMark[], fromMs: number, toMs: number): SoundMark[] {
  if (toMs <= fromMs) return [];
  return marks.filter((m) => m.atMs > fromMs && m.atMs <= toMs);
}
