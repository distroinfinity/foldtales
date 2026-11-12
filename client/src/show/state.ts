import { estimateSpeechMs, NARRATOR, type ActingId, type LightMood } from '@tabletop/contracts';
import type { Timed } from './schedule.ts';

export type Rgb = [number, number, number];

export interface StageState {
  moodRgb: Rgb;
  /** The latest start of each cue so far. */
  cues: Map<string, { localMs: number; target: string | null }>;
  /** What each character is doing, and since when. */
  acting: Map<string, { acting: ActingId; localMs: number; target: string | null }>;
  caption: { speaker: string; text: string; localMs: number; durationMs: number } | null;
  /** Who is speaking right now, so their mouth moves. */
  talking: Set<string>;
  /** Each carried light's state: out since a light-out cue, lit again since a relight. */
  lights: Map<string, { lit: boolean; localMs: number }>;
}

export interface StageOptions {
  initialMood?: LightMood;
  /** A line's real length, or null to estimate it. An ask's caption lasts as long as its line, not its wait. */
  speechMs?: (speaker: string, text: string) => number | null;
  /** Each cue's kind, for the carried lights. */
  cueKind?: (id: string) => string | undefined;
}

const lerp = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * The whole stage as a pure function of show time. Resuming is therefore just setting the
 * clock: nothing is replayed to get here, and nothing depends on frames having been drawn.
 */
export function stageAt(schedule: { items: Timed[] }, ms: number, moods: Record<LightMood, Rgb>, options: StageOptions | LightMood = {}): StageState {
  const opts: StageOptions = typeof options === 'string' ? { initialMood: options } : options;
  const started = schedule.items.filter((item) => item.startMs <= ms);
  const lights = started.flatMap((item) => (item.action.do === 'light' ? [{ item, action: item.action }] : []));

  // Each change blends from wherever the previous changes had got to when it began.
  const moodAt = (t: number, upTo: number): Rgb => {
    let rgb = moods[opts.initialMood ?? 'dusk'];
    for (let i = 0; i < upTo; i++) {
      const { item, action } = lights[i]!;
      if (item.startMs > t) break;
      const span = item.endMs - item.startMs;
      const from = moodAt(item.startMs, i);
      rgb = lerp(from, moods[action.mood], span <= 0 ? 1 : Math.min(1, (t - item.startMs) / span));
    }
    return rgb;
  };

  const state: StageState = { moodRgb: moodAt(ms, lights.length), cues: new Map(), acting: new Map(), caption: null, talking: new Set(), lights: new Map() };
  for (const { action, startMs, endMs } of started) {
    const localMs = ms - startMs;
    if (action.do === 'cue') {
      state.cues.set(action.cue, { localMs, target: action.target });
      const kind = opts.cueKind?.(action.cue);
      if ((kind === 'light-out' || kind === 'relight') && action.target?.startsWith('cast:')) state.lights.set(action.target.slice(5), { lit: kind === 'relight', localMs });
    } else if (action.do === 'emote') state.acting.set(action.who, { acting: action.acting, localMs, target: action.target });
    else if (action.do === 'narrate' || action.do === 'speak' || action.do === 'ask_reader') {
      const speaker = action.do === 'narrate' ? NARRATOR : action.who;
      const lineMs = action.do === 'ask_reader' ? (opts.speechMs?.(speaker, action.text) ?? estimateSpeechMs(action.text)) : endMs - startMs;
      const lineEnd = Math.min(endMs, startMs + lineMs);
      if (ms < lineEnd) {
        state.caption = { speaker, text: action.text, localMs, durationMs: lineEnd - startMs };
        if (speaker !== NARRATOR) state.talking.add(speaker);
      }
    }
  }
  return state;
}
