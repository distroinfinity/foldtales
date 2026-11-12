import { ACTING, HANDLING_MS, MOVE_MS, estimateSpeechMs, type Beat, type StageAction } from '@tabletop/contracts';

export interface Timed {
  index: number;
  action: StageAction;
  startMs: number;
  endMs: number;
}

export interface Schedule {
  items: Timed[];
  totalMs: number;
}

export interface DurationSources {
  /** Each cue's nominal hold, from the library. */
  cueMs?: Record<string, number>;
  /** A rendered voice line's length, or null for captions only. */
  voiceMs?: (speaker: string, text: string) => number | null;
}

/** How long an action holds its group, exactly as `stage-actions.ts` defines it. */
export function actionDuration({ cueMs = {}, voiceMs = () => null }: DurationSources): (action: StageAction) => number {
  const speech = (speaker: string, text: string): number => voiceMs(speaker, text) ?? estimateSpeechMs(text);
  return (action) => {
    switch (action.do) {
      case 'speak':
        return speech(action.who, action.text);
      case 'narrate':
        return speech('narrator', action.text);
      case 'emote':
        return ACTING[action.acting].nominalMs;
      case 'move':
        return MOVE_MS;
      case 'light':
      case 'wait':
        return action.seconds * 1000;
      case 'give':
      case 'use':
      case 'place':
        return HANDLING_MS;
      case 'cue':
        return cueMs[action.cue] ?? 0;
      case 'ask_reader':
        return action.waitSeconds * 1000;
      case 'music':
      case 'resolve':
        return 0;
    }
  };
}

/** A group is one action plus each following `withPrev` action. Groups play one after another. */
export function scheduleBeat(beat: Beat, durationOf: (action: StageAction) => number): Schedule {
  const items: Timed[] = [];
  let groupStart = 0;
  let groupEnd = 0;
  beat.actions.forEach((action, index) => {
    if (!action.withPrev) groupStart = groupEnd;
    const endMs = groupStart + durationOf(action);
    items.push({ index, action, startMs: groupStart, endMs });
    groupEnd = Math.max(groupEnd, endMs);
  });
  return { items, totalMs: groupEnd };
}
