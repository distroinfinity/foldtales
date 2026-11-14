import { lineIdOf, linesOf, NARRATOR, type BeatRequest, type ReadyBeat, type ShowObject, type Spine, type StageAction, type StageLibrary } from '@tabletop/contracts';
import { createDirector, type DirectorKind, type DirectorStats } from '../director/director.ts';
import { createScheduler, type GiftOutcome, type Scheduler, type SchedulerEvent } from './scheduler.ts';

/**
 * Whole shows with no headset: the real scheduler on a virtual clock, with a scripted Reader.
 * This is what CI runs offline to prove every path finishes in time, never stalls, never repeats
 * a line and answers every gift.
 */

export interface ReaderView {
  nowMs: number;
  scheduler: Scheduler;
  /** The open problem and how long it's been open. */
  problem: { id: string; sinceMs: number } | null;
  /** The beat playing now. */
  beatId: string;
}

export type ReaderMove =
  | { do: 'gift'; object: string; tags: string[]; to: string }
  | { do: 'skip' }
  | { do: 'hold'; on: boolean };

/** Called every simulated frame. Returns what the reader does now. */
export type Reader = (view: ReaderView) => ReaderMove[];

export interface GiftRecord {
  atMs: number;
  object: string;
  outcome: GiftOutcome;
  /** When the receiver started taking it (same tick is 0). Null for a repeat, which is wordless. */
  takeAfterMs: number | null;
  /** When something visibly happened because of it: a use, a cue or the set-down. */
  consequenceAfterMs: number | null;
  /** When the director's own reaction to it started playing, if it did. */
  reactionAfterMs?: number | null;
}

/** A scripted director: how long each answer takes (null: it fails), and what it says. */
export interface SimDirector {
  library: StageLibrary;
  onStage: readonly string[];
  objects: (spine: Spine, sceneIndex: number) => ShowObject[];
  latencyMs(kind: DirectorKind, n: number): number | null;
  /** Defaults to a line or two from whoever is present. */
  write?(request: BeatRequest, kind: DirectorKind, n: number): ReadyBeat;
}

/** Two short lines from people present, new every time. */
export function cannedDirectorBeat(request: BeatRequest, kind: DirectorKind, n: number): ReadyBeat {
  const speakers = request.library.cast.filter((c) => c.voice !== null);
  const who = request.trigger.kind === 'gift' ? request.trigger.castId : (speakers[n % Math.max(1, speakers.length)]?.id ?? NARRATOR);
  const other = speakers.find((c) => c.id !== who)?.id ?? null;
  const actions: StageAction[] = [
    { do: 'emote', withPrev: false, who, acting: 'look', target: 'reader' },
    { do: 'speak', withPrev: true, who, text: `A ${kind} from the director, number ${n}, about what you did just now.`, mood: 'warm', to: 'reader' },
  ];
  if (other) actions.push({ do: 'wait', withPrev: false, seconds: 0.4 }, { do: 'speak', withPrev: false, who: other, text: `And a second line for ${kind} ${n}.`, mood: 'silly', to: null });
  const beat = { id: `dir-sim-${n}`, source: 'director' as const, sceneId: request.position.sceneId, estSeconds: 8, actions, next: null, replaces: null };
  return { beat, voice: Object.fromEntries(linesOf(beat).map((l) => [l.lineId, { url: null, durationMs: Math.max(800, l.text.length * 60) }])) };
}

export interface ShowReport {
  endedAtMs: number | null;
  beats: string[];
  lines: string[];
  repeatedLines: string[];
  /** The longest stretch with nothing happening and nothing being asked. */
  longestQuietMs: number;
  quietAtMs: number;
  gifts: GiftRecord[];
  director: (DirectorStats & { admitted: Record<DirectorKind, number>; expired: number }) | null;
}

const FRAME_MS = 50;
const LIMIT_MS = 15 * 60 * 1000;

export function simulate(spine: Spine, durationOf: (action: StageAction) => number, reader: Reader, sim?: SimDirector): ShowReport {
  const scheduler = createScheduler(spine, durationOf);
  const gifts: Array<GiftRecord & { beatIndex: number }> = [];
  let holding = false;
  let nowMs = 0;
  const answers: Array<{ dueMs: number; id: number; ready: ReadyBeat | null }> = [];
  const admitted: Record<DirectorKind, number> = { reaction: 0, callback: 0 };
  let expired = 0;
  /** The gift each reaction answers, so its delivery can be timed. */
  const reactionFor = new Map<string, number>();
  let sent = 0;
  const director = sim
    ? createDirector({
        spine,
        library: sim.library,
        onStage: sim.onStage,
        durationOf,
        objects: () => sim.objects(spine, scheduler.scene()),
        canon: () => [],
        recent: () => [],
        send: (id, kind, request) => {
          const n = sent++;
          const latency = sim.latencyMs(kind, n);
          const ready = latency === null ? null : (sim.write ?? cannedDirectorBeat)(request, kind, n);
          if (ready && kind === 'reaction') reactionFor.set(ready.beat.id, gifts.length - 1);
          answers.push({ dueMs: nowMs + (latency ?? 2000), id, ready });
        },
      })
    : null;
  const watch = (events: SchedulerEvent[]) => {
    for (const e of events) {
      if (e.type === 'offer.admitted') {
        admitted[e.kind] += 1;
        const g = reactionFor.get(e.beatId);
        if (g !== undefined && gifts[g]) gifts[g]!.reactionAfterMs = e.atMs - gifts[g]!.atMs;
      } else if (e.type === 'offer.expired') expired += 1;
    }
  };
  for (; nowMs < LIMIT_MS && !scheduler.ended; nowMs += FRAME_MS) {
    if (director) {
      for (let i = answers.length - 1; i >= 0; i--) {
        if (answers[i]!.dueMs > nowMs) continue;
        const [a] = answers.splice(i, 1);
        director.receive(scheduler, nowMs, a!.id, a!.ready);
      }
    }
    watch(scheduler.tick(nowMs, holding));
    if (scheduler.ended) break;
    director?.frame(scheduler, nowMs);
    const open = scheduler.openProblem(nowMs);
    const moves = reader({ nowMs, scheduler, problem: open ? { id: open.id, sinceMs: nowMs - open.openedAtMs } : null, beatId: scheduler.current().beatId });
    for (const move of moves) {
      if (move.do === 'hold') holding = move.on;
      else if (move.do === 'skip') scheduler.skip(nowMs);
      else {
        holding = false;
        const { outcome, events } = scheduler.gift(nowMs, move.object, move.tags, move.to);
        watch(events);
        gifts.push({ atMs: nowMs, object: move.object, outcome, takeAfterMs: null, consequenceAfterMs: null, reactionAfterMs: null, beatIndex: scheduler.snapshot().history.length - 1 });
        const object = sim?.objects(spine, scheduler.scene()).find((o) => o.id === move.object) ?? null;
        director?.gift(scheduler, nowMs, object, move.to, outcome);
      }
    }
  }

  const snapshot = scheduler.snapshot();
  const timeline = scheduler.timeline();
  const endedAtMs = scheduler.ended ? nowMs : null;

  // Every line that started, in order.
  const lines: string[] = [];
  for (const item of timeline) {
    const a = item.action;
    if (a.do === 'speak' || a.do === 'narrate' || a.do === 'ask_reader') lines.push(`${a.do === 'narrate' ? 'narrator' : a.who}: ${a.text}`);
  }
  // The same line is the same words from the same speaker, as the contract's line id says.
  const seen = new Set<string>();
  const idOf = (l: string) => lineIdOf(l.slice(0, l.indexOf(': ')), l.slice(l.indexOf(': ') + 2));
  const repeatedLines = lines.filter((l) => (seen.has(idOf(l)) ? true : (seen.add(idOf(l)), false)));

  // Quiet: time covered by no action (waits don't count) and no open ask.
  const spans: Array<[number, number]> = timeline.filter((i) => i.action.do !== 'wait').map((i) => [i.startMs, Math.max(i.endMs, i.startMs + 300)]);
  for (const p of snapshot.problems) spans.push([p.openedAtMs, p.closedAtMs ?? endedAtMs ?? nowMs]);
  // Partial branches end in a wait with the problem still open: count it as asking.
  for (const e of snapshot.history) {
    const beat = scheduler.beat(e.beatId);
    const problem = spine.scenes[e.scene]?.problem;
    if (problem && beat.next === problem.ignored.beat) spans.push([e.startMs, e.cutMs ?? Infinity]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let longestQuietMs = 0;
  let quietAtMs = 0;
  const until = endedAtMs ?? nowMs;
  for (const [s, e] of spans) {
    if (s > covered && s - covered > longestQuietMs) {
      longestQuietMs = s - covered;
      quietAtMs = covered;
    }
    covered = Math.max(covered, Math.min(e, until));
  }

  // How fast each gift was answered, from the beat it started.
  for (const gift of gifts) {
    if (gift.outcome.kind === 'repeat' || gift.outcome.kind === 'aside') continue;
    const exec = snapshot.history[gift.beatIndex]!;
    const items = timeline.filter((i) => i.startMs >= exec.startMs && i.startMs <= (exec.cutMs ?? Infinity) && i.startMs >= gift.atMs);
    const take = items.find((i) => i.action.do === 'emote' && (i.action.acting === 'take' || i.action.acting === 'examine'));
    const consequence = items.find((i) => i.action.do === 'use' || i.action.do === 'cue');
    gift.takeAfterMs = take ? take.startMs - gift.atMs : null;
    gift.consequenceAfterMs = consequence ? consequence.startMs - gift.atMs : null;
  }

  return {
    endedAtMs,
    beats: snapshot.history.map((e) => e.beatId),
    lines,
    repeatedLines,
    longestQuietMs,
    quietAtMs,
    gifts: gifts.map(({ beatIndex: _, ...g }) => g),
    director: director ? { ...director.stats, admitted, expired } : null,
  };
}

/** Every line in a spine, for checking which ones a set of runs reached. */
export function allLines(spine: Spine): string[] {
  return spine.scenes.flatMap((s) => s.beats.flatMap((b) => linesOf(b).map((l) => `${l.speaker}: ${l.text}`)));
}
