import type { ActingId, LightMood } from '@tabletop/contracts';
import type { Schedule } from './schedule.ts';

export type Rgb = [number, number, number];

export interface StageState {
  moodRgb: Rgb;
  /** The latest start of each cue so far. */
  cues: Map<string, { localMs: number; target: string | null }>;
  /** What each character is doing, and since when. */
  acting: Map<string, { acting: ActingId; localMs: number; target: string | null }>;
  caption: { speaker: string; text: string; localMs: number; durationMs: number } | null;
}

const lerp = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * The whole stage as a pure function of show time. Resuming is therefore just setting the
 * clock: nothing is replayed to get here, and nothing depends on frames having been drawn.
 */
export function stageAt(schedule: Schedule, ms: number, moods: Record<LightMood, Rgb>, initialMood: LightMood = 'dusk'): StageState {
  const started = schedule.items.filter((item) => item.startMs <= ms);
  const lights = started.flatMap((item) => (item.action.do === 'light' ? [{ item, action: item.action }] : []));

  // Each change blends from wherever the previous changes had got to when it began.
  const moodAt = (t: number, upTo: number): Rgb => {
    let rgb = moods[initialMood];
    for (let i = 0; i < upTo; i++) {
      const { item, action } = lights[i]!;
      if (item.startMs > t) break;
      const span = item.endMs - item.startMs;
      const from = moodAt(item.startMs, i);
      rgb = lerp(from, moods[action.mood], span <= 0 ? 1 : Math.min(1, (t - item.startMs) / span));
    }
    return rgb;
  };

  const state: StageState = { moodRgb: moodAt(ms, lights.length), cues: new Map(), acting: new Map(), caption: null };
  for (const { action, startMs, endMs } of started) {
    const localMs = ms - startMs;
    if (action.do === 'cue') state.cues.set(action.cue, { localMs, target: action.target });
    else if (action.do === 'emote') state.acting.set(action.who, { acting: action.acting, localMs, target: action.target });
    else if ((action.do === 'narrate' || action.do === 'speak') && ms < endMs) {
      state.caption = { speaker: action.do === 'speak' ? action.who : 'narrator', text: action.text, localMs, durationMs: endMs - startMs };
    }
  }
  return state;
}
