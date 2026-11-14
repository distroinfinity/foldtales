import { linesOf, type Spine, type StageAction } from '@tabletop/contracts';
import { createScheduler, type GiftOutcome, type Scheduler } from './scheduler.ts';

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
}

const FRAME_MS = 50;
const LIMIT_MS = 15 * 60 * 1000;

export function simulate(spine: Spine, durationOf: (action: StageAction) => number, reader: Reader): ShowReport {
  const scheduler = createScheduler(spine, durationOf);
  const gifts: Array<GiftRecord & { beatIndex: number }> = [];
  let holding = false;
  let nowMs = 0;
  for (; nowMs < LIMIT_MS && !scheduler.ended; nowMs += FRAME_MS) {
    scheduler.tick(nowMs, holding);
    if (scheduler.ended) break;
    const open = scheduler.openProblem(nowMs);
    const moves = reader({ nowMs, scheduler, problem: open ? { id: open.id, sinceMs: nowMs - open.openedAtMs } : null, beatId: scheduler.current().beatId });
    for (const move of moves) {
      if (move.do === 'hold') holding = move.on;
      else if (move.do === 'skip') scheduler.skip(nowMs);
      else {
        holding = false;
        const { outcome } = scheduler.gift(nowMs, move.object, move.tags, move.to);
        gifts.push({ atMs: nowMs, object: move.object, outcome, takeAfterMs: null, consequenceAfterMs: null, beatIndex: scheduler.snapshot().history.length - 1 });
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
  const seen = new Set<string>();
  const repeatedLines = lines.filter((l) => (seen.has(l) ? true : (seen.add(l), false)));

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
  };
}

/** Every line in a spine, for checking which ones a set of runs reached. */
export function allLines(spine: Spine): string[] {
  return spine.scenes.flatMap((s) => s.beats.flatMap((b) => linesOf(b).map((l) => `${l.speaker}: ${l.text}`)));
}
