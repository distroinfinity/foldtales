/**
 * A chapter's clock on the real scheduler, offline, for four readers: quick (answers each ask
 * after 4 s), zero input, a late wrong gift (the wrong thing 2.5 s before each ask runs out,
 * then nothing), and holding (holds something through every ask). Reports when the first page
 * can be turned and when the chapter ends, for the default carry and for every carry pick.
 *
 * Run: node tools/chapter-timings.ts <episode.json> [--carry <carry.json>] [--cues <cues.json>] [--objects <objects.json>]
 * `--cues` adds nominal times for cues not yet in the manifest; `--objects` adds or overrides
 * object defs (new objects, new tags). Lines not yet voiced are timed at 1.3x the caption estimate.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ObjectDef, ROOM_EFFECTS, type Spine, type StageAction } from '../contracts/src/index.ts';
import { ShowManifest, voiceMsOf } from '../client/src/show/manifest.ts';
import { actionDuration } from '../client/src/show/schedule.ts';
import { simulate, type Reader, type ReaderMove } from '../client/src/show/simulate.ts';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const readJson = (path: string) => JSON.parse(readFileSync(resolve(path), 'utf8'));
const root = new URL('..', import.meta.url).pathname;

const manifest = ShowManifest.parse(readJson(`${root}client/public/show/manifest.json`));
const spineIn = readJson(args[0]!) as Spine;
const carry = flag('--carry') ? (readJson(flag('--carry')!) as { slots: Array<{ after: string; otherwise: string; pick: Array<{ beat: string; when: unknown }> }> }) : { slots: [] };
const extraCues = flag('--cues') ? (readJson(flag('--cues')!) as Record<string, number>) : {};
const extraDefs = flag('--objects') ? (readJson(flag('--objects')!) as unknown[]).map((d) => ObjectDef.parse(d)) : [];

const defs = new Map<string, ObjectDef>();
for (const f of manifest.objectFiles) {
  const d = ObjectDef.parse(readJson(`${root}art/${f}`));
  defs.set(d.id, d);
}
for (const d of [...manifest.extraObjects, ...extraDefs]) defs.set(d.id, d);

const voiced = voiceMsOf(manifest);
const known = new Set(Object.keys(ROOM_EFFECTS));
const durationOf = actionDuration({
  cueMs: { ...Object.fromEntries(manifest.cues.map((c) => [c.id, c.nominalMs])), ...extraCues },
  voiceMs: (speaker, text) => voiced(speaker, text) ?? Math.round(Math.max(800, text.length * 60) * 1.3),
});
/** A room call not in the contract yet (proposed in a contracts PR) is timed as a wait of its proposed length. */
const ROOM_PROPOSED: Record<string, number> = { 'boat-home': 9 };
const timed = (a: StageAction): number => (a.do === 'room' && !known.has(a.effect) ? (ROOM_PROPOSED[a.effect] ?? 0) * 1000 : durationOf(a));

/** The spine with one carry pick (or the defaults) wired in, as the client will at load. */
function withCarry(spine: Spine, choice: Map<string, string>): Spine {
  const copy = structuredClone(spine);
  for (const slot of carry.slots) {
    const to = choice.get(slot.after) ?? slot.otherwise;
    for (const scene of copy.scenes) for (const b of scene.beats) if (b.id === slot.after) b.next = to;
  }
  return copy;
}

const tagsOf = (id: string) => [...(defs.get(id)?.tags ?? ['rolls', 'heavy'])];
const gift = (object: string): ReaderMove => ({ do: 'gift', object, tags: tagsOf(object), to: 'pip' });

function readerFor(spine: Spine, kind: 'quick' | 'zero' | 'late-wrong' | 'hold', seen: { firstTurnMs: number | null; starts?: Map<string, number> }): Reader {
  const done = new Set<string>();
  const available = (scene: number) => spine.scenes.slice(0, scene + 1).flatMap((s) => s.objects.map((o) => o.id));
  return (view) => {
    if (seen.starts && !seen.starts.has(view.beatId)) seen.starts.set(view.beatId, view.nowMs);
    if (seen.firstTurnMs === null && view.beatId === spine.scenes[0]!.beats.find((b) => b.actions.some((a) => a.do === 'cue' && a.cue === 'page-invite'))?.id) seen.firstTurnMs = view.nowMs;
    if (kind === 'hold') return [{ do: 'hold', on: view.problem !== null }];
    if (kind === 'zero' || !view.problem || done.has(view.problem.id)) return [];
    const scene = spine.scenes.findIndex((s) => s.problem?.id === view.problem!.id);
    const problem = spine.scenes[scene]!.problem!;
    const ask = spine.scenes[scene]!.beats.flatMap((b) => b.actions).find((a) => a.do === 'ask_reader' && a.problem === problem.id);
    const waitMs = ask && ask.do === 'ask_reader' ? ask.waitSeconds * 1000 : 16_000;
    const solves = (id: string) => problem.rules.some((r) => r.outcome === 'solved' && r.anyTags.some((t) => tagsOf(id).includes(t)));
    const matchesAny = (id: string) => problem.rules.some((r) => r.anyTags.some((t) => tagsOf(id).includes(t)));
    if (kind === 'quick' && view.problem.sinceMs >= 4000) {
      done.add(problem.id);
      // The thing the ask is about: in the room or on the set, else anything that solves it.
      const pick = available(scene).find(solves) ?? [...defs.keys()].find(solves);
      return pick ? [gift(pick)] : [];
    }
    if (kind === 'late-wrong' && view.problem.sinceMs >= waitMs - 2500) {
      done.add(problem.id);
      return [gift(available(scene).find((id) => !matchesAny(id)) ?? 'button')];
    }
    return [];
  };
}

const choices: Array<{ name: string; choice: Map<string, string> }> = [{ name: 'default', choice: new Map() }];
for (const slot of carry.slots) for (const p of slot.pick) choices.push({ name: p.beat, choice: new Map([[slot.after, p.beat]]) });

const fmt = (ms: number | null) => (ms === null ? '—' : `${Math.floor(Math.round(ms / 1000) / 60)}:${String(Math.round(ms / 1000) % 60).padStart(2, '0')}`);
let bad = 0;
console.log(`${spineIn.id}: "${spineIn.title}", target ${spineIn.targetSeconds.min}–${spineIn.targetSeconds.max} s`);
for (const { name, choice } of choices) {
  const spine = withCarry(spineIn, choice);
  const row: string[] = [];
  for (const kind of ['quick', 'zero', 'late-wrong', 'hold'] as const) {
    const seen = { firstTurnMs: null as number | null, starts: new Map<string, number>() };
    const r = simulate(spine, timed, readerFor(spine, kind, seen));
    if (process.env.TT_BEATS && name === 'default' && kind === process.env.TT_BEATS) console.log(`    ${kind}: ${[...seen.starts].map(([b, ms]) => `${b} ${fmt(ms)}`).join(', ')}`);
    const issues: string[] = [];
    if (process.env.TT_DEBUG) console.log(`    ${name} ${kind}: ${r.beats.join(' > ')}`);
    if (r.endedAtMs === null) issues.push('never ended');
    else if (r.endedAtMs < spine.targetSeconds.min * 1000 || r.endedAtMs > spine.targetSeconds.max * 1000) issues.push('outside the time-box');
    if (r.longestQuietMs > 8000) issues.push(`quiet ${(r.longestQuietMs / 1000).toFixed(1)} s at ${fmt(r.quietAtMs)}`);
    if (r.repeatedLines.length) issues.push(`repeats ${r.repeatedLines.length}`);
    if (issues.length) bad += 1;
    row.push(`${kind} turn ${fmt(seen.firstTurnMs)} end ${fmt(r.endedAtMs)}${issues.length ? ` (${issues.join(', ')})` : ''}`);
  }
  console.log(`  ${name.padEnd(14)} ${row.join(' | ')}`);
}
process.exitCode = bad ? 1 : 0;
