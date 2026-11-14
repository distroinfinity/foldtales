import { checkBeat, linesOf, type Beat, type Issue, type ReadyBeat, type Scene, type ShowObject, type StageAction, type StageLibrary } from '@tabletop/contracts';
import { scheduleBeat } from '../show/schedule.ts';

/** A director beat is short: a reaction or a callback, never a scene. */
export const MAX_DIRECTOR_LINES = 4;
export const MAX_DIRECTOR_MS = 15_000;
export const MAX_LINE_CHARS = 160;

const TALK: ReadonlySet<StageAction['do']> = new Set(['speak', 'narrate', 'emote', 'wait']);

/** Words that don't belong in a cozy bedtime book, or that break the fourth wall. Whole words only. */
const OFF_TONE = /\b(kill|killed|dead|blood|bloody|hell|damn|stupid|idiot|shut up|gun|knife|ai|chatbot|robot|screen|headset)\b/i;

export interface ValidateContext {
  library: StageLibrary;
  objects: ShowObject[];
  scene: Scene;
  /** Who is on this spread right now. Only they may speak or be looked at. */
  present: ReadonlySet<string>;
  /** Every line id already said, every line in the chapter's spine, and every line waiting in another offer. */
  taken: ReadonlySet<string>;
  durationOf: (action: StageAction) => number;
}

/**
 * Talk and acting only, by characters on this spread, short, new and in tone. Anything that fails is
 * dropped, never repaired: the authored story carries on without it.
 */
export function validateDirectorBeat(ready: ReadyBeat, ctx: ValidateContext): Issue[] {
  const { beat } = ready;
  const issues: Issue[] = [];
  const issue = (code: string, path: string, message: string) => issues.push({ code, path, message });
  if (beat.source !== 'director') issue('not_director', 'source', 'only director beats are offered');
  if (beat.sceneId !== ctx.scene.id) issue('wrong_scene', 'sceneId', `${beat.sceneId} is not ${ctx.scene.id}`);
  beat.actions.forEach((a, i) => {
    if (!TALK.has(a.do)) issue('not_talk', `actions.${i}`, `${a.do} is not talk or acting`);
    const who = 'who' in a ? a.who : null;
    if (who && !ctx.present.has(who)) issue('absent', `actions.${i}`, `${who} is not on this spread`);
    const target = a.do === 'emote' ? a.target : a.do === 'speak' ? a.to : null;
    if (target?.startsWith('cast:') && !ctx.present.has(target.slice(5))) issue('absent', `actions.${i}`, `${target} is not on this spread`);
  });
  issues.push(...checkBeat(beat, ctx.library, ctx.objects, ctx.scene));
  const lines = linesOf(beat);
  if (lines.length === 0) issue('no_lines', 'actions', 'a director beat says something');
  if (lines.length > MAX_DIRECTOR_LINES) issue('too_long', 'actions', `${lines.length} lines`);
  for (const line of lines) {
    if (line.text.length > MAX_LINE_CHARS) issue('long_line', line.lineId, `${line.text.length} characters`);
    if (/[*()[\]{}<>]|https?:/.test(line.text)) issue('stage_direction', line.lineId, line.text);
    if (OFF_TONE.test(line.text)) issue('off_tone', line.lineId, line.text);
    if (ctx.taken.has(line.lineId)) issue('repeat', line.lineId, line.text);
  }
  if (new Set(lines.map((l) => l.lineId)).size !== lines.length) issue('repeat', 'actions', 'a line twice in one beat');
  const ms = scheduleBeat(beat, ctx.durationOf).totalMs;
  if (ms > MAX_DIRECTOR_MS) issue('too_long', 'actions', `${ms} ms`);
  for (const line of lines) if (!ready.voice[line.lineId]) issue('missing_voice', line.lineId, 'no voice asset');
  return issues;
}

/** Line ids in a beat, for the ledger. */
export const lineIdsOf = (beat: Beat): string[] => linesOf(beat).map((l) => l.lineId);
