import type { CueKind } from './manifest.ts';
import type { Schedule } from './schedule.ts';

export type SoundName = 'cover' | 'fold' | 'gust' | 'puff' | 'gasp' | 'narration' | 'chime';

export interface SoundMark {
  atMs: number;
  sound: SoundName;
  /** A cast id when the sound comes from a character, otherwise the book. */
  from: string | null;
  text?: string;
}

/** Offsets inside the unfold cue, matching `unfoldAt`. */
const COVER_AT_MS = 600;
const FOLD_AT_MS = 2500;
const FOLD_STAGGER_MS = 280;
const castOf = (target: string | null): string | null => (target?.startsWith('cast:') ? target.slice(5) : null);

/** Every sound the show makes, in time order. Derived from the schedule, so a resume can't replay one. */
export function soundMarks(schedule: Schedule, cueKinds: Map<string, CueKind>, cards: number): SoundMark[] {
  const marks: SoundMark[] = [];
  for (const { action, startMs } of schedule.items) {
    if (action.do === 'cue') {
      const kind = cueKinds.get(action.cue);
      if (kind === 'unfold') {
        marks.push({ atMs: startMs + COVER_AT_MS, sound: 'cover', from: null });
        for (let i = 0; i < cards; i++) marks.push({ atMs: startMs + FOLD_AT_MS + i * FOLD_STAGGER_MS, sound: 'fold', from: null });
      } else if (kind === 'gust') marks.push({ atMs: startMs, sound: 'gust', from: castOf(action.target) });
      else if (kind === 'light-out') marks.push({ atMs: startMs, sound: 'puff', from: castOf(action.target) });
      else if (kind === 'beam') marks.push({ atMs: startMs, sound: 'chime', from: null });
    } else if (action.do === 'emote' && action.acting === 'scared') {
      marks.push({ atMs: startMs, sound: 'gasp', from: action.who });
    } else if (action.do === 'narrate') {
      marks.push({ atMs: startMs, sound: 'narration', from: null, text: action.text });
    }
  }
  return marks.sort((a, b) => a.atMs - b.atMs);
}

/** The marks passed between two clock readings: after `fromMs`, up to and including `toMs`. */
export function crossed(marks: SoundMark[], fromMs: number, toMs: number): SoundMark[] {
  if (toMs <= fromMs) return [];
  return marks.filter((m) => m.atMs > fromMs && m.atMs <= toMs);
}
