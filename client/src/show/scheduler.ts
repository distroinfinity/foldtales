import { bindBeat, pickProblemRule, type Beat, type Bindings, type SceneProblem, type Spine, type StageAction } from '@tabletop/contracts';
import { scheduleBeat, type Timed } from './schedule.ts';

/**
 * The show's brain, with no DOM and no Three: the headset and the offline simulator run exactly
 * this. It follows the beat cursor through the spine's scenes, opens a problem when its ask
 * starts, lets a gift preempt at once, and moves on when nobody helps. Everything it decides is
 * kept as bound executions, so the stage is a pure function of this history plus the clock.
 */

/** Holding something defers an "ignored" beat, but only this much in total for each problem. */
export const HOLD_GRACE_MS = 20_000;
/** And for this long after you let go. */
export const RELEASE_GRACE_MS = 3000;

export interface Execution {
  beatId: string;
  scene: number;
  bindings: Bindings;
  startMs: number;
  /** Where a preemption cut it, or null if it ran (or is running) its course. */
  cutMs: number | null;
  /** Extra time held at its end while the reader held something. */
  holdMs: number;
}

export interface ProblemState {
  id: string;
  scene: number;
  openedAtMs: number;
  /** Holding grace used so far. */
  graceMs: number;
  /** Objects already tried that didn't solve it. */
  tried: string[];
  status: 'open' | 'solved' | 'ignored';
  closedAtMs: number | null;
}

export interface SchedulerSnapshot {
  v: 1;
  history: Execution[];
  problems: ProblemState[];
  ended: boolean;
  lastHoldMs: number | null;
}

export type GiftOutcome =
  | { kind: 'rule'; problemId: string; ruleId: string; outcome: 'solved' | 'partial'; beatId: string }
  | { kind: 'fallback'; problemId: string; beatId: string }
  /** Tried already: a wordless "can't do that", since no line ever repeats. */
  | { kind: 'repeat'; problemId: string }
  /** Nothing is being asked: the character takes it, turns it over and sets it down. */
  | { kind: 'aside' };

export type SchedulerEvent =
  | { type: 'beat.started'; beatId: string; atMs: number }
  | { type: 'beat.completed'; beatId: string; atMs: number }
  | { type: 'beat.preempted'; beatId: string; atMs: number }
  | { type: 'problem.opened'; problemId: string; atMs: number; opensDrawer: boolean }
  | { type: 'problem.ignored'; problemId: string; atMs: number }
  | { type: 'episode.ended'; atMs: number };

export interface Scheduler {
  readonly spine: Spine;
  snapshot(): SchedulerSnapshot;
  /** Advance to `nowMs`. `holding` is whether the reader has something in hand right now. */
  tick(nowMs: number, holding: boolean): SchedulerEvent[];
  /** A gift released to a character. Preempts immediately when it answers an open problem. */
  gift(nowMs: number, objectId: string, tags: readonly string[], receiver: string): { outcome: GiftOutcome; events: SchedulerEvent[] };
  /** The reader moved the story on early (turning the page): cuts the current beat and goes on. */
  skip(nowMs: number): SchedulerEvent[];
  /** Every action played or playing, at absolute show times, with cuts applied. */
  timeline(): Timed[];
  /** Which execution each timeline item came from. Same order as `timeline()`. */
  current(): Execution;
  beat(id: string): Beat;
  /** The scene showing now. */
  scene(): number;
  /** When the current scene began. */
  sceneStartMs(): number;
  openProblem(nowMs: number): ProblemState | null;
  readonly ended: boolean;
}

const NO_BINDINGS: Bindings = { offered: null, receiver: null, giver: null };

export function createScheduler(spine: Spine, durationOf: (action: StageAction) => number, restore?: SchedulerSnapshot): Scheduler {
  const beats = new Map<string, { beat: Beat; scene: number }>();
  spine.scenes.forEach((scene, i) => scene.beats.forEach((beat) => beats.set(beat.id, { beat, scene: i })));
  const problemOf = (scene: number): SceneProblem | null => spine.scenes[scene]?.problem ?? null;

  let history: Execution[] = restore ? structuredClone(restore.history) : [];
  let problems: ProblemState[] = restore ? structuredClone(restore.problems) : [];
  let ended = restore?.ended ?? false;
  let lastHoldMs: number | null = restore?.lastHoldMs ?? null;
  let cache: { key: string; items: Timed[] } | null = null;

  const lookup = (id: string) => {
    const found = beats.get(id);
    if (!found) throw new Error(`no beat ${id}`);
    return found;
  };
  const bound = (e: Execution): Beat => bindBeat(lookup(e.beatId).beat, e.bindings);
  const schedOf = (e: Execution) => scheduleBeat(bound(e), durationOf);
  const naturalEnd = (e: Execution): number => e.startMs + schedOf(e).totalMs;
  const endOf = (e: Execution): number => (e.cutMs !== null ? e.cutMs : naturalEnd(e) + e.holdMs);

  const start = (beatId: string, atMs: number, bindings: Bindings = NO_BINDINGS): SchedulerEvent[] => {
    const { scene } = lookup(beatId);
    history.push({ beatId, scene, bindings, startMs: atMs, cutMs: null, holdMs: 0 });
    cache = null;
    const events: SchedulerEvent[] = [{ type: 'beat.started', beatId, atMs }];
    const problem = problemOf(scene);
    const state = problem ? problems.find((p) => p.id === problem.id && p.status === 'open') : null;
    if (problem && state && beatId === problem.ignored.beat) {
      state.status = 'ignored';
      state.closedAtMs = atMs;
      events.push({ type: 'problem.ignored', problemId: problem.id, atMs });
    }
    return events;
  };

  if (!restore) start(spine.scenes[0]!.entry, 0);

  const current = (): Execution => history[history.length - 1]!;

  /** The ask in a beat for its scene's problem, if any. */
  const askOf = (beat: Beat, scene: number) => {
    const problem = problemOf(scene);
    if (!problem) return null;
    const index = beat.actions.findIndex((a) => a.do === 'ask_reader' && a.problem === problem.id);
    return index < 0 ? null : { index, problem, action: beat.actions[index] as Extract<StageAction, { do: 'ask_reader' }> };
  };

  /** Where the cursor goes after this execution ends on its own. */
  const nextOf = (e: Execution): string | 'end' => {
    const { beat } = lookup(e.beatId);
    const ask = askOf(beat, e.scene);
    if (ask && problems.some((p) => p.id === ask.problem.id && p.status === 'open')) return ask.problem.ignored.beat;
    if (beat.next) return beat.next;
    const nextScene = spine.scenes[e.scene + 1];
    return nextScene ? nextScene.entry : 'end';
  };

  const openProblems = (nowMs: number): SchedulerEvent[] => {
    const e = current();
    const ask = askOf(lookup(e.beatId).beat, e.scene);
    if (!ask || problems.some((p) => p.id === ask.problem.id)) return [];
    // A problem opens as its asking beat begins: whatever leads up to the ask is already about it,
    // so a reader who helps before the words are out is answering it.
    const at = e.startMs;
    if (at > nowMs) return [];
    problems.push({ id: ask.problem.id, scene: e.scene, openedAtMs: at, graceMs: 0, tried: [], status: 'open', closedAtMs: null });
    return [{ type: 'problem.opened', problemId: ask.problem.id, atMs: at, opensDrawer: ask.action.opensDrawer }];
  };

  return {
    spine,
    get ended() {
      return ended;
    },
    snapshot: () => ({ v: 1, history: structuredClone(history), problems: structuredClone(problems), ended, lastHoldMs }),
    beat: (id) => lookup(id).beat,
    current,
    scene: () => current().scene,
    sceneStartMs() {
      const scene = current().scene;
      return history.find((e) => e.scene === scene)!.startMs;
    },
    openProblem(nowMs) {
      return problems.find((p) => p.status === 'open' && p.scene === current().scene && p.openedAtMs <= nowMs) ?? null;
    },
    tick(nowMs, holding) {
      const events: SchedulerEvent[] = [];
      if (holding) lastHoldMs = nowMs;
      for (let guard = 0; guard < 64 && !ended; guard++) {
        events.push(...openProblems(nowMs));
        const e = current();
        const end = endOf(e);
        if (nowMs < end) break;
        const next = nextOf(e);
        // Nobody helped: the show goes on, unless the reader is holding something (up to the grace).
        const problem = problemOf(e.scene);
        const state = problem && next === problem.ignored.beat ? problems.find((p) => p.id === problem.id && p.status === 'open') : null;
        if (state && e.cutMs === null) {
          const deferring = holding || (lastHoldMs !== null && nowMs - lastHoldMs < RELEASE_GRACE_MS);
          const room = HOLD_GRACE_MS - state.graceMs;
          if (deferring && room > 0) {
            const grant = Math.min(room, nowMs - end + 1);
            e.holdMs += grant;
            state.graceMs += grant;
            cache = null;
            continue;
          }
        }
        events.push({ type: 'beat.completed', beatId: e.beatId, atMs: end });
        if (next === 'end') {
          ended = true;
          events.push({ type: 'episode.ended', atMs: end });
          break;
        }
        events.push(...start(next, end));
      }
      return events;
    },
    gift(nowMs, objectId, tags, receiver) {
      const events = this.tick(nowMs, false);
      // A reader ahead of the story: this spread's problem hasn't been asked yet, but a gift that answers it counts.
      const scene = current().scene;
      const sceneProblem = problemOf(scene);
      if (sceneProblem && !problems.some((p) => p.id === sceneProblem.id) && sceneProblem.rules.some((r) => r.outcome === 'solved' && r.anyTags.some((t) => tags.includes(t)))) {
        problems.push({ id: sceneProblem.id, scene, openedAtMs: nowMs, graceMs: 0, tried: [], status: 'open', closedAtMs: null });
        events.push({ type: 'problem.opened', problemId: sceneProblem.id, atMs: nowMs, opensDrawer: false });
      }
      const state = this.openProblem(nowMs);
      const problem = state ? problemOf(state.scene) : null;
      if (!state || !problem) return { outcome: { kind: 'aside' }, events };
      if (state.tried.includes(objectId)) return { outcome: { kind: 'repeat', problemId: state.id }, events };
      const pick = pickProblemRule(problem, tags);
      const beatId = pick.kind === 'rule' ? pick.rule.beat : pick.beat;
      // A branch already played (two different wrong gifts landing on the same fallback) never repeats its lines.
      if (history.some((h) => h.beatId === beatId)) {
        state.tried.push(objectId);
        return { outcome: { kind: 'repeat', problemId: state.id }, events };
      }
      const e = current();
      e.cutMs = nowMs;
      events.push({ type: 'beat.preempted', beatId: e.beatId, atMs: nowMs });
      if (pick.kind === 'rule' && pick.rule.outcome === 'solved') {
        state.status = 'solved';
        state.closedAtMs = nowMs;
      } else state.tried.push(objectId);
      events.push(...start(beatId, nowMs, { offered: objectId, receiver, giver: 'reader' }));
      const outcome: GiftOutcome =
        pick.kind === 'rule'
          ? { kind: 'rule', problemId: state.id, ruleId: pick.rule.id, outcome: pick.rule.outcome, beatId }
          : { kind: 'fallback', problemId: state.id, beatId };
      return { outcome, events };
    },
    skip(nowMs) {
      const events = this.tick(nowMs, false);
      if (ended) return events;
      const e = current();
      if (nowMs >= endOf(e)) return events;
      e.cutMs = nowMs;
      cache = null;
      return [...events, ...this.tick(nowMs, false)];
    },
    timeline() {
      const key = history.map((e) => `${e.beatId}:${e.startMs}:${e.cutMs}:${e.holdMs}`).join('|');
      if (cache?.key === key) return cache.items;
      const items: Timed[] = [];
      history.forEach((e, n) => {
        for (const item of schedOf(e).items) {
          const startMs = e.startMs + item.startMs;
          if (e.cutMs !== null && startMs >= e.cutMs) continue;
          const endMs = e.startMs + item.endMs;
          items.push({ index: items.length, action: item.action, startMs, endMs: e.cutMs !== null ? Math.min(endMs, e.cutMs) : endMs, key: `${n}:${item.index}` });
        }
      });
      cache = { key, items };
      return items;
    },
  };
}
