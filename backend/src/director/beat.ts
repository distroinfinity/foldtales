import {
  ACTING,
  BackendError,
  NARRATOR,
  checkBeat,
  estimateSpeechMs,
  linesOf,
  lineIdOf,
  type Beat,
  type BeatRequest,
  type ReadyBeat,
  type ShowEvent,
  type Spine,
  type StageAction,
} from '@tabletop/contracts';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PLANNER, REACTOR, type Claude } from './claude.ts';

const MOODS = ['neutral', 'warm', 'tense', 'wonder', 'silly', 'sad', 'relief'] as const;
const MAX_LINES = 3;
const MAX_CHARS = 150;

/** The world and the rules. Stable, so it caches. */
export const WORLD = `You are the director of a live pop-up storybook show, played on a real table in mixed reality.

The world: the Lost and Found at the Edge of the Table, where everything lost in a house drifts home, and a lighthouse calls it in. The tone is a cozy, gentle bedtime picture book for teens and adults: warm, a little funny, never mean, never scary beyond a shiver. PG.

The Reader is a giant, friendly presence watching over the book. The characters know the Reader is there, can look up at them and thank them, and are a little amazed by their size. Only the narrator talks about the book itself. Nobody ever mentions AI, screens, games, chat or the real world beyond the house.

You write a few short extra lines to slot into the authored show, about what the Reader just did or did earlier. The authored story decides everything physical: who goes where, what crosses what, when things end. Your lines are talk and small acting only. So never have a character do, promise or announce anything physical that the script doesn't do (no "I'll fly over now", no "let's use this to cross"), never solve the scene's problem in words, never introduce a new character, place or object, and never contradict the script.

Style: each line is one or two short spoken sentences, under ${MAX_CHARS} characters, in the character's own voice from their persona. Plain words. No stage directions, no asterisks, no emoji, no quotation marks around the line. Name objects plainly as the script would ("the kite", "the brass key"). The narrator speaks in the past tense like a storybook. Prefer one or two lines; three at most.`;

/** The whole chapter's script, so lines fit what's been said and what's coming. */
export function scriptOf(spine: Spine): string {
  const out = [`Chapter: "${spine.title}". ${spine.premise}`];
  for (const scene of spine.scenes) {
    out.push(`\nSpread "${scene.id}": ${scene.summary}.${scene.problem ? ` The problem here: ${scene.problem.summary}.` : ''}`);
    for (const beat of scene.beats) {
      const lines = linesOf(beat);
      if (lines.length === 0) continue;
      out.push(`  [${beat.id}] ${lines.map((l) => `${l.speaker}: ${l.text}`).join(' / ')}`);
    }
  }
  return out.join('\n');
}

const nameOf = (request: BeatRequest, ref: string): string => {
  const [kind, id] = ref.includes(':') ? (ref.split(':') as [string, string]) : ['object', ref];
  if (kind === 'cast') return request.library.cast.find((c) => c.id === id)?.name ?? id;
  const object = request.objects.find((o) => o.id === id);
  return object ? `the ${object.def.name}` : (request.library.objects.find((o) => o.id === id)?.name ?? id);
};

/** The reader's doings in plain words, oldest first. */
export function storyOf(request: BeatRequest): string[] {
  const at = (e: ShowEvent) => `${Math.round(e.showMs / 1000)}s`;
  const out: string[] = [];
  for (const e of request.recent) {
    if (e.type === 'object.handed') out.push(`${at(e)}: the Reader handed ${nameOf(request, e.data.objectId)} to ${nameOf(request, `cast:${e.data.toCast}`)}`);
    else if (e.type === 'problem.attempted') out.push(`${at(e)}: it was tried for "${e.data.problemId}": ${e.data.ruleId ? `it worked (${e.data.ruleId})` : 'it did not help'}`);
    else if (e.type === 'problem.resolved') out.push(`${at(e)}: "${e.data.problemId}" was settled: ${e.data.outcome}`);
    else if (e.type === 'entity.grabbed' && e.data.entity.startsWith('cast:')) out.push(`${at(e)}: the Reader picked ${nameOf(request, e.data.entity)} up in their giant hand`);
    else if (e.type === 'entity.grabbed') out.push(`${at(e)}: the Reader picked up ${nameOf(request, e.data.entity.slice(7))}`);
    else if (e.type === 'entity.placed' && e.data.entity.startsWith('cast:')) out.push(`${at(e)}: the Reader set ${nameOf(request, e.data.entity)} down again`);
  }
  return out;
}

function promptOf(request: BeatRequest): string {
  const { trigger, library, objects, position, canon } = request;
  const cast = library.cast.map((c) => `- ${c.id} (${c.name}): ${c.description} ${c.persona} Can act: ${c.acting.filter((a) => a !== 'idle' && a !== 'take').join(', ')}.`);
  const things = objects.map((o) => `- ${o.id}: the ${o.def.name}. ${o.def.description}${o.history.length ? ` History: ${o.history.map((h) => h.text).join(' ')}` : ''}`);
  const open = request.show.problems.filter((p) => p.status === 'open').map((p) => p.problemId);
  const parts = [
    `Now: spread "${position.sceneId}", in the authored beat "${position.cursor ?? 'none'}", ${Math.round(position.elapsedSeconds)} s into the chapter.`,
    `On this spread right now, and the only ones who may speak or be looked at:\n${cast.join('\n')}\n- narrator: the storybook's narrator.`,
    things.length ? `Objects here (only these may be named):\n${things.join('\n')}` : 'No objects here.',
    open.length ? `Still open: ${open.join(', ')}.` : 'Nothing is being asked of the Reader right now.',
    canon.length ? `From earlier chapters:\n${canon.map((c) => `- ${c.text}`).join('\n')}` : '',
    `What the Reader has done so far:\n${storyOf(request).join('\n') || '(nothing yet)'}`,
  ];
  if (trigger.kind === 'gift') {
    parts.push(
      `JUST NOW: the Reader handed ${nameOf(request, trigger.objectId)} to ${nameOf(request, `cast:${trigger.castId}`)}, who has taken it and is turning it over. ` +
        `Write ${trigger.castId}'s reaction to this exact object at this exact moment (others present may chime in once). ` +
        `If it doesn't help with what's open, the authored story already said so; react to the thing itself: what it is, whose it might be, what it reminds them of. Don't repeat the script.`,
    );
  } else {
    parts.push(
      `A quiet moment. Write a short callback: someone present remembers something the Reader did earlier (above), naturally, in the flow of the script around beat "${position.cursor ?? ''}". ` +
        `Pick the most delightful thing to remember. If there's nothing worth remembering, a single small line is fine.`,
    );
  }
  return parts.filter(Boolean).join('\n\n');
}

const Line = z.object({
  speaker: z.string(),
  text: z.string().min(1),
  mood: z.enum(MOODS),
  acting: z.string().nullable(),
  look_at: z.string().nullable(),
});
const Answer = z.object({ lines: z.array(Line).min(1) });
type Answer = z.infer<typeof Answer>;

function schemaOf(request: BeatRequest): Record<string, unknown> {
  const speakers = [...request.library.cast.filter((c) => c.voice !== null).map((c) => c.id), NARRATOR];
  const actings = [...new Set(request.library.cast.flatMap((c) => c.acting))];
  const looks = ['reader', ...request.library.cast.map((c) => `cast:${c.id}`), ...request.objects.map((o) => `object:${o.id}`)];
  return {
    type: 'object',
    additionalProperties: false,
    required: ['lines'],
    properties: {
      lines: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['speaker', 'text', 'mood', 'acting', 'look_at'],
          properties: {
            speaker: { type: 'string', enum: speakers },
            text: { type: 'string' },
            mood: { type: 'string', enum: [...MOODS] },
            acting: { anyOf: [{ type: 'string', enum: actings }, { type: 'null' }] },
            look_at: { anyOf: [{ type: 'string', enum: looks }, { type: 'null' }] },
          },
        },
      },
    },
  };
}

/** Strips what a model sometimes adds anyway: stage directions, wrapping quotes, a speaker's name. */
export function cleanLine(text: string, speakerName: string | null): string {
  let t = text.replace(/\*[^*]*\*/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (speakerName && t.toLowerCase().startsWith(`${speakerName.toLowerCase()}:`)) t = t.slice(speakerName.length + 1).trim();
  t = t.replace(/^["“'‘]+|["”'’]+$/g, '').trim();
  return t;
}

/** The model's lines as contract stage actions: each line with its acting, a breath between lines. */
export function beatFrom(request: BeatRequest, answer: Answer): Beat {
  const actions: StageAction[] = [];
  const used = new Set(request.usedLineIds);
  for (const line of answer.lines.slice(0, MAX_LINES)) {
    const member = request.library.cast.find((c) => c.id === line.speaker);
    const narrator = line.speaker === NARRATOR;
    if (!narrator && !member?.voice) continue;
    const text = cleanLine(line.text, member?.name ?? null).slice(0, 240);
    if (text.length < 2 || used.has(lineIdOf(narrator ? NARRATOR : line.speaker, text))) continue;
    used.add(lineIdOf(narrator ? NARRATOR : line.speaker, text));
    if (actions.length > 0) actions.push({ do: 'wait', withPrev: false, seconds: 0.4 });
    const acting = member && line.acting && member.acting.includes(line.acting as never) ? (line.acting as keyof typeof ACTING) : null;
    const target = line.look_at && acting && ACTING[acting].takesTarget ? line.look_at : null;
    if (member && acting) actions.push({ do: 'emote', withPrev: false, who: member.id, acting, target });
    if (narrator) actions.push({ do: 'narrate', withPrev: actions.length > 0 && actions.at(-1)!.do === 'emote', text, mood: line.mood });
    else actions.push({ do: 'speak', withPrev: !!acting, who: line.speaker, text, mood: line.mood, to: line.look_at && line.look_at !== 'reader' && !line.look_at.startsWith('object:') ? line.look_at : line.look_at === 'reader' ? 'reader' : null });
  }
  if (actions.length === 0) throw new BackendError('invalid_output', 'no usable line');
  actions[0] = { ...actions[0]!, withPrev: false };
  const est = actions.reduce((s, a) => s + (a.do === 'speak' || a.do === 'narrate' ? estimateSpeechMs(a.text) : a.do === 'wait' ? a.seconds * 1000 : 0), 0) / 1000;
  return {
    id: `dir-${randomUUID().slice(0, 8)}`,
    source: 'director',
    sceneId: request.position.sceneId,
    estSeconds: Math.min(120, Math.max(1, Math.round(est))),
    actions,
    next: null,
    replaces: null,
  };
}

export function readyOf(beat: Beat): ReadyBeat {
  return { beat, voice: Object.fromEntries(linesOf(beat).map((l) => [l.lineId, { url: null, durationMs: estimateSpeechMs(l.text) }])) };
}

/** `planBeat` on Claude: Haiku for a quick reaction to a gift, Sonnet for a callback planned ahead. */
export function createPlanBeat(claude: Claude) {
  return async (request: BeatRequest): Promise<ReadyBeat> => {
    const gift = request.trigger.kind === 'gift';
    const answer = await claude.ask({
      model: gift ? REACTOR : PLANNER,
      system: `${WORLD}\n\nThe script of this chapter, for reference:\n${scriptOf(request.spine)}`,
      user: promptOf(request),
      schema: schemaOf(request),
      parse: Answer,
      maxTokens: 1200,
      timeoutMs: gift ? 6000 : 7500,
    });
    const beat = beatFrom(request, answer);
    const scene = request.spine.scenes.find((s) => s.id === request.position.sceneId) ?? null;
    const issues = checkBeat(beat, request.library, request.objects, scene);
    if (issues.length > 0) throw new BackendError('invalid_output', `the beat failed its check: ${issues.map((i) => i.code).join(', ')}`);
    return readyOf(beat);
  };
}
