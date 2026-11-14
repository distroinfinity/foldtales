import { linesOf, type BeatRequest, type CanonEntry, type ReadyBeat, type ShowEvent, type ShowObject, type Spine, type StageAction, type StageLibrary } from '@tabletop/contracts';
import type { GiftOutcome, Scheduler } from '../show/scheduler.ts';
import { lineIdsOf, validateDirectorBeat } from './validate.ts';

/**
 * The director's side on the client, with no DOM: what to ask for and when, and what to do with
 * the answer. The headset sends requests over HTTP; the simulator answers them on a virtual clock.
 * Either way the answer is only an offer: the scheduler splices it in at a good moment or drops it.
 */

/** A reaction is only worth hearing while the gift is fresh. */
export const REACTION_FRESH_MS = 8000;
/** A callback waits for its moment at most this long (and never past its spread). */
export const CALLBACK_FRESH_MS = 40_000;
/** Callbacks a spread can have. */
const CALLBACKS_PER_SCENE = 1;

export type DirectorKind = 'reaction' | 'callback';

export interface DirectorDeps {
  spine: Spine;
  /** The whole library. Each request narrows it to who is on the spread. */
  library: StageLibrary;
  /** Who stands on the first spread when the book opens. */
  onStage: readonly string[];
  durationOf: (action: StageAction) => number;
  /** Sends a request. The answer comes back through `receive`, with the same id, or null if it failed. */
  send(id: number, kind: DirectorKind, request: BeatRequest): void;
  /** Objects the director may name: on this spread, in a paw, in the satchel. */
  objects(): ShowObject[];
  canon(): CanonEntry[];
  recent(): ShowEvent[];
  /** Why something was dropped, for the log and telemetry. */
  note?(what: string, detail: string): void;
}

export interface DirectorStats {
  sent: Record<DirectorKind, number>;
  offered: Record<DirectorKind, number>;
  failed: number;
  rejected: number;
  stale: number;
}

/** Who is on the spread showing now: the first spread's cast, plus anyone placed on this spread so far. */
export function presentCast(scheduler: Scheduler, onStage: readonly string[], nowMs: number): Set<string> {
  const scene = scheduler.scene();
  const since = scheduler.sceneStartMs();
  const present = new Set<string>(scene === 0 ? onStage : []);
  for (const item of scheduler.timeline()) {
    if (item.startMs < since || item.startMs > nowMs) continue;
    const a = item.action;
    if (a.do === 'place' && a.what.startsWith('cast:')) present.add(a.what.slice(5));
  }
  return present;
}

/** Beats a callback may be asked for at: authored, not a page turn or an ask, not the very end. */
function quietBeat(scheduler: Scheduler, beatId: string, nowMs: number): boolean {
  const beat = scheduler.beat(beatId);
  if (beat.source === 'director') return false;
  if (scheduler.openProblem(nowMs)) return false;
  return !beat.actions.some((a) => a.do === 'ask_reader' || (a.do === 'cue' && /page-|chapter-end|keep/.test(a.cue)));
}

export function createDirector(deps: DirectorDeps) {
  const spineLines = new Set(deps.spine.scenes.flatMap((s) => s.beats.flatMap(lineIdsOf)));
  let nextId = 1;
  const inFlight = new Map<number, { kind: DirectorKind; sentAtMs: number; sceneId: string; freshUntilMs: number }>();
  let latestReaction = 0;
  let memorable = 0;
  let memorableAtCallback = 0;
  const callbacksByScene = new Map<string, number>();
  let lastBeatKey = '';
  const stats: DirectorStats = { sent: { reaction: 0, callback: 0 }, offered: { reaction: 0, callback: 0 }, failed: 0, rejected: 0, stale: 0 };

  const usedIds = (scheduler: Scheduler): Set<string> => {
    const used = new Set<string>();
    for (const item of scheduler.timeline()) {
      const a = item.action;
      if (a.do === 'speak' || a.do === 'ask_reader' || a.do === 'narrate') for (const l of linesOf({ actions: [a] } as never)) used.add(l.lineId);
    }
    return used;
  };

  function request(scheduler: Scheduler, nowMs: number, kind: DirectorKind, trigger: BeatRequest['trigger'], extra: ShowObject[] = []): void {
    const sceneIndex = scheduler.scene();
    const scene = deps.spine.scenes[sceneIndex]!;
    const present = presentCast(scheduler, deps.onStage, nowMs);
    const objects = [...deps.objects()];
    for (const o of extra) if (!objects.some((x) => x.id === o.id)) objects.push(o);
    const e = scheduler.current();
    const cursor = e.resume?.beatId ?? e.beatId;
    const snapshot = scheduler.snapshot();
    const req: BeatRequest = {
      episodeId: deps.spine.id,
      spine: deps.spine,
      library: { ...deps.library, cast: deps.library.cast.filter((c) => present.has(c.id)) },
      objects,
      position: { sceneId: scene.id, cursor, elapsedSeconds: Math.max(0, nowMs) / 1000 },
      show: {
        problems: snapshot.problems.map((p) => ({ problemId: p.id, status: p.status, objectId: null, ruleId: null })),
        holding: [],
        used: [],
      },
      canon: deps.canon(),
      recent: deps.recent().slice(-40),
      trigger,
      usedLineIds: [...usedIds(scheduler)],
      owedPlayers: [],
    };
    const id = nextId++;
    inFlight.set(id, { kind, sentAtMs: nowMs, sceneId: scene.id, freshUntilMs: nowMs + (kind === 'reaction' ? REACTION_FRESH_MS : CALLBACK_FRESH_MS) });
    if (kind === 'reaction') latestReaction = id;
    stats.sent[kind] += 1;
    deps.send(id, kind, req);
  }

  return {
    stats,
    /** Something worth remembering happened (a character picked up, a find taken). */
    remember(): void {
      memorable += 1;
    },
    /** A gift was taken. A gift nobody asked for, or one that didn't help, gets its own reaction. */
    gift(scheduler: Scheduler, nowMs: number, object: ShowObject | null, castId: string, outcome: GiftOutcome): void {
      memorable += 1;
      if (!object || (outcome.kind !== 'aside' && outcome.kind !== 'fallback')) return;
      request(scheduler, nowMs, 'reaction', { kind: 'gift', objectId: object.id, castId, playerId: 'reader' }, [object]);
    },
    /** Each frame: at the start of a quiet beat, with something new to remember, ask for a callback. */
    frame(scheduler: Scheduler, nowMs: number): void {
      if (scheduler.ended) return;
      const e = scheduler.current();
      const key = `${e.beatId}:${e.startMs}`;
      if (key === lastBeatKey) return;
      lastBeatKey = key;
      if (e.fromIndex || memorable <= memorableAtCallback) return;
      if ([...inFlight.values()].some((f) => f.kind === 'callback')) return;
      const sceneId = deps.spine.scenes[scheduler.scene()]!.id;
      if ((callbacksByScene.get(sceneId) ?? 0) >= CALLBACKS_PER_SCENE) return;
      if (!quietBeat(scheduler, e.beatId, nowMs)) return;
      callbacksByScene.set(sceneId, (callbacksByScene.get(sceneId) ?? 0) + 1);
      memorableAtCallback = memorable;
      request(scheduler, nowMs, 'callback', { kind: 'lookahead' });
    },
    /** An answer: validated against the stage as it is now, then offered, or dropped. */
    receive(scheduler: Scheduler, nowMs: number, id: number, ready: ReadyBeat | null): 'offered' | 'failed' | 'stale' | 'rejected' {
      const flight = inFlight.get(id);
      inFlight.delete(id);
      if (!flight) return 'stale';
      if (!ready) {
        stats.failed += 1;
        return 'failed';
      }
      const scene = deps.spine.scenes[scheduler.scene()]!;
      if (scheduler.ended || scene.id !== flight.sceneId || nowMs > flight.freshUntilMs || (flight.kind === 'reaction' && id !== latestReaction)) {
        stats.stale += 1;
        deps.note?.('stale', `${flight.kind} after ${Math.round(nowMs - flight.sentAtMs)} ms`);
        return 'stale';
      }
      const taken = new Set([...usedIds(scheduler), ...spineLines, ...scheduler.offers().flatMap((o) => lineIdsOf(o.beat))]);
      const objects = deps.objects();
      const issues = validateDirectorBeat(ready, {
        library: deps.library,
        objects,
        scene,
        present: presentCast(scheduler, deps.onStage, nowMs),
        taken,
        durationOf: deps.durationOf,
      });
      if (issues.length > 0) {
        stats.rejected += 1;
        deps.note?.('rejected', issues.map((i) => `${i.code}: ${i.message}`).join('; '));
        return 'rejected';
      }
      scheduler.offer({ beat: ready.beat, kind: flight.kind, offeredAtMs: nowMs, expiresAtMs: flight.freshUntilMs });
      stats.offered[flight.kind] += 1;
      return 'offered';
    },
    /** A new chapter, or the same one from the top. */
    reset(): void {
      inFlight.clear();
      memorable = 0;
      memorableAtCallback = 0;
      callbacksByScene.clear();
      lastBeatKey = '';
    },
  };
}
export type Director = ReturnType<typeof createDirector>;
