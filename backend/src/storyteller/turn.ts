import Anthropic from '@anthropic-ai/sdk';
import {
  ACTING,
  NARRATOR,
  checkBeat,
  estimateSpeechMs,
  linesOf,
  lineIdOf,
  type Beat,
  type Mood,
  type ReadyBeat,
  type Scene,
  type StageAction,
  type StoryTurnRequest,
  type TurnEvent,
  type VoiceAsset,
} from '@tabletop/contracts';
import { randomUUID } from 'node:crypto';
import { cleanLine } from '../director/beat.ts';
import type { Voices } from './voices.ts';

/**
 * One turn of the AI Storyteller. Claude writes the turn as short steps, one per line, and each
 * spoken line is voiced and sent the moment it's complete, so the first words play while the rest
 * is still being written. Every step is checked against the stage library; a step that names
 * anything that isn't there is dropped, never repaired.
 */

const MODEL = 'claude-sonnet-5-5';
const MOODS = new Set<Mood>(['neutral', 'warm', 'tense', 'wonder', 'silly', 'sad', 'relief']);
/** Effects the storyteller may call by name. Crossings only on a set that has them. */
const CUES = ['gust', 'beam', 'lamp-lit', 'lamp-out', 'spark', 'set-down', 'wear', 'pocket', 'rustle', 'relight', 'lantern-out', 'cross-kite', 'cross-thread', 'cross-ladder', 'cross-rope'];
const MAX_STEPS = 18;
const MAX_LINES = 6;
const MAX_PAINTS = 1;

export const RULES = `You are the AI Storyteller of a live pop-up storybook theatre, performed by paper puppets on the reader's real table in mixed reality. The reader talks to the cast out loud and you make the story up with them, as it happens, like the best improv troupe: say yes, build on what they say, and make something you can SEE happen.

The world: the Lost and Found at the Edge of the Table, where everything lost in a house drifts home and a lighthouse calls it in. Cozy, warm, a little funny, gently brave; a bedtime picture book for teens and adults. PG. The reader is a giant, friendly presence the characters can see and talk to. Nobody mentions AI, screens, games or apps.

Write the turn as steps, one per line, nothing else. Steps:
SAY <who> <mood> [act:<acting>] [look:<target>] | <spoken words>
   who is a cast id or "narrator". mood is one of neutral warm tense wonder silly sad relief.
   act is one of that character's actings; look is reader, cast:<id> or object:<id> or mark:<id>.
   Spoken words: one or two short sentences, under 150 characters, in the character's own voice. No stage directions, no asterisks, no quotes.
MOVE <who> <mark>          walk (or fly) a character to a mark on the current set
ENTER <who> <mark>         a character who isn't on this spread steps (or flies) onto it, at a mark
ACT <who> <acting> [<target>]   acting without words (a look, a hop, a flutter)
GIVE <from> <to> <object>  one character hands another something it holds
PLACE <object> <mark>      set an object down at a mark
LIGHT <dusk|night|gold>    the light over the stage changes
CUE <cue> [<target>]       an effect: ${CUES.join(', ')}
SET <set id>               turn the page to another set (then use that set's marks)
PAINT <new-object-id> | <what it looks like>   something new that isn't in the library is fetched and painted into the story (at most one per turn; only when the story really wants a new thing)
LISTEN <who>               end the turn: the cast turns to the reader and waits

Rules:
- Only name cast, objects, marks, sets, actings and cues listed for this turn. Anything else is thrown away.
- Make the stage move: a turn usually has 2 to 5 lines of talk and at least one MOVE, ACT, LIGHT, CUE, SET or PAINT. Small and believable beats big and cartoonish.
- Keep turns short (10 to 25 seconds of talk). Usually end with a question or an invitation to the reader, then LISTEN. Sometimes play out a little scene first.
- Use what the reader says, exactly, as the story's direction. If they suggest a story, start telling it with the cast. If they ask a character something, that character answers in character.
- Things in the reader's satchel are theirs, kept from earlier evenings. When the reader asks for one, or the story wants it, bring it out with PLACE onto a mark. Never PAINT something the satchel already holds.
- Only describe what the stage really shows. Objects stay on the page: never say one flies, circles or lands somewhere in the reader's room. Of the story, only light, the lamp's beam and a flying character's MOVE reach the room.
- When the reader names a thing the story needs that isn't among the objects here (a teapot, a hat, a lost key of their own), PAINT it early in the turn so it can arrive on the page; a character can go to fetch it.
- Go places: when the story moves (down to the shore, out to the gap, up to the lamp), SET the page to that set and use its marks.
- The reader's real room is listed as room marks. You may use them: a character can look out at the giant's couch, or one who flies can fly to the window.
- If the reader asks for something unkind or out of tone, the narrator gently turns the page to something cozier, in story.
- Never repeat a line from the evening so far.
- Never guess the reader's name, age or gender: call them "giant", "you", or by a name they've told you.`;

function castOf(request: StoryTurnRequest) {
  return new Map(request.library.cast.map((c) => [c.id, c]));
}

function contextOf(request: StoryTurnRequest): string {
  const { library, stage, room, input, history } = request;
  const here = new Set(stage.cast.map((c) => c.id));
  const set = library.sets.find((s) => s.id === stage.setId);
  const cast = library.cast.map(
    (c) =>
      `- ${c.id} (${c.name}${here.has(c.id) ? `, on this spread at ${stage.cast.find((x) => x.id === c.id)?.mark ?? 'centre'}${stage.cast.find((x) => x.id === c.id)?.holding ? `, holding ${stage.cast.find((x) => x.id === c.id)!.holding}` : ''}` : ', not on this spread'}): ${c.description} ${c.persona} Actings: ${c.acting.join(', ')}.${c.voice ? '' : ' Never speaks.'}`,
  );
  const sets = library.sets.map((s) => `- ${s.id}: ${s.description}${s.id === stage.setId ? ' (showing now)' : ''}`);
  const marks = set?.marks.map((m) => `${m.id} (${m.label})`).join(', ') ?? '';
  const objects = stage.objects.map((o) => `- ${o.id}: the ${o.def.name}. ${o.def.description}${o.origin === 'satchel' ? " (in the reader's satchel: kept from an earlier evening)" : ''}${o.history.length ? ` (${o.history.map((h) => h.text).join(' ')})` : ''}`);
  const what =
    input.kind === 'open'
      ? 'The evening begins: the book has just opened. Greet the reader and start something.'
      : input.kind === 'heard'
        ? `The reader said${input.to ? ` to ${input.to}` : ''}: "${input.text}"`
        : input.kind === 'gift'
          ? `The reader handed the ${stage.objects.find((o) => o.id === input.objectId)?.def.name ?? input.objectId} to ${input.castId}.`
          : input.kind === 'arrived'
            ? `The ${stage.objects.find((o) => o.id === input.objectId)?.def.name ?? input.objectId} has just arrived on the page (newly painted, or the reader took it out of their satchel). Use it.`
            : `The reader has been quiet for ${Math.round(input.seconds)} seconds. Carry the story on a little, then invite them again.`;
  return [
    `Cast:\n${cast.join('\n')}`,
    `Sets:\n${sets.join('\n')}\nMarks on the set showing now: ${marks}`,
    `Light: ${stage.light}. The lighthouse lamp is ${stage.lampLit ? 'lit' : 'dark'}.`,
    objects.length ? `Objects here:\n${objects.join('\n')}` : 'No objects here yet.',
    room.length ? `The reader's real room (room marks): ${room.map((r) => `${r.id} (a ${r.label})`).join(', ')}` : '',
    request.canon.length ? `From earlier stories:\n${request.canon.map((c) => `- ${c.text}`).join('\n')}` : '',
    history.length ? `The evening so far:\n${history.slice(-40).map((h) => `${h.who}: ${h.text}`).join('\n')}` : '',
    `NOW: ${what}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** One parsed step, or null when it names something that isn't there. */
type Step =
  | { kind: 'say'; who: string; mood: Mood; acting: string | null; look: string | null; text: string }
  | { kind: 'action'; action: StageAction }
  | { kind: 'set'; setId: string }
  | { kind: 'paint'; objectId: string; description: string }
  | { kind: 'listen'; who: string | null };

export function parseStep(line: string, request: StoryTurnRequest, setId: string): Step | null {
  const cast = castOf(request);
  const marks = new Set(request.library.sets.find((s) => s.id === setId)?.marks.map((m) => m.id) ?? []);
  const objects = new Set(request.stage.objects.map((o) => o.id));
  const target = (t: string | undefined): string | null => {
    if (!t) return null;
    if (t === 'reader') return 'reader';
    const [kind, id] = t.split(':') as [string, string | undefined];
    if (!id) return null;
    if (kind === 'cast' && cast.has(id)) return t;
    if (kind === 'object' && objects.has(id)) return t;
    if (kind === 'mark' && marks.has(id)) return t;
    return null;
  };
  const trimmed = line.trim().replace(/^[-*\d.\s]+(?=[A-Z])/, '');
  const [head, ...rest] = trimmed.split('|');
  const words = (head ?? '').trim().split(/\s+/);
  const verb = words[0]?.toUpperCase();
  const tail = rest.join('|').trim();
  switch (verb) {
    case 'SAY': {
      const who = words[1] ?? '';
      const member = cast.get(who);
      if (who !== NARRATOR && !member?.voice) return null;
      const mood = MOODS.has(words[2] as Mood) ? (words[2] as Mood) : 'warm';
      let acting: string | null = null;
      let look: string | null = null;
      for (const w of words.slice(3)) {
        if (w.startsWith('act:') && member?.acting.includes(w.slice(4) as never)) acting = w.slice(4);
        if (w.startsWith('look:')) look = target(w.slice(5));
      }
      const text = cleanLine(tail, member?.name ?? null).slice(0, 220);
      return text.length > 1 ? { kind: 'say', who, mood, acting, look, text } : null;
    }
    case 'MOVE': {
      const [, who, mark] = words;
      if (!who || !cast.has(who) || !mark || !marks.has(mark)) return null;
      return { kind: 'action', action: { do: 'move', withPrev: false, who, to: `mark:${mark}` } };
    }
    case 'ENTER': {
      const [, who, mark] = words;
      if (!who || !cast.has(who) || !mark || !marks.has(mark) || request.stage.cast.some((c) => c.id === who)) return null;
      return { kind: 'action', action: { do: 'place', withPrev: false, what: `cast:${who}`, at: mark } };
    }
    case 'ACT': {
      const [, who, acting, t] = words;
      const member = who ? cast.get(who) : undefined;
      if (!member || !acting || !member.acting.includes(acting as never)) return null;
      return { kind: 'action', action: { do: 'emote', withPrev: false, who: member.id, acting: acting as keyof typeof ACTING, target: ACTING[acting as keyof typeof ACTING].takesTarget ? target(t) : null } };
    }
    case 'GIVE': {
      const [, from, to, object] = words;
      if (!from || !to || !object || !cast.has(from) || !cast.has(to) || !objects.has(object)) return null;
      return { kind: 'action', action: { do: 'give', withPrev: false, from, to, object } };
    }
    case 'PLACE': {
      const [, object, mark] = words;
      if (!object || !objects.has(object) || !mark || !marks.has(mark)) return null;
      return { kind: 'action', action: { do: 'place', withPrev: false, what: `object:${object}`, at: mark } };
    }
    case 'LIGHT': {
      const mood = words[1];
      if (mood !== 'dusk' && mood !== 'night' && mood !== 'gold') return null;
      return { kind: 'action', action: { do: 'light', withPrev: false, mood, seconds: 2 } };
    }
    case 'CUE': {
      const [, cue, t] = words;
      if (!cue || !CUES.includes(cue) || !request.library.cues.some((c) => c.id === cue)) return null;
      if (cue.startsWith('cross-') && !marks.has('far-side')) return null;
      return { kind: 'action', action: { do: 'cue', withPrev: false, cue, target: target(t) } };
    }
    case 'SET': {
      const id = words[1];
      return id && request.library.sets.some((s) => s.id === id) && id !== setId ? { kind: 'set', setId: id } : null;
    }
    case 'PAINT': {
      const id = (words[1] ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!id || objects.has(id) || tail.length < 3) return null;
      return { kind: 'paint', objectId: id, description: tail.slice(0, 200) };
    }
    case 'LISTEN': {
      const who = words[1];
      return { kind: 'listen', who: who && cast.has(who) ? who : null };
    }
    default:
      return null;
  }
}

/** A step's line as a beat: what led up to it, its acting, then the words. */
function beatOf(request: StoryTurnRequest, setId: string, pending: StageAction[], say: Extract<Step, { kind: 'say' }> | null): Beat {
  const actions: StageAction[] = [...pending];
  if (say) {
    const member = castOf(request).get(say.who);
    if (member && say.acting) actions.push({ do: 'emote', withPrev: false, who: member.id, acting: say.acting as keyof typeof ACTING, target: ACTING[say.acting as keyof typeof ACTING].takesTarget ? say.look : null });
    if (say.who === NARRATOR) actions.push({ do: 'narrate', withPrev: false, text: say.text, mood: say.mood });
    else actions.push({ do: 'speak', withPrev: !!(member && say.acting), who: say.who, text: say.text, mood: say.mood, to: say.look && !say.look.startsWith('object:') && !say.look.startsWith('mark:') ? say.look : null });
  }
  return { id: `st-${randomUUID().slice(0, 8)}`, source: 'director', sceneId: setId, estSeconds: 6, actions, next: null, replaces: null };
}

export interface TurnDeps {
  anthropic: Anthropic;
  voices: Voices;
  log?: (message: string) => void;
  /** Is what the reader said fit for the book? Runs alongside the turn. */
  moderate?: (text: string) => Promise<boolean>;
  /** Starts painting something new; returns the job id at once. */
  paint?: (sessionId: string, description: string, objectId: string) => string;
}

/** The turn as a stream of events, ending in exactly one of listen, redirect or error. */
export async function* storyTurn(request: StoryTurnRequest, deps: TurnDeps): AsyncGenerator<TurnEvent> {
  const started = Date.now();
  let setId = request.stage.setId;
  const used = new Set(request.history.map((h) => lineIdOf(h.who === 'reader' ? 'reader' : h.who, h.text)));
  const sceneOf = (id: string): Scene => ({ id, setId: id, summary: id, objects: [], problem: null, entry: 'x', beats: [{ id: 'x', source: 'authored', sceneId: id, estSeconds: 1, actions: [{ do: 'wait', withPrev: false, seconds: 1 }], next: null, replaces: null }] });

  const fit = request.input.kind === 'heard' && deps.moderate ? deps.moderate(request.input.text) : Promise.resolve(true);
  const stream = deps.anthropic.messages.stream(
    {
      model: MODEL,
      max_tokens: 1500,
      system: [{ type: 'text', text: RULES, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contextOf(request) }],
      thinking: { type: 'between_tools' },
      output_config: { effort: 'low' },
    },
    { timeout: 20_000 },
  );

  let buffer = '';
  let pending: StageAction[] = [];
  let lines = 0;
  let steps = 0;
  let paints = 0;
  let listened: string | null | undefined;
  let firstAt: number | null = null;
  /** In order; each entry knows when it's ready, so voiced lines go out while the rest is written. */
  const queue: Array<{ done: boolean; value: TurnEvent | null; wait: Promise<TurnEvent | null> }> = [];
  const enqueue = (p: Promise<TurnEvent | null>): void => {
    const entry = { done: false, value: null as TurnEvent | null, wait: p };
    entry.wait = p.then((v) => {
      entry.done = true;
      entry.value = v;
      return v;
    });
    queue.push(entry);
  };

  /** Voices a line now (in parallel with the next being written), and yields in order. */
  const voiced = async (beat: Beat): Promise<TurnEvent | null> => {
    const lineList = linesOf(beat);
    const voice: Record<string, VoiceAsset> = {};
    await Promise.all(
      lineList.map(async (l) => {
        voice[l.lineId] = (await deps.voices.speak(l.speaker, l.text).catch(() => null)) ?? { url: null, durationMs: estimateSpeechMs(l.text) };
      }),
    );
    const ready: ReadyBeat = { beat, voice };
    return { kind: 'beat', ready };
  };

  const take = (step: Step): void => {
    steps += 1;
    if (step.kind === 'action') {
      pending.push(step.action);
    } else if (step.kind === 'say') {
      const id = lineIdOf(step.who, step.text);
      if (used.has(id) || lines >= MAX_LINES) return;
      used.add(id);
      lines += 1;
      const beat = beatOf(request, setId, pending, step);
      pending = [];
      const issues = checkBeat(beat, request.library, request.stage.objects, sceneOf(setId));
      if (issues.length) {
        deps.log?.(`storyteller dropped a line: ${issues.map((i) => i.code).join(', ')}`);
        return;
      }
      enqueue(voiced(beat));
    } else if (step.kind === 'set') {
      if (pending.length) enqueue(Promise.resolve({ kind: 'beat', ready: { beat: beatOf(request, setId, pending, null), voice: {} } }));
      pending = [];
      setId = step.setId;
      enqueue(Promise.resolve({ kind: 'set', setId }));
    } else if (step.kind === 'paint') {
      if (paints >= MAX_PAINTS) return;
      paints += 1;
      if (!deps.paint) return;
      const jobId = deps.paint(request.sessionId, step.description, step.objectId);
      enqueue(Promise.resolve({ kind: 'paint', jobId, objectId: step.objectId, description: step.description }));
    } else listened = step.who;
  };

  try {
    let i = 0;
    for await (const event of stream) {
      if (event.type !== 'content_block_delta' || event.delta.type !== 'text_delta') continue;
      buffer += event.delta.text;
      for (let nl = buffer.indexOf('\n'); nl >= 0; nl = buffer.indexOf('\n')) {
        const raw = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const step = parseStep(raw, request, setId);
        if (step && steps < MAX_STEPS && listened === undefined) take(step);
      }
      // Hand on whatever is voiced, in order, while the rest is written.
      while (i < queue.length && queue[i]!.done) {
        const e = queue[i++]!.value;
        if (e) {
          if (firstAt === null && e.kind === 'beat') firstAt = Date.now();
          yield e;
        }
      }
    }
    if (buffer.trim()) {
      const step = parseStep(buffer, request, setId);
      if (step && listened === undefined) take(step);
    }
    if (pending.length) enqueue(Promise.resolve({ kind: 'beat', ready: { beat: beatOf(request, setId, pending, null), voice: {} } }));
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw Object.assign(new Error('refused'), { refused: true });
    if (!(await fit)) {
      const text = 'And just then, the page turned all by itself, to somewhere cozier.';
      const voice = (await deps.voices.speak(NARRATOR, text).catch(() => null)) ?? { url: null, durationMs: estimateSpeechMs(text) };
      yield { kind: 'redirect', text, voice };
      return;
    }
    for (; i < queue.length; i++) {
      const e = await queue[i]!.wait;
      if (e) {
        if (firstAt === null && e.kind === 'beat') firstAt = Date.now();
        yield e;
      }
    }
    deps.log?.(`storyteller turn: first voiced beat ${firstAt ? firstAt - started : '-'} ms, all ${Date.now() - started} ms, ${lines} lines, ${steps} steps`);
    yield { kind: 'listen', who: listened ?? null };
  } catch (cause) {
    deps.log?.(`storyteller turn failed: ${String(cause)}`);
    yield { kind: 'error', code: (cause as { refused?: boolean }).refused ? 'moderated' : 'upstream_failed', message: 'the story slipped' };
  }
}
