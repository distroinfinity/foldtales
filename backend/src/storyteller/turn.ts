import Anthropic from '@anthropic-ai/sdk';
import {
  ACTING,
  ROOM_EFFECTS,
  RoomRef,
  type RoomEffect,
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
/** The most a turn may write. */
export const TURN_MAX_TOKENS = 1500;
/**
 * The most a turn's prompt may be, in characters (the rules plus the stage, the room, the story
 * and 40 lines of history). A real turn is about 12,000; past this the request is refused before
 * anything is paid for, so no request can buy an unbounded prompt.
 */
export const TURN_MAX_PROMPT_CHARS = 40_000;

/** What each room effect does, in the words the storyteller reads. Only the ones the client says it can show are offered. */
const ROOM_HELP: Record<RoomEffect, string> = {
  rain: 'fine painted rain falls across the reader\'s whole room, and they hear it',
  snow: 'snow falls in the room and settles on their real table and couch',
  fog: 'fog rolls along their floor',
  thunder: 'thunder rolls from outside, heard, not seen (only while it rains)',
  clear: 'the weather in the room ends',
  'night-sky': 'the room goes dark and stars and the moon come out on their ceiling',
  'stars-lantern': 'the Lantern constellation lights up overhead (only with the night sky)',
  'stars-kite': 'the Kite constellation lights up overhead (only with the night sky)',
  'stars-fox': 'the Fox constellation lights up overhead (only with the night sky)',
  'shooting-star': 'a shooting star crosses their ceiling (only with the night sky)',
  day: 'the night sky ends',
  sea: 'watercolour sea washes across their floor and laps at the couch',
  'tide-in': 'the tide rises on their floor (only with the sea)',
  'tide-out': 'the tide falls (only with the sea)',
  boat: 'a paper boat sails off the page onto the sea (only with the sea)',
  'boat-home': 'the circling paper boat turns for home and sails across the floor to the book (only with the sea and a boat)',
  bottle: 'a bottle with a message washes up at the reader\'s feet: name the object',
  'sea-off': 'the sea ends',
  shadows: 'the cast throw giant shadows on the reader\'s wall from the light',
  'shadows-off': 'the shadows end',
  hunt: 'the object is hidden in the reader\'s room and the lighthouse beam sweeps the room and finds it there; the reader fetches it. Name the object, and a place with at:',
  fireflies: 'fireflies drift off the page into the room and follow the reader\'s hand',
  'fireflies-off': 'the fireflies go',
  gulls: 'gulls fly in and perch on a place in the room',
  'gulls-off': 'the gulls fly off',
  window: 'a window onto the story\'s night sea opens in the reader\'s room, on their real window or a wall (at: names which), with the lighthouse beam passing',
  'window-off': 'the window goes back to normal',
};
/** What a room effect needs showing first. */
const ROOM_NEEDS: Partial<Record<RoomEffect, RoomEffect>> = {
  thunder: 'rain',
  'stars-lantern': 'night-sky',
  'stars-kite': 'night-sky',
  'stars-fox': 'night-sky',
  'shooting-star': 'night-sky',
  'tide-in': 'sea',
  'tide-out': 'sea',
  boat: 'sea',
};
/** What a room effect turns on or off, for later steps in the same turn. */
function roomAfter(on: Set<string>, effect: RoomEffect): void {
  const weather = ['rain', 'snow', 'fog'];
  if (weather.includes(effect)) {
    for (const w of weather) on.delete(w);
    on.add(effect);
    if (effect !== 'fog') on.delete('night-sky');
  } else if (effect === 'clear') for (const w of weather) on.delete(w);
  else if (effect === 'night-sky') {
    on.add(effect);
    on.delete('rain');
    on.delete('snow');
  } else if (effect === 'day') on.delete('night-sky');
  else if (effect === 'sea-off') on.delete('sea');
  else if (effect.endsWith('-off')) on.delete(effect.slice(0, -4));
  else if (['sea', 'shadows', 'fireflies', 'gulls', 'window'].includes(effect)) on.add(effect);
}

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
ROOM <effect> [object:<id>] [at:<room place>]   an effect in the reader's real room. Only the effects listed for tonight. Write it on the line just before the words that talk about it
LISTEN <who>               end the turn: the cast turns to the reader and waits
TITLE | <the story's name> once, when the reader gives the story its premise: a storybook title under 60 characters
PLAN | <private plan>       once, after TITLE: one or two sentences, never spoken: the problem, two moments to ask the reader, and how it ends
END | <summary>             only on the story's last turn, after its last lines: two or three short sentences of what happened, for the story's page

Rules:
- Only name cast, objects, marks, sets, actings and cues listed for this turn. Anything else is thrown away.
- Make the stage move: a turn usually has 2 to 5 lines of talk and at least one MOVE, ACT, LIGHT, CUE, SET or PAINT. Small and believable beats big and cartoonish.
- Keep turns short (10 to 25 seconds of talk). Usually end with a question or an invitation to the reader, then LISTEN. Sometimes play out a little scene first.
- Use what the reader says, exactly, as the story's direction. If they suggest a story, start telling it with the cast. If they ask a character something, that character answers in character.
- Things in the reader's satchel are theirs, kept from earlier evenings. When the reader asks for one, or the story wants it, bring it out with PLACE onto a mark. Never PAINT something the satchel already holds.
- Only describe what the stage really shows. Objects stay on the page unless a ROOM step takes them into the room: never say one flies, circles or lands somewhere in the reader's room otherwise. Of the story, only light, the lamp's beam, a flying character's MOVE and the ROOM effects listed for tonight reach the room. Say a room effect happens only in the line right after its ROOM step, and never promise one that isn't listed.
- When the reader names a thing the story needs that isn't among the objects here (a teapot, a hat, a lost key of their own), PAINT it early in the turn so it can arrive on the page; a character can go to fetch it.
- Go places: when the story moves (down to the shore, out to the gap, up to the lamp), SET the page to that set and use its marks.
- The reader's real room is listed as room places (couch-1, window-1…). Characters stay on the book and can talk about the giant's couch or window; ROOM effects use these places with at:, such as ROOM hunt object:kite at:couch-1. When the reader asks for something in their room ("make it rain", "where's my kite?"), use the ROOM effect that does it if it's listed; if none is, say so kindly in story and do something on the page instead.
- If the reader asks for something unkind or out of tone, the narrator gently turns the page to something cozier, in story.
- Never repeat a line from the evening so far.
- Never guess the reader's name, age or gender: call them "giant", "you", or by a name they've told you.
- A story lasts about ten minutes. It has a beginning (the reader's premise), a middle with two or three moments where the story turns to the reader, and a warm, complete ending. Follow the story's plan, bending it to what the reader does.
- When the reader is quiet after a question, never wait: a character decides it themselves, out loud and in character, and the story goes on.`;

function castOf(request: StoryTurnRequest) {
  return new Map(request.library.cast.map((c) => [c.id, c]));
}

/** What the backend keeps about the story, for the prompt: its name, its private plan, and the reader's last stories. */
export interface StoryContext {
  title: string | null;
  plan: string | null;
  recent: Array<{ title: string; summary: string | null }>;
  /** Paintings this story may still ask for; 0 means none (absent means unknown). */
  paintsLeft?: number;
}

export function contextOf(request: StoryTurnRequest, ctx: StoryContext = { title: null, plan: null, recent: [] }): string {
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
  const drawer = stage.objects.filter((o) => o.origin === 'drawer').map((o) => `${o.id} (the ${o.def.name})`);
  const premise = request.phase === 'welcome' && (input.kind === 'heard' || input.kind === 'gift' || input.kind === 'quiet');
  const what =
    input.kind === 'open'
      ? `The story begins: the book has just opened. Greet the reader warmly${ctx.recent.length ? ', and remember one of their earlier stories in a line' : ''}. Then invite them: tell us what tonight's story is about, or hand us something lost from the drawer${drawer.length ? ` (${drawer.join(', ')})` : ''}, and we'll find out whose it is. Then LISTEN.`
      : input.kind === 'close'
        ? 'Time to end the story, now: two to four lines that bring it to a warm, complete ending that pays off what the reader did. Then END | <summary>. No LISTEN, no question.'
        : premise && input.kind === 'quiet'
          ? `The reader hasn't chosen yet. one of the cast picks a lost thing from the drawer themselves${drawer.length ? ` (${drawer.join(', ')})` : ''} and brings it out: that is tonight's premise. Write TITLE and PLAN, then begin the story.`
          : input.kind === 'heard'
            ? `The reader said${input.to ? ` to ${input.to}` : ''}: "${input.text}"${premise ? ' That is tonight\'s premise: write TITLE and PLAN first, then begin the story.' : ''}`
            : input.kind === 'gift'
              ? `The reader handed the ${stage.objects.find((o) => o.id === input.objectId)?.def.name ?? input.objectId} to ${input.castId}.${premise ? ' That lost thing is tonight\'s premise: whose is it? Write TITLE and PLAN first, then begin the story.' : ''}`
              : input.kind === 'arrived'
                ? `The ${stage.objects.find((o) => o.id === input.objectId)?.def.name ?? input.objectId} has just arrived on the page (newly painted, or the reader took it out of their satchel). Use it.`
                : `The reader has been quiet for ${Math.round(input.seconds)} seconds. If the story asked them something, a character decides it now, out loud. Carry the story on.`;
  const shape =
    request.phase === 'closing'
      ? 'The story is winding down: head for its ending in this turn or the next.'
      : request.phase === 'middle'
        ? `The story is in its middle (${Math.round(request.activeSeconds / 60)} of about 10 minutes).`
        : 'The story is at its very beginning.';
  return [
    `Cast:\n${cast.join('\n')}`,
    `Sets:\n${sets.join('\n')}\nMarks on the set showing now: ${marks}`,
    `Light: ${stage.light}. The lighthouse lamp is ${stage.lampLit ? 'lit' : 'dark'}.`,
    objects.length ? `Objects here:\n${objects.join('\n')}` : 'No objects here yet.',
    room.length ? `The reader's real room (room places): ${room.map((r) => `${r.id} (a ${r.label})`).join(', ')}` : '',
    stage.roomFx?.available.length
      ? `Room effects you can use tonight (ROOM): ${stage.roomFx.available.map((e) => `${e}: ${ROOM_HELP[e]}`).join('; ')}.${stage.roomFx.on.length ? ` Showing in the room now: ${stage.roomFx.on.join(', ')}.` : ''}`
      : 'No room effects tonight.',
    ctx.recent.length && input.kind === 'open' ? `The reader's earlier stories (titles and endings only):\n${ctx.recent.map((r) => `- ${r.title}${r.summary ? `: ${r.summary}` : ''}`).join('\n')}` : '',
    ctx.title ? `Tonight's story: ${ctx.title}.${ctx.plan ? ` Its plan (private, never spoken): ${ctx.plan}` : ''}` : '',
    ctx.paintsLeft === 0 ? "No more painting tonight: never PAINT. If the reader asks for something new, whoever fetches things is too tired to go again tonight, and the cast uses what's on the page or in the satchel." : '',
    shape,
    history.length ? `The story so far:\n${history.slice(-40).map((h) => `${h.who}: ${h.text}`).join('\n')}` : '',
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
  | { kind: 'listen'; who: string | null }
  /** The story's name, its private plan, and (on the close) its page's summary. */
  | { kind: 'title'; text: string }
  | { kind: 'plan'; text: string }
  | { kind: 'end'; summary: string }
  /** A room effect that can't happen: the line about it is dropped too, so nothing is promised. */
  | { kind: 'refused' };

export function parseStep(line: string, request: StoryTurnRequest, setId: string, roomOn: ReadonlySet<string> = new Set(request.stage.roomFx?.on ?? [])): Step | null {
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
    case 'ROOM': {
      const effect = words[1] as RoomEffect | undefined;
      if (!effect || !request.stage.roomFx?.available.includes(effect)) return { kind: 'refused' };
      const need = ROOM_NEEDS[effect];
      if (need && !roomOn.has(need)) return { kind: 'refused' };
      const places = new Set(request.room.map((r) => r.id));
      let what: string | null = null;
      let at: string | null = null;
      for (const w of words.slice(2)) {
        if (w.startsWith('object:')) {
          if (!objects.has(w.slice(7))) return { kind: 'refused' };
          what = w;
        } else if (w.startsWith('at:') || w.startsWith('room:')) {
          const name = w.slice(w.indexOf(':') + 1);
          const ref = `room:${name}`;
          // A place by id must be in this room; a bare kind (couch) always has a next best place.
          if (!RoomRef.safeParse(ref).success || (/-[0-9]+$/.test(name) && !places.has(name))) return { kind: 'refused' };
          at = ref;
        }
      }
      if (ROOM_EFFECTS[effect].what !== (what !== null)) return { kind: 'refused' };
      return { kind: 'action', action: { do: 'room', withPrev: false, effect, what, at } };
    }
    case 'LISTEN': {
      const who = words[1];
      return { kind: 'listen', who: who && cast.has(who) ? who : null };
    }
    case 'TITLE': {
      const text = tail.replace(/["*]/g, '').trim().slice(0, 60);
      return text.length >= 3 ? { kind: 'title', text } : null;
    }
    case 'PLAN':
      return tail.length >= 10 ? { kind: 'plan', text: tail.slice(0, 600) } : null;
    case 'END': {
      const summary = tail.replace(/["*]/g, '').trim().slice(0, 400);
      return summary.length >= 10 ? { kind: 'end', summary } : null;
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
  /** Is what the reader said fit for the book? Runs alongside the turn. Fails open: Claude's PG rules are the next line. */
  moderate?: (text: string) => Promise<boolean>;
  /**
   * Is a generated line (or a title or summary) fit to be heard or saved? Fails closed: false on
   * any error or timeout. A line is released only once this has passed.
   */
  checkLine?: (text: string) => Promise<boolean>;
  /** Starts painting something new; returns the job id at once, or null when no more can be painted. */
  paint?: (storyId: string, description: string, objectId: string) => string | null;
  /** The story's name, its plan and the reader's last stories, from the backend's record. */
  story?: StoryContext;
  /** The story was named (checked), with its private plan. */
  onTitle?: (title: string, plan: string | null) => void;
  /** The real token count of the turn's Claude call, for the spend ledger. Null when it isn't known. */
  onUsage?: (tokens: number | null) => void;
}

/** What the narrator says instead of the rest of a turn that failed a check. The client plays its own recording of it. */
export const REDIRECT_LINE = 'And just then, the page turned all by itself, to somewhere cozier.';

/**
 * The turn as a stream of events, ending in exactly one of listen, redirect, ending or error. A
 * close turn (`input.kind === 'close'`) ends with `ending` instead of `listen`.
 */
export async function* storyTurn(request: StoryTurnRequest, deps: TurnDeps): AsyncGenerator<TurnEvent> {
  const started = Date.now();
  let setId = request.stage.setId;
  const closing = request.input.kind === 'close';
  const ctx = deps.story ?? { title: null, plan: null, recent: [] };
  const used = new Set(request.history.map((h) => lineIdOf(h.who === 'reader' ? 'reader' : h.who, h.text)));
  const sceneOf = (id: string): Scene => ({ id, setId: id, summary: id, objects: [], problem: null, entry: 'x', beats: [{ id: 'x', source: 'authored', sceneId: id, estSeconds: 1, actions: [{ do: 'wait', withPrev: false, seconds: 1 }], next: null, replaces: null }] });
  const check = deps.checkLine ?? (async () => true);

  const fit = request.input.kind === 'heard' && deps.moderate ? deps.moderate(request.input.text) : Promise.resolve(true);
  const stream = deps.anthropic.messages.stream(
    {
      model: MODEL,
      max_tokens: TURN_MAX_TOKENS,
      system: [{ type: 'text', text: RULES, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contextOf(request, ctx) }],
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
  let title: string | null = null;
  let plan: string | null = null;
  let summary: string | null = null;
  /** Room effects on as the turn goes, so a later step can rely on an earlier one (rain, then thunder). */
  const roomOn = new Set<string>(request.stage.roomFx?.on ?? []);
  /** A refused room effect takes the next line with it: that's the line describing it. */
  let dropNextLine = false;
  let firstAt: number | null = null;
  /** Marks a line that failed its check: the turn stops there. */
  const BLOCKED = Symbol('blocked');
  type Ready = TurnEvent | null | typeof BLOCKED;
  /** In order; each entry knows when it's ready, so voiced lines go out while the rest is written. */
  const queue: Array<{ done: boolean; value: Ready; wait: Promise<Ready> }> = [];
  const enqueue = (p: Promise<Ready>): void => {
    const entry = { done: false, value: null as Ready, wait: p };
    entry.wait = p.then((v) => {
      entry.done = true;
      entry.value = v;
      return v;
    });
    queue.push(entry);
  };

  /**
   * Checks a line first, then voices it: a line that fails its check (or whose check fails) is
   * never sent to the voice provider. Lines still check and voice in parallel with the next being
   * written, so the first words go out while the rest of the turn is written.
   */
  const voiced = async (beat: Beat): Promise<Ready> => {
    const lineList = linesOf(beat);
    const checks = await Promise.all(lineList.map((l) => check(l.text).catch(() => false)));
    if (checks.some((ok) => !ok)) return BLOCKED;
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
    if (step.kind === 'refused') {
      dropNextLine = true;
      deps.log?.('storyteller refused a room effect, and the line about it');
    } else if (step.kind === 'action') {
      if (step.action.do === 'room') roomAfter(roomOn, step.action.effect);
      pending.push(step.action);
    } else if (step.kind === 'say') {
      if (dropNextLine) {
        dropNextLine = false;
        return;
      }
      const id = lineIdOf(step.who, step.text);
      if (used.has(id) || lines >= MAX_LINES) return;
      used.add(id);
      lines += 1;
      const beat = beatOf(request, setId, pending, step);
      pending = [];
      const issues = checkBeat(beat, request.library, request.stage.objects, sceneOf(setId), request.room);
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
      if (paints >= MAX_PAINTS || closing) return;
      paints += 1;
      if (!deps.paint) return;
      const paint = deps.paint;
      // Painting costs credits: it only starts once moderation has passed the turn.
      enqueue(
        fit.then((ok) => {
          if (!ok) return null;
          const jobId = paint(request.storyId, step.description, step.objectId);
          return jobId ? { kind: 'paint' as const, jobId, objectId: step.objectId, description: step.description } : null;
        }),
      );
    } else if (step.kind === 'title') {
      // Named once, at the premise; a story that already has a name keeps it.
      if (!ctx.title && !title && !closing) {
        title = step.text;
        enqueue(check(step.text).catch(() => false).then((ok) => (ok ? { kind: 'titled' as const, title: step.text } : null)));
      }
    } else if (step.kind === 'plan') {
      plan ??= step.text;
    } else if (step.kind === 'end') {
      summary ??= step.summary;
    } else listened = step.who;
  };

  const redirect = (): TurnEvent => ({ kind: 'redirect', text: REDIRECT_LINE, voice: { url: null, durationMs: estimateSpeechMs(REDIRECT_LINE) } });
  /** Hands on a ready event; a blocked line stops the turn. */
  let releasedTitle: string | null = null;
  const release = (e: Ready): TurnEvent | 'blocked' | null => {
    if (e === BLOCKED) return 'blocked';
    if (e?.kind === 'titled') {
      releasedTitle = e.title;
      deps.onTitle?.(e.title, plan);
    }
    return e;
  };
  let usageReported = false;
  const reportUsage = (tokens: number | null): void => {
    if (usageReported) return;
    usageReported = true;
    deps.onUsage?.(tokens);
  };

  try {
    let i = 0;
    let unfit = false;
    for await (const event of stream) {
      if (event.type !== 'content_block_delta' || event.delta.type !== 'text_delta') continue;
      buffer += event.delta.text;
      for (let nl = buffer.indexOf('\n'); nl >= 0; nl = buffer.indexOf('\n')) {
        const raw = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const step = parseStep(raw, request, setId, roomOn);
        if (step && steps < MAX_STEPS && listened === undefined) take(step);
      }
      // Nothing is said until moderation has passed the turn (it runs alongside, so it rarely waits).
      if (i < queue.length && queue[i]!.done && !(await fit)) {
        unfit = true;
        break;
      }
      // Hand on whatever is checked and voiced, in order, while the rest is written.
      while (i < queue.length && queue[i]!.done) {
        const e = release(queue[i++]!.value);
        if (e === 'blocked') {
          unfit = true;
          break;
        }
        if (e) {
          if (firstAt === null && e.kind === 'beat') firstAt = Date.now();
          yield e;
        }
      }
      if (unfit) break;
    }
    if (unfit) {
      stream.abort();
      reportUsage(null);
      deps.log?.('storyteller: a check stopped the turn');
      yield redirect();
      return;
    }
    if (buffer.trim()) {
      const step = parseStep(buffer, request, setId, roomOn);
      if (step && listened === undefined) take(step);
    }
    if (pending.length) enqueue(Promise.resolve({ kind: 'beat', ready: { beat: beatOf(request, setId, pending, null), voice: {} } }));
    const final = await stream.finalMessage();
    const u = final.usage;
    reportUsage(u ? u.input_tokens + u.output_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) : null);
    // Claude's own refusal is told in story, like a failed check.
    if (final.stop_reason === 'refusal' || !(await fit)) {
      yield redirect();
      return;
    }
    // A title that arrives after its plan still carries the plan.
    for (; i < queue.length; i++) {
      const e = release(await queue[i]!.wait);
      if (e === 'blocked') {
        yield redirect();
        return;
      }
      if (e) {
        if (firstAt === null && e.kind === 'beat') firstAt = Date.now();
        yield e;
      }
    }
    // The plan is usually written after the title: save it with whichever name the story has.
    const named = releasedTitle ?? ctx.title;
    if (plan && named) deps.onTitle?.(named, plan);
    deps.log?.(`storyteller turn: first voiced beat ${firstAt ? firstAt - started : '-'} ms, all ${Date.now() - started} ms, ${lines} lines, ${steps} steps`);
    if (closing) {
      const checkedSummary = summary && (await check(summary).catch(() => false)) ? summary : null;
      yield { kind: 'ending', title: ctx.title ?? UNTITLED, summary: checkedSummary };
      return;
    }
    yield { kind: 'listen', who: listened ?? null };
  } catch (cause) {
    reportUsage(null);
    deps.log?.(`storyteller turn failed: ${String(cause)}`);
    yield { kind: 'error', code: 'upstream_failed', message: 'the story slipped' };
  }
}

/** A story's name before the cast gives it one. */
export const UNTITLED = "Tonight's story";
