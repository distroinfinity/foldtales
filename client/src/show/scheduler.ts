import { bindBeat, pickProblemRule, type Beat, type Bindings, type SceneProblem, type Spine, type StageAction } from '@tabletop/contracts';
import { scheduleBeat, type Timed } from './schedule.ts';

/**
 * The show's brain, with no DOM and no Three: the headset and the offline simulator run exactly
 * this. It follows the beat cursor through the spine's scenes, opens a problem when its ask
 * starts, lets a gift preempt at once, and moves on when nobody helps. Everything it decides is
 * kept as bound executions, so the stage is a pure function of this history plus the clock.
 */

/** Holding something defers an "ignored" beat, but only this much in total for each problem. */
export const HOLD_GRACE_MS = 12_000;
/** And for this long after you let go. */
export const RELEASE_GRACE_MS = 3000;
/** All the holding grace one episode can spend, so holding through every ask still ends inside the time-box. */
export const EPISODE_GRACE_MS = 20_000;
/** A director beat is admitted only if the chapter's slowest projected end stays this far inside its limit. */
export const TIMEBOX_MARGIN_MS = 5000;

export interface Execution {
  beatId: string;
  scene: number;
  bindings: Bindings;
  startMs: number;
  /** Where a preemption cut it, or null if it ran (or is running) its course. */
  cutMs: number | null;
  /** Extra time held at its end while the reader held something. */
  holdMs: number;
  /** The remainder of a beat starts at this action (a group's first). 0 for a whole beat. */
  fromIndex?: number;
  /** Cut only to let a director beat in: its remainder plays after, so nothing in it is pulled forward. */
  suspended?: boolean;
  /** Where a suspended beat's entrances land if its remainder never plays (a gift took over). */
  hoistAtMs?: number;
  /** Pauses in this beat play at this share of their length, when the chapter is running long. */
  waitScale?: number;
  /** A director beat's way back: the rest of the beat it was spliced into. */
  resume?: { beatId: string; fromIndex: number; bindings: Bindings } | null;
}

/** A validated director beat waiting for its moment. */
export interface Offer {
  beat: Beat;
  kind: 'reaction' | 'callback';
  offeredAtMs: number;
  expiresAtMs: number;
}

export type OfferEvent =
  | { type: 'offer.admitted'; beatId: string; kind: Offer['kind']; atMs: number; waitedMs: number }
  | { type: 'offer.expired'; beatId: string; kind: Offer['kind']; atMs: number; reason: 'expired' | 'scene' | 'timebox' | 'preempted' };

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
  v: 2;
  history: Execution[];
  problems: ProblemState[];
  ended: boolean;
  lastHoldMs: number | null;
  /** Holding grace spent this episode. */
  graceUsedMs: number;
  /** The director beats that played, so their executions rebuild on resume. */
  director: Beat[];
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
  | { type: 'episode.ended'; atMs: number }
  | OfferEvent;

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
  /** A validated director beat to splice in at the next good moment, or drop if that moment doesn't come in time. */
  offer(offer: Offer): void;
  /** Director beats waiting for their moment. */
  offers(): readonly Offer[];
  /** The latest the chapter could end from here, along its slowest remaining path, before any new director beat. */
  projectedEndMs(nowMs: number): number;
  /** The chapter's upper limit, in ms. */
  readonly maxMs: number;
  readonly ended: boolean;
}

const NO_BINDINGS: Bindings = { offered: null, receiver: null, giver: null };

/** `probe` is a look ahead: it plays the rest straight, with no bridges. */
export function createScheduler(spine: Spine, durationOf: (action: StageAction) => number, restore?: SchedulerSnapshot, probe = false): Scheduler {
  const beats = new Map<string, { beat: Beat; scene: number }>();
  spine.scenes.forEach((scene, i) => scene.beats.forEach((beat) => beats.set(beat.id, { beat, scene: i })));
  // Bridges belong to no scene: each plays in whichever scene needs it, at most once.
  for (const bridge of spine.bridges) beats.set(bridge.id, { beat: bridge, scene: -1 });
  const minMs = spine.targetSeconds.min * 1000;
  const problemOf = (scene: number): SceneProblem | null => spine.scenes[scene]?.problem ?? null;

  const director: Beat[] = [];
  const addDirector = (beat: Beat, scene: number) => {
    if (beats.has(beat.id)) return;
    beats.set(beat.id, { beat, scene });
    director.push(beat);
  };
  const sceneIndexOf = (sceneId: string | null) => spine.scenes.findIndex((s) => s.id === sceneId);
  if (restore?.v === 2) for (const beat of restore.director) addDirector(beat, Math.max(0, sceneIndexOf(beat.sceneId)));

  let history: Execution[] = restore ? structuredClone(restore.history) : [];
  let problems: ProblemState[] = restore ? structuredClone(restore.problems) : [];
  let ended = restore?.ended ?? false;
  let lastHoldMs: number | null = restore?.lastHoldMs ?? null;
  let graceUsedMs = restore?.v === 2 ? restore.graceUsedMs : 0;
  let pendingOffers: Offer[] = [];
  /** Group boundaries up to here have been considered for a splice already. */
  let spliceCheckedMs = -1;
  let cache: { key: string; items: Timed[] } | null = null;
  const maxMs = spine.targetSeconds.max * 1000;

  const lookup = (id: string) => {
    const found = beats.get(id);
    if (!found) throw new Error(`no beat ${id}`);
    return found;
  };
  const bound = (e: Execution): Beat => {
    const beat = bindBeat(lookup(e.beatId).beat, e.bindings);
    return e.fromIndex ? { ...beat, actions: beat.actions.slice(e.fromIndex) } : beat;
  };
  /** Item indices stay the beat's own, so a remainder's actions keep their places. */
  const schedOf = (e: Execution) => {
    const scale = e.waitScale ?? 1;
    const sched = scheduleBeat(bound(e), scale === 1 ? durationOf : (a) => (a.do === 'wait' ? durationOf(a) * scale : durationOf(a)));
    const from = e.fromIndex ?? 0;
    return from ? { ...sched, items: sched.items.map((i) => ({ ...i, index: i.index + from })) } : sched;
  };
  const naturalEnd = (e: Execution): number => e.startMs + schedOf(e).totalMs;
  const endOf = (e: Execution): number => (e.cutMs !== null ? e.cutMs : naturalEnd(e) + e.holdMs);

  const start = (beatId: string, atMs: number, bindings: Bindings = NO_BINDINGS, extra: Partial<Execution> = {}): SchedulerEvent[] => {
    const found = lookup(beatId);
    const scene = found.scene >= 0 ? found.scene : (extra.scene ?? current().scene);
    history.push({ beatId, bindings, startMs: atMs, cutMs: null, holdMs: 0, ...extra, scene });
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
    if (e.resume) return e.resume.beatId;
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


  const isPageInvite = (beatId: string): boolean => lookup(beatId).beat.actions.some((a) => a.do === 'cue' && /page-invite|page-turn/.test(a.cue));
  const quiet = (a: StageAction | undefined): boolean => !!a && (a.do === 'wait' || a.do === 'narrate' || a.do === 'speak' || a.do === 'move');
  const speakerOf = (a: StageAction | undefined): string | null => (a?.do === 'speak' ? a.who : a?.do === 'narrate' ? 'narrator' : null);

  /** How long a beat and the beats after it in its scene take, played straight through. */
  const chainMs = (beatId: string): number => {
    let total = 0;
    const seen = new Set<string>();
    for (let id: string | null = beatId; id && !seen.has(id); id = lookup(id).beat.next) {
      seen.add(id);
      total += scheduleBeat(lookup(id).beat, durationOf).totalMs;
    }
    return total;
  };
  const extraCache = new Map<string, number>();
  /** The most a problem's branches can add over nobody helping. */
  const worstExtraMs = (problem: SceneProblem): number => {
    const cached = extraCache.get(problem.id);
    if (cached !== undefined) return cached;
    const ignored = chainMs(problem.ignored.beat);
    const solved = problem.rules.filter((r) => r.outcome === 'solved').map((r) => r.beat);
    const wrong = [...problem.rules.filter((r) => r.outcome === 'partial').map((r) => r.beat), problem.fallback.beat];
    // The slowest solve, or one wrong try before nobody helps, whichever is longer.
    const worst = Math.max(0, ...solved.map((b) => chainMs(b) - ignored), ...wrong.map((b) => chainMs(b) - ignored));
    extraCache.set(problem.id, worst);
    return worst;
  };

  /** When the chapter ends from here if nobody does anything more. */
  function zeroEnd(nowMs: number): number {
    const ahead = createScheduler(spine, durationOf, { v: 2, history, problems, ended, lastHoldMs: null, graceUsedMs, director: [...director] }, true);
    ahead.tick(Math.max(nowMs, 0) + 3_600_000, false);
    return ahead.ended ? ahead.timeline().reduce((m, i) => Math.max(m, i.endMs), 0) : Infinity;
  }

  /** A beat a gift started, before its first visible consequence: nothing may come between the gift and what it does. */
  function giftUnsettled(e: Execution, atIndex: number): boolean {
    if (!e.bindings.offered) return false;
    const actions = lookup(e.beatId).beat.actions;
    const first = actions.findIndex((a) => a.do === 'use' || a.do === 'cue');
    return first >= atIndex;
  }

  /** Plays an unused bridge before `resume` if the chapter would otherwise end short. Only once the last spread's problem is settled, when the rest is exact. */
  function tryBridge(atMs: number, resume: { beatId: string; fromIndex: number; bindings: Bindings }): SchedulerEvent[] | null {
    const scene = current().scene;
    if (scene !== spine.scenes.length - 1) return null;
    const p = spine.scenes[scene]!.problem;
    if (p && problems.find((x) => x.id === p.id)?.status !== 'solved' && problems.find((x) => x.id === p.id)?.status !== 'ignored') return null;
    const bridge = spine.bridges.find((b) => !history.some((h) => h.beatId === b.id));
    if (!bridge) return null;
    // Where it would end if we went straight on: the beat about to start, then the rest.
    const probeEnd = zeroEnd(atMs);
    if (probeEnd >= minMs) return null;
    return start(bridge.id, atMs, NO_BINDINGS, { resume, scene });
  }

  /**
   * The end to admit a director beat against: nobody doing anything more, plus the slowest the problem open
   * right now could still go. Later problems and holding are covered as they happen: a wrong try that would
   * run over is wordless, and a chapter running long plays its pauses shorter.
   */
  function projected(nowMs: number): number {
    let end = zeroEnd(nowMs);
    const open = problems.find((p) => p.status === 'open' && p.scene === current().scene);
    const p = open ? spine.scenes[open.scene]!.problem : null;
    if (p) end += worstExtraMs(p);
    return end;
  }

  /** Starts a waiting director beat at `atMs`, with the way back. Null if none fits. */
  function trySplice(atMs: number, resume: { beatId: string; fromIndex: number; bindings: Bindings }, callbacks = true): SchedulerEvent[] | null {
    const scene = current().scene;
    const sceneId = spine.scenes[scene]!.id;
    for (const offer of pendingOffers) {
      if (offer.offeredAtMs > atMs || offer.expiresAtMs < atMs || offer.beat.sceneId !== sceneId) continue;
      if (offer.kind === 'callback' && !callbacks) continue;
      const lengthMs = scheduleBeat(offer.beat, durationOf).totalMs;
      if (projected(atMs) + lengthMs > maxMs - TIMEBOX_MARGIN_MS) continue;
      pendingOffers = pendingOffers.filter((o) => o !== offer);
      addDirector(offer.beat, scene);
      const events: SchedulerEvent[] = [{ type: 'offer.admitted', beatId: offer.beat.id, kind: offer.kind, atMs, waitedMs: atMs - offer.offeredAtMs }];
      events.push(...start(offer.beat.id, atMs, NO_BINDINGS, { resume }));
      return events;
    }
    return null;
  }

  /** Inside the beat playing: at a group boundary that starts a new thought, a waiting director beat goes in. */
  function spliceWithin(nowMs: number): SchedulerEvent[] {
    const checked = spliceCheckedMs;
    spliceCheckedMs = Math.max(spliceCheckedMs, nowMs);
    if (ended || pendingOffers.length === 0) return [];
    const e = current();
    if (e.cutMs !== null || e.resume || lookup(e.beatId).beat.source === 'director') return [];
    const beat = bound(e);
    const items = schedOf(e).items;
    const earliest = Math.min(...pendingOffers.map((o) => o.offeredAtMs));
    const ask = askOf(lookup(e.beatId).beat, e.scene);
    for (let i = 1; i < items.length; i++) {
      const item = items[i]!;
      if (beat.actions[i]!.withPrev) continue;
      const at = e.startMs + item.startMs;
      if (at > nowMs) break;
      if (at < earliest || at <= checked) continue;
      // Never before an ask: its wait is the reader's, and a gift during it already gets a branch.
      if (ask && item.index >= ask.index) break;
      // Never between a gift and what it does.
      if (giftUnsettled(e, item.index)) continue;
      const prev = items[i - 1]!.action;
      const fresh = item.action.do === 'wait' || (quiet(item.action) && speakerOf(item.action) !== speakerOf(prev));
      if (!fresh) continue;
      // A callback waits for talk: never in the middle of something happening.
      const talkOnly = beat.actions.slice(i).every((a) => a.do === 'speak' || a.do === 'narrate' || a.do === 'emote' || a.do === 'wait');
      const events = trySplice(at, { beatId: e.beatId, fromIndex: item.index, bindings: e.bindings }, talkOnly);
      if (events) {
        e.cutMs = at;
        e.suspended = true;
        cache = null;
        return [{ type: 'beat.preempted', beatId: e.beatId, atMs: at }, ...events];
      }
    }
    return [];
  }

  function expire(nowMs: number): SchedulerEvent[] {
    const events: SchedulerEvent[] = [];
    const sceneId = spine.scenes[current().scene]!.id;
    pendingOffers = pendingOffers.filter((o) => {
      const reason = ended ? 'expired' : o.beat.sceneId !== sceneId ? 'scene' : o.expiresAtMs < nowMs ? 'expired' : null;
      if (!reason) return true;
      events.push({ type: 'offer.expired', beatId: o.beat.id, kind: o.kind, atMs: nowMs, reason });
      return false;
    });
    return events;
  }

  /** A gift took over from a director beat: the beat it was spliced into won't come back, so its entrances land now. */
  function dropResume(e: Execution, nowMs: number): void {
    if (!e.resume) return;
    const suspended = [...history].reverse().find((h) => h.suspended && h.beatId === e.resume!.beatId);
    if (suspended) {
      suspended.suspended = false;
      suspended.hoistAtMs = nowMs;
    }
    e.resume = null;
  }

  return {
    spine,
    get ended() {
      return ended;
    },
    snapshot: () => ({ v: 2, history: structuredClone(history), problems: structuredClone(problems), ended, lastHoldMs, graceUsedMs, director: structuredClone(director) }),
    maxMs,
    offer(offer) {
      pendingOffers.push(offer);
    },
    offers: () => pendingOffers,
    projectedEndMs: (nowMs) => projected(nowMs),
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
          const room = Math.min(HOLD_GRACE_MS - state.graceMs, EPISODE_GRACE_MS - graceUsedMs);
          if (deferring && room > 0) {
            const grant = Math.min(room, nowMs - end + 1);
            e.holdMs += grant;
            state.graceMs += grant;
            graceUsedMs += grant;
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
        // Between two beats of a scene: a director beat waiting for its moment can go first.
        const isDirector = lookup(e.beatId).beat.source === 'director';
        const isBridge = lookup(e.beatId).beat.source === 'bridge';
        if (!e.resume && !isDirector && !isBridge && lookup(next).scene === e.scene && !isPageInvite(next)) {
          const spliced = trySplice(end, { beatId: next, fromIndex: 0, bindings: NO_BINDINGS });
          if (spliced) {
            events.push(...spliced);
            continue;
          }
        }
        // A quick reader finishes early: once nothing is left to ask, unused bridges fill the walk home.
        if (!probe && !isDirector && lookup(next).scene === e.scene) {
          const bridged = tryBridge(end, e.resume && isBridge ? e.resume : { beatId: next, fromIndex: 0, bindings: NO_BINDINGS });
          if (bridged) {
            events.push(...bridged);
            continue;
          }
        }
        const resume = e.resume;
        const extra: Partial<Execution> = resume && resume.fromIndex > 0 ? { fromIndex: resume.fromIndex } : {};
        // Running long: the pauses in the next beat get shorter, so the chapter still ends in time.
        if (!probe && lookup(next).beat.actions.some((a) => a.do === 'wait')) {
          const overrun = zeroEnd(end) - (maxMs - TIMEBOX_MARGIN_MS);
          if (overrun > 0) extra.waitScale = 0.35;
        }
        events.push(...start(next, end, resume?.bindings ?? NO_BINDINGS, extra));
      }
      events.push(...spliceWithin(nowMs));
      events.push(...expire(nowMs));
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
      // A wrong try that would run the chapter past its limit gets the wordless "can't do that" instead.
      if (!probe && !(pick.kind === 'rule' && pick.rule.outcome === 'solved')) {
        const ahead = createScheduler(spine, durationOf, this.snapshot(), true);
        ahead.gift(nowMs, objectId, tags, receiver);
        ahead.tick(nowMs + 3_600_000, false);
        const end = ahead.timeline().reduce((m, i) => Math.max(m, i.endMs), 0);
        if (end > maxMs) {
          state.tried.push(objectId);
          return { outcome: { kind: 'repeat', problemId: state.id }, events };
        }
      }
      const e = current();
      e.cutMs = nowMs;
      dropResume(e, nowMs);
      events.push({ type: 'beat.preempted', beatId: e.beatId, atMs: nowMs });
      // A new answer to the problem: reactions to earlier gifts are about a moment that has passed.
      for (const o of pendingOffers) if (o.kind === 'reaction') events.push({ type: 'offer.expired', beatId: o.beat.id, kind: o.kind, atMs: nowMs, reason: 'preempted' });
      pendingOffers = pendingOffers.filter((o) => o.kind !== 'reaction');
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
      dropResume(e, nowMs);
      cache = null;
      return [...events, ...this.tick(nowMs, false)];
    },
    timeline() {
      const key = history.map((e) => `${e.beatId}:${e.startMs}:${e.cutMs}:${e.holdMs}:${e.fromIndex ?? 0}:${e.suspended ? 1 : 0}:${e.hoistAtMs ?? ''}:${e.waitScale ?? 1}`).join('|');
      if (cache?.key === key) return cache.items;
      const items: Timed[] = [];
      history.forEach((e, n) => {
        for (const item of schedOf(e).items) {
          const startMs = e.startMs + item.startMs;
          if (e.cutMs !== null && startMs >= e.cutMs) {
            // A character's entrance is never skipped: helped early, they arrive as the help lands, so the lines after can speak to them.
            // A beat suspended for a director beat keeps its entrances for its remainder instead.
            const a = item.action;
            const at = e.hoistAtMs ?? e.cutMs;
            if (!e.suspended && a.do === 'place' && a.what.startsWith('cast:')) items.push({ index: items.length, action: a, startMs: at, endMs: at, key: `${n}:${item.index}` });
            continue;
          }
          const endMs = e.startMs + item.endMs;
          items.push({ index: items.length, action: item.action, startMs, endMs: e.cutMs !== null ? Math.min(endMs, e.cutMs) : endMs, key: `${n}:${item.index}` });
        }
      });
      cache = { key, items };
      return items;
    },
  };
}
