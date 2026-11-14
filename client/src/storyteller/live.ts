import type { Beat, Spine, StageAction } from '@tabletop/contracts';
import type { Execution, GiftOutcome, Offer, Scheduler, SchedulerEvent, SchedulerSnapshot } from '../show/scheduler.ts';
import { scheduleBeat, type Timed } from '../show/schedule.ts';

/**
 * The AI Storyteller's scheduler: the same shape as the authored one, so the runtime, puppets, book,
 * light and beam work unchanged. Beats arrive as the story is made up and play in order; between
 * them the cast idles and listens. Each visit to a set is a new spread in a spine that grows as the
 * story goes, so a page turn always runs from the spread before to the one now.
 */

/** How long an idle stretch lasts before it's renewed (cut the moment something arrives). */
const IDLE_MS = 60_000;
const NO_BINDINGS = { offered: null, receiver: null, giver: null };

export interface Placement {
  cast: string;
  mark: string;
}

export interface LiveDeps {
  durationOf: (action: StageAction) => number;
  /** Where each character stands when the page turns to a set. */
  entrances: (setId: string, cast: readonly string[]) => Placement[];
  /** The first spread's set. */
  firstSet: string;
}

export interface LiveScheduler extends Scheduler {
  /** A voiced beat, to play after whatever is queued. */
  enqueue(beat: Beat): void;
  /** Turn the page to this set, after whatever is queued, taking `cast` along. */
  enqueueSet(setId: string, cast: readonly string[]): void;
  /** Drop everything queued and cut what's playing (an interruption). */
  interrupt(nowMs: number): void;
  /** Nothing queued and nothing but idling playing. */
  readonly idle: boolean;
  /** The set showing now. */
  readonly setId: string;
}

type Item = { kind: 'beat'; beat: Beat } | { kind: 'set'; setId: string; cast: readonly string[] };

export function createLiveScheduler(deps: LiveDeps): LiveScheduler {
  let n = 0;
  const beats = new Map<string, Beat>();
  const sceneOf = new Map<string, number>();
  const spine: Spine = {
    v: 1,
    id: 'storyteller',
    title: 'The AI Storyteller',
    premise: 'Made up live with the reader.',
    source: 'generated',
    targetSeconds: { min: 60, max: 3600 },
    scenes: [],
    bridges: [],
  };
  const history: Execution[] = [];
  const queue: Item[] = [];
  let cache: { key: string; items: Timed[] } | null = null;

  const register = (beat: Beat, scene: number) => {
    beats.set(beat.id, beat);
    sceneOf.set(beat.id, scene);
  };
  const addScene = (setId: string, first: Beat) => {
    const index = spine.scenes.length;
    spine.scenes.push({ id: `visit-${index}`, setId, summary: setId, objects: [], problem: null, entry: first.id, beats: [first] });
    register(first, index);
    return index;
  };
  const idleBeat = (scene: number): Beat => {
    const beat: Beat = { id: `idle-${n++}`, source: 'director', sceneId: spine.scenes[scene]!.id, estSeconds: 60, actions: [{ do: 'wait', withPrev: false, seconds: IDLE_MS / 1000 }], next: null, replaces: null };
    register(beat, scene);
    return beat;
  };
  const durationOf = (action: StageAction) => (action.do === 'wait' && action.seconds * 1000 === IDLE_MS ? IDLE_MS : deps.durationOf(action));
  const schedOf = (e: Execution) => scheduleBeat(beats.get(e.beatId)!, durationOf);
  const endOf = (e: Execution) => (e.cutMs !== null ? e.cutMs : e.startMs + schedOf(e).totalMs);
  const current = () => history[history.length - 1]!;
  const isIdle = (e: Execution) => e.beatId.startsWith('idle-');

  const start = (beatId: string, atMs: number): SchedulerEvent[] => {
    history.push({ beatId, scene: sceneOf.get(beatId)!, bindings: NO_BINDINGS, startMs: atMs, cutMs: null, holdMs: 0 });
    cache = null;
    return [{ type: 'beat.started', beatId, atMs }];
  };

  // The book opens on the first set: the pages rise, the lamp is lit, the light is dusk.
  const opening: Beat = {
    id: 'opening-live',
    source: 'director',
    sceneId: 'visit-0',
    estSeconds: 4,
    actions: [
      { do: 'cue', withPrev: false, cue: 'open-book', target: null },
      { do: 'cue', withPrev: true, cue: 'lamp-lit', target: null },
      { do: 'light', withPrev: true, mood: 'dusk', seconds: 1 },
      { do: 'wait', withPrev: false, seconds: 3 },
    ],
    next: null,
    replaces: null,
  };
  addScene(deps.firstSet, opening);
  start(opening.id, 0);

  /** The next thing to play, at `atMs`. */
  const advance = (atMs: number): SchedulerEvent[] => {
    const item = queue.shift();
    const scene = current().scene;
    if (!item) return start(idleBeat(scene).id, atMs);
    if (item.kind === 'beat') {
      register({ ...item.beat, sceneId: spine.scenes[scene]!.id }, scene);
      return start(item.beat.id, atMs);
    }
    // A page turn: fold, turn, rise, with everyone who came along standing on their marks.
    const turn: Beat = {
      id: `turn-${n++}`,
      source: 'director',
      sceneId: `visit-${spine.scenes.length}`,
      estSeconds: 3,
      actions: [
        { do: 'cue', withPrev: false, cue: 'page-turn', target: null },
        ...deps.entrances(item.setId, item.cast).map((p): StageAction => ({ do: 'place', withPrev: true, what: `cast:${p.cast}`, at: p.mark })),
      ],
      next: null,
      replaces: null,
    };
    addScene(item.setId, turn);
    return start(turn.id, atMs);
  };

  const scheduler: LiveScheduler = {
    spine,
    get ended() {
      return false;
    },
    maxMs: Number.MAX_SAFE_INTEGER,
    get idle() {
      return queue.length === 0 && isIdle(current());
    },
    get setId() {
      return spine.scenes[current().scene]!.setId;
    },
    enqueue(beat) {
      queue.push({ kind: 'beat', beat });
    },
    enqueueSet(setId, cast) {
      queue.push({ kind: 'set', setId, cast });
    },
    interrupt(nowMs) {
      queue.length = 0;
      const e = current();
      if (!isIdle(e) && nowMs < endOf(e)) {
        e.cutMs = nowMs;
        cache = null;
      }
    },
    snapshot: (): SchedulerSnapshot => ({ v: 2, history: structuredClone(history), problems: [], ended: false, lastHoldMs: null, graceUsedMs: 0, director: [] }),
    tick(nowMs) {
      const events: SchedulerEvent[] = [];
      for (let guard = 0; guard < 32; guard++) {
        const e = current();
        // Something arrived while idling: it starts now.
        if (isIdle(e) && queue.length > 0 && e.cutMs === null) {
          e.cutMs = Math.max(e.startMs, nowMs);
          cache = null;
        }
        const end = endOf(e);
        if (nowMs < end) break;
        events.push({ type: 'beat.completed', beatId: e.beatId, atMs: end }, ...advance(end));
      }
      return events;
    },
    gift(nowMs): { outcome: GiftOutcome; events: SchedulerEvent[] } {
      // Nothing is asked in the Storyteller: the character takes it, and the story makes something of it.
      return { outcome: { kind: 'aside' }, events: scheduler.tick(nowMs, false) };
    },
    skip: (nowMs) => scheduler.tick(nowMs, false),
    timeline() {
      const key = history.map((e) => `${e.beatId}:${e.startMs}:${e.cutMs}`).join('|');
      if (cache?.key === key) return cache.items;
      const items: Timed[] = [];
      history.forEach((e, k) => {
        for (const item of schedOf(e).items) {
          const startMs = e.startMs + item.startMs;
          if (e.cutMs !== null && startMs >= e.cutMs) continue;
          const endMs = e.startMs + item.endMs;
          items.push({ index: items.length, action: item.action, startMs, endMs: e.cutMs !== null ? Math.min(endMs, e.cutMs) : endMs, key: `${k}:${item.index}` });
        }
      });
      cache = { key, items };
      return items;
    },
    current,
    beat: (id) => beats.get(id)!,
    scene: () => current().scene,
    sceneStartMs() {
      const scene = current().scene;
      return history.find((e) => e.scene === scene)!.startMs;
    },
    openProblem: () => null,
    offer(_offer: Offer) {
      // The Storyteller's beats are enqueued, not offered.
    },
    offers: () => [],
    projectedEndMs: () => Number.MAX_SAFE_INTEGER,
  };
  return scheduler;
}
