import { z } from 'zod';
import { NARRATOR, type StageLibrary } from './library.ts';
import { ObjectOrigin, type ShowObject } from './objects.ts';
import { Id, PLACEHOLDERS, type Issue } from './primitives.ts';
import { ROOM_EFFECTS, StageActions, type StageAction } from './stage-actions.ts';

export const LineId = z.string().regex(/^line_[a-z0-9]+$/);
export type LineId = z.infer<typeof LineId>;

/**
 * One spoken beat of audio. A null url means captions only, with an estimated duration,
 * so "voice failed, show captions" is the same type as success.
 */
export const VoiceAsset = z.strictObject({ url: z.string().min(1).nullable(), durationMs: z.number().positive() });
export type VoiceAsset = z.infer<typeof VoiceAsset>;

export const Beat = z.strictObject({
  id: Id,
  source: z.enum(['authored', 'director', 'bridge']),
  sceneId: Id.nullable(),
  estSeconds: z.number().positive().max(120),
  actions: StageActions,
  /** The authored beat after this one. Null ends the scene. Director beats always have null. */
  next: Id.nullable(),
  /** The authored beat a director beat stands in for. Null for an extra beat. The cursor moves as if the replaced beat had played. */
  replaces: Id.nullable(),
});
export type Beat = z.infer<typeof Beat>;

/** A beat is ready only once it's validated and every line has an asset. See `checkReady`. */
export const ReadyBeat = z.strictObject({ beat: Beat, voice: z.record(LineId, VoiceAsset) });
export type ReadyBeat = z.infer<typeof ReadyBeat>;

export const ProblemRule = z.strictObject({
  id: Id,
  anyTags: z.array(Id).min(1),
  beat: Id,
  outcome: z.enum(['solved', 'partial']),
});
export type ProblemRule = z.infer<typeof ProblemRule>;

/** A scene problem is written in tags, not objects. `fallback` and `ignored` are what make an authored outcome certain. */
export const SceneProblem = z.strictObject({
  id: Id,
  summary: z.string().min(1),
  rules: z.array(ProblemRule).min(1),
  fallback: z.strictObject({ beat: Id }),
  ignored: z.strictObject({ beat: Id, afterSeconds: z.number().positive() }),
});
export type SceneProblem = z.infer<typeof SceneProblem>;

export const Scene = z.strictObject({
  id: Id,
  setId: Id,
  summary: z.string().min(1),
  /** The copies on this set or in its drawer. Authored beats name these ids. */
  objects: z.array(z.strictObject({ id: Id, defId: Id, origin: ObjectOrigin.exclude(['satchel']) })),
  problem: SceneProblem.nullable(),
  entry: Id,
  beats: z.array(Beat).min(1),
});
export type Scene = z.infer<typeof Scene>;

/**
 * Scenes play in order. Each starts at `entry` and follows `next`. `next: null` ends the
 * scene, and the end of the last scene ends the episode. A problem's rule, fallback or
 * ignored beat takes over the cursor and continues along its own `next`.
 */
export const Spine = z.strictObject({
  v: z.literal(1),
  id: Id,
  title: z.string().min(1),
  premise: z.string().min(1),
  source: z.enum(['authored', 'generated']),
  targetSeconds: z.strictObject({ min: z.number().positive(), max: z.number().positive() }),
  scenes: z.array(Scene).min(1),
  /** Narrator lines for when a beat is late. A bridge belongs to no scene, so it can't name a mark, an object or a problem. */
  bridges: z.array(Beat),
});
export type Spine = z.infer<typeof Spine>;

function cyrb53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * A line's identity. The voice pipeline, audio lookup and repetition ledger all compute
 * this, so the same words from the same speaker are the same line everywhere.
 */
export function lineIdOf(speaker: string, text: string): LineId {
  const normal = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `line_${cyrb53(`${speaker}\0${normal}`)}`;
}

/** A captions-only duration: 60 ms a character, at least 800 ms. */
export function estimateSpeechMs(text: string): number {
  return Math.max(800, text.length * 60);
}

export interface BeatLine {
  speaker: string;
  text: string;
  lineId: LineId;
}

/** Every utterance in a beat, in order. */
export function linesOf(beat: Beat): BeatLine[] {
  const lines: BeatLine[] = [];
  for (const action of beat.actions) {
    if (action.do === 'speak' || action.do === 'ask_reader') {
      lines.push({ speaker: action.who, text: action.text, lineId: lineIdOf(action.who, action.text) });
    } else if (action.do === 'narrate') {
      lines.push({ speaker: NARRATOR, text: action.text, lineId: lineIdOf(NARRATOR, action.text) });
    }
  }
  return lines;
}

export type ProblemPick = { kind: 'rule'; rule: ProblemRule } | { kind: 'fallback'; beat: string };

/** Total: any tags yield a branch. The first matching rule wins, otherwise the fallback. */
export function pickProblemRule(problem: SceneProblem, tags: readonly string[]): ProblemPick {
  const held = new Set(tags);
  const rule = problem.rules.find((r) => r.anyTags.some((tag) => held.has(tag)));
  return rule ? { kind: 'rule', rule } : { kind: 'fallback', beat: problem.fallback.beat };
}

/** The action fields that hold ids. Text fields are never rewritten. */
const REF_FIELDS = ['who', 'from', 'to', 'object', 'on', 'target', 'what', 'player'] as const;

function refsOf(action: StageAction): string[] {
  const record = action as unknown as Record<string, unknown>;
  return REF_FIELDS.map((field) => record[field]).filter((value): value is string => typeof value === 'string');
}

const isPlaceholder = (ref: string): boolean => ref.includes('$');

export interface Bindings {
  offered: string | null;
  receiver: string | null;
  giver: string | null;
}

/** Returns the concrete beat for a gift. Throws if the beat needs a binding that is null. */
export function bindBeat(beat: Beat, bindings: Bindings): Beat {
  const entries = Object.entries(PLACEHOLDERS) as [keyof Bindings, string][];
  const bind = (ref: string): string => {
    for (const [name, placeholder] of entries) {
      if (!ref.endsWith(placeholder)) continue;
      const value = bindings[name];
      if (value === null) throw new Error(`beat ${beat.id} needs a binding for ${name}`);
      return ref.slice(0, -placeholder.length) + value;
    }
    return ref;
  };
  const actions = beat.actions.map((action) => {
    const copy: Record<string, unknown> = { ...action };
    for (const field of REF_FIELDS) {
      const value = copy[field];
      if (typeof value === 'string') copy[field] = bind(value);
    }
    return copy as unknown as StageAction;
  });
  return { ...beat, actions };
}

/** Is this beat validated and voiced, so it can be queued? */
export function checkReady(ready: ReadyBeat): Issue[] {
  const issues: Issue[] = [];
  ready.beat.actions.forEach((action, i) => {
    for (const ref of refsOf(action)) {
      if (isPlaceholder(ref)) issues.push({ code: 'unbound_placeholder', path: `actions.${i}`, message: `${ref} is not bound` });
    }
  });
  for (const line of linesOf(ready.beat)) {
    const asset = ready.voice[line.lineId];
    if (!asset) issues.push({ code: 'missing_voice', path: line.lineId, message: `no asset for "${line.text}"` });
    else if (!(asset.durationMs > 0)) issues.push({ code: 'bad_duration', path: line.lineId, message: 'duration must be positive' });
  }
  return issues;
}

/**
 * References and timing only. Pacing and repetition belong to the director's validator. With the
 * reader's room places, a room action or target naming an exact place (`room:couch-2`) must exist;
 * a bare kind (`room:couch`) always passes, since the app falls back to the next best place.
 */
export function checkBeat(beat: Beat, library: StageLibrary, objects: ShowObject[], scene: Scene | null, room: readonly { id: string }[] | null = null): Issue[] {
  const issues: Issue[] = [];
  const issue = (code: string, path: string, message: string) => issues.push({ code, path, message });
  const cast = new Map(library.cast.map((c) => [c.id, c]));
  const known = new Set([...objects.map((o) => o.id), ...(scene?.objects.map((o) => o.id) ?? [])]);
  const marks = new Set(library.sets.find((s) => s.id === scene?.setId)?.marks.map((m) => m.id) ?? []);
  const cues = new Set(library.cues.map((c) => c.id));
  const authored = beat.source !== 'director';

  if (beat.source === 'director' && beat.next !== null) issue('director_next', 'next', 'director beats have no next');
  if (beat.source === 'authored' && beat.replaces !== null) issue('authored_replaces', 'replaces', 'only director beats replace');
  if (beat.actions[0]?.withPrev) issue('first_with_prev', 'actions.0', 'the first action cannot be with a previous one');

  const checkCast = (id: string, path: string) => {
    if (!isPlaceholder(id) && !cast.has(id)) issue('unknown_cast', path, `${id} is not in the library`);
  };
  const checkObject = (id: string, path: string) => {
    if (!isPlaceholder(id) && !known.has(id)) issue('unknown_object', path, `${id} is not on this stage`);
  };
  const checkMark = (id: string, path: string) => {
    if (!marks.has(id)) issue('unknown_mark', path, `${id} is not on this set`);
  };
  const places = room ? new Set(room.map((p) => p.id)) : null;
  const checkRoom = (id: string, path: string) => {
    if (places && id.includes('-') && !places.has(id)) issue('unknown_room_place', path, `${id} is not in the reader's room`);
  };
  const checkTarget = (target: string | null, path: string) => {
    if (target === null || target === 'reader') return;
    const [kind, id] = target.split(':') as [string, string];
    if (kind === 'cast') checkCast(id, path);
    else if (kind === 'object') checkObject(id, path);
    else if (kind === 'mark') checkMark(id, path);
    else if (kind === 'room') checkRoom(id, path);
  };
  const checkProblem = (id: string | null, path: string) => {
    if (id !== null && id !== scene?.problem?.id) issue('unknown_problem', path, `${id} is not this scene's problem`);
  };
  const checkVoice = (who: string, path: string) => {
    const member = cast.get(who);
    if (member && member.voice === null) issue('silent_speaker', path, `${who} has no voice`);
  };

  beat.actions.forEach((action, i) => {
    const path = `actions.${i}`;
    if (!authored && refsOf(action).some(isPlaceholder)) issue('placeholder_in_director', path, 'director beats name real ids');
    switch (action.do) {
      case 'speak':
        checkCast(action.who, path);
        checkVoice(action.who, path);
        checkTarget(action.to, path);
        break;
      case 'ask_reader':
        checkCast(action.who, path);
        checkVoice(action.who, path);
        checkProblem(action.problem, path);
        break;
      case 'place':
        checkTarget(action.what, path);
        checkMark(action.at, path);
        break;
      case 'move':
        checkCast(action.who, path);
        checkTarget(action.to, path);
        break;
      case 'emote': {
        checkCast(action.who, path);
        checkTarget(action.target, path);
        const member = cast.get(action.who);
        if (member && !member.acting.includes(action.acting)) issue('acting_unavailable', path, `${action.who} can't ${action.acting}`);
        break;
      }
      case 'give':
        checkCast(action.from, path);
        checkCast(action.to, path);
        checkObject(action.object, path);
        break;
      case 'use':
        checkCast(action.who, path);
        checkObject(action.object, path);
        checkTarget(action.on, path);
        checkProblem(action.problem, path);
        break;
      case 'cue':
        if (!cues.has(action.cue)) issue('unknown_cue', path, `${action.cue} is not in the library`);
        checkTarget(action.target, path);
        break;
      case 'resolve':
        checkProblem(action.problem, path);
        break;
      case 'room': {
        const takes = ROOM_EFFECTS[action.effect].what;
        if (takes && action.what === null) issue('room_needs_object', path, `${action.effect} needs an object`);
        if (!takes && action.what !== null) issue('room_takes_no_object', path, `${action.effect} takes no object`);
        if (action.what !== null && !action.what.startsWith('object:')) issue('room_needs_object', path, `${action.effect} uses an object, not ${action.what}`);
        checkTarget(action.what, path);
        checkTarget(action.at, path);
        break;
      }
      case 'narrate':
      case 'light':
      case 'music':
      case 'wait':
        break;
    }
  });
  return issues;
}

/** References, and that every path from each entry ends, and that the last scene resolves. */
export function checkSpine(spine: Spine, library: StageLibrary): Issue[] {
  const issues: Issue[] = [];
  const issue = (code: string, path: string, message: string) => issues.push({ code, path, message });
  const tags = new Set(library.tags.map((t) => t.id));
  const defs = new Set(library.objects.map((o) => o.id));
  const sets = new Set(library.sets.map((s) => s.id));

  for (const bridge of spine.bridges) {
    if (bridge.source !== 'bridge') issue('bad_bridge', `bridges.${bridge.id}`, 'a bridge must have source bridge');
    issues.push(...checkBeat(bridge, library, [], null));
  }

  spine.scenes.forEach((scene, index) => {
    const path = `scenes.${scene.id}`;
    if (!sets.has(scene.setId)) issue('unknown_set', path, `${scene.setId} is not in the library`);
    for (const object of scene.objects) {
      if (!defs.has(object.defId)) issue('unknown_object_def', path, `${object.defId} is not in the library`);
    }

    const beats = new Map<string, Beat>();
    for (const beat of scene.beats) {
      if (beats.has(beat.id)) issue('duplicate_id', `${path}.beats`, `${beat.id} appears twice`);
      beats.set(beat.id, beat);
      if (beat.source === 'director') issue('director_in_spine', `${path}.${beat.id}`, 'a spine holds authored beats only');
      if (beat.sceneId !== scene.id) issue('wrong_scene', `${path}.${beat.id}`, `sceneId is ${beat.sceneId}`);
      issues.push(...checkBeat(beat, library, [], scene));
    }

    const exists = (id: string, where: string) => {
      if (!beats.has(id)) issue('unknown_beat', `${path}.${where}`, `${id} is not in this scene`);
    };
    exists(scene.entry, 'entry');
    for (const beat of scene.beats) if (beat.next !== null) exists(beat.next, `${beat.id}.next`);

    const problem = scene.problem;
    const branches: string[] = [];
    if (problem) {
      for (const rule of problem.rules) {
        exists(rule.beat, `problem.${rule.id}`);
        branches.push(rule.beat);
        for (const tag of rule.anyTags) if (!tags.has(tag)) issue('unknown_tag', `problem.${rule.id}`, `${tag} is not in the vocabulary`);
      }
      exists(problem.fallback.beat, 'problem.fallback');
      exists(problem.ignored.beat, 'problem.ignored');
      branches.push(problem.fallback.beat, problem.ignored.beat);
    }
    const asks = (beat: Beat) => problem !== null && beat.actions.some((a) => a.do === 'ask_reader' && a.problem === problem.id);
    if (problem && !scene.beats.some(asks)) issue('problem_never_asked', path, `nothing asks about ${problem.id}`);

    const successors = (beat: Beat): Beat[] => {
      const ids = [...(beat.next === null ? [] : [beat.next]), ...(asks(beat) ? branches : [])];
      return ids.flatMap((id) => beats.get(id) ?? []);
    };

    // Colours: absent is unseen, 1 is on the current path, 2 is finished.
    const colour = new Map<string, number>();
    let cyclic = false;
    const visit = (beat: Beat): void => {
      colour.set(beat.id, 1);
      for (const next of successors(beat)) {
        if (colour.get(next.id) === 1) {
          cyclic = true;
          issue('cycle', `${path}.${beat.id}`, `${beat.id} can lead back to ${next.id}`);
        } else if (!colour.has(next.id)) {
          visit(next);
        }
      }
      colour.set(beat.id, 2);
    };
    const entry = beats.get(scene.entry);
    if (entry) visit(entry);

    if (entry && !cyclic && index === spine.scenes.length - 1) {
      const memo = new Map<string, boolean>();
      const resolves = (beat: Beat): boolean => {
        const cached = memo.get(beat.id);
        if (cached !== undefined) return cached;
        const next = successors(beat);
        const result = beat.actions.some((a) => a.do === 'resolve') || (next.length > 0 && next.every(resolves));
        memo.set(beat.id, result);
        return result;
      };
      if (!resolves(entry)) issue('unresolved_path', path, 'a path through the last scene never resolves');
    }
  });
  return issues;
}
