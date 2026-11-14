/**
 * P4: whole chapters with an injected director, offline. Every reader below runs against every
 * director profile, and each run must finish in the time-box, never go quiet, never repeat a line,
 * and answer every gift. Run: node tools/director-sim.ts [runs-per-random-reader]
 */
import { readFileSync } from 'node:fs';
import { ObjectDef, Spine, type ShowObject } from '../contracts/src/index.ts';
import { libraryOf, ShowManifest, voiceMsOf } from '../client/src/show/manifest.ts';
import { actionDuration } from '../client/src/show/schedule.ts';
import { simulate, type Reader, type ReaderMove, type SimDirector } from '../client/src/show/simulate.ts';
import type { DirectorKind } from '../client/src/director/director.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = ShowManifest.parse(read('../client/public/show/manifest.json'));
const episode = process.env.TT_EPISODE ?? manifest.episode;
const spine = Spine.parse(read(`../client/public/${episode}`));
const defs = [...manifest.objectFiles.map((f) => ObjectDef.parse(read(`../art/${f}`))), ...manifest.extraObjects];
const library = libraryOf(manifest, defs);
const voiced = voiceMsOf(manifest);
const durationOf = actionDuration({
  cueMs: Object.fromEntries(manifest.cues.map((c) => [c.id, c.nominalMs])),
  voiceMs: (speaker, text) => voiced(speaker, text) ?? Math.round(Math.max(800, text.length * 60) * 1.3),
});
const tagsOf = (id: string) => defs.find((d) => d.id === id)?.tags ?? ['rolls', 'heavy'];

/** Everything reachable by the reader: every scene's objects up to this one, as copies. */
const objectsFor = (s: Spine, sceneIndex: number): ShowObject[] =>
  s.scenes.slice(0, sceneIndex + 1).flatMap((scene) =>
    scene.objects.map((o) => ({ id: o.id, def: defs.find((d) => d.id === o.defId)!, owner: null, origin: o.origin, history: [] })),
  );

const gift = (object: string, to = 'pip'): ReaderMove => ({ do: 'gift', object, tags: [...tagsOf(object)], to });
type Rule = { when: Parameters<Reader>[0] extends infer V ? (v: V) => boolean : never; then: ReaderMove[] };
const reader = (rules: Rule[]): Reader => {
  const fired = new Set<number>();
  return (view) => {
    for (let i = 0; i < rules.length; i++) {
      if (fired.has(i) || !rules[i]!.when(view)) continue;
      fired.add(i);
      return rules[i]!.then;
    }
    return [];
  };
};
const problems = spine.scenes.map((s) => s.problem?.id ?? null);
const asked = (id: string | null, afterMs = 1500) => (v: { problem: { id: string; sinceMs: number } | null }) => v.problem?.id === id && v.problem.sinceMs >= afterMs;
const at = (ms: number) => (v: { nowMs: number }) => v.nowMs >= ms;
const sceneObjects = spine.scenes.map((s) => s.objects.map((o) => o.id));
const solver = (scene: number): string | null => {
  const p = spine.scenes[scene]?.problem;
  if (!p) return null;
  const rule = p.rules.find((r) => r.outcome === 'solved');
  return objectsFor(spine, scene).find((o) => rule?.anyTags.some((t) => o.def.tags.includes(t)))?.id ?? null;
};

/** Seeded, so a failing run can be replayed: TT_SEED picks the first seed. */
let seed = Number(process.env.TT_SEED ?? 1);
const random = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
Math.random = random;

const readers: Record<string, () => Reader> = {
  nothing: () => () => [],
  'solves everything': () => reader(problems.flatMap((p, i) => (p && solver(i) ? [{ when: asked(p, 4000), then: [gift(solver(i)!)] }] : []))),
  'wrong things first, then solves': () =>
    reader(problems.flatMap((p, i) => (p && solver(i) ? [{ when: asked(p, 3000), then: [gift(sceneObjects[i]!.find((o) => o !== solver(i)) ?? 'button')] }, { when: asked(p, 16_000), then: [gift(solver(i)!)] }] : []))),
  'gifts nobody asked for': () =>
    reader([
      { when: at(60_000), then: [gift('lantern', 'wick')] },
      { when: at(150_000), then: [gift(sceneObjects[1]?.[1] ?? 'kite')] },
      { when: at(200_000), then: [gift(sceneObjects[1]?.[2] ?? 'spool', 'moth')] },
    ]),
  'holds through every ask': () => (v) => (v.problem ? [{ do: 'hold', on: true }] : [{ do: 'hold', on: false }]),
  random: () => {
    let next = 5000 + Math.random() * 30_000;
    return (v) => {
      if (v.nowMs < next) return [];
      next = v.nowMs + 4000 + Math.random() * 40_000;
      // The lantern can only be handed back once it has fallen.
      const pool = objectsFor(spine, v.scheduler.scene()).map((o) => o.id).filter((id) => id !== 'lantern' || v.problem?.id === 'lantern-lost');
      const pick = pool[Math.floor(Math.random() * pool.length)] ?? 'button';
      const to = ['pip', 'pip', 'wick', 'moth'][Math.floor(Math.random() * 4)]!;
      return Math.random() < 0.15 ? [{ do: 'hold', on: Math.random() < 0.5 }] : [gift(pick, to)];
    };
  },
};

const directors: Record<string, ((kind: DirectorKind, n: number) => number | null) | null> = {
  off: null,
  instant: () => 300,
  normal: (kind) => (kind === 'reaction' ? 2000 + Math.random() * 2500 : 3000 + Math.random() * 3000),
  slow: () => 6000 + Math.random() * 3000,
  flaky: (kind) => (Math.random() < 0.3 ? null : kind === 'reaction' ? 2500 : 4000),
  failing: () => null,
};

const runs = Number(process.argv[2] ?? 40);
const only = process.argv[3];
let failures = 0;
let total = 0;
for (const [dName, latency] of Object.entries(directors)) {
  if (only && dName !== only) continue;
  const sim: SimDirector | undefined = latency ? { library, onStage: manifest.onStage.map((o) => o.cast), objects: objectsFor, latencyMs: latency } : undefined;
  const tally = { runs: 0, min: Infinity, max: 0, admitted: 0, offered: 0, reactions: 0, reactionMs: [] as number[] };
  for (const [rName, make] of Object.entries(readers)) {
    const n = rName === 'random' ? runs : rName.startsWith('holds') ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const report = simulate(spine, durationOf, make(), sim);
      total += 1;
      tally.runs += 1;
      const problemsFound: string[] = [];
      const end = report.endedAtMs;
      if (end === null) problemsFound.push('never ended');
      else {
        tally.min = Math.min(tally.min, end);
        tally.max = Math.max(tally.max, end);
        if (end < spine.targetSeconds.min * 1000) problemsFound.push(`short ${(end / 1000).toFixed(1)} s`);
        if (end > spine.targetSeconds.max * 1000) problemsFound.push(`long ${(end / 1000).toFixed(1)} s`);
      }
      if (report.repeatedLines.length) problemsFound.push(`repeats ${report.repeatedLines.join(' | ')}`);
      if (report.longestQuietMs > 8000) problemsFound.push(`quiet ${report.longestQuietMs} ms at ${Math.round(report.quietAtMs / 1000)} s`);
      for (const [k, g] of report.gifts.entries()) {
        if (g.outcome.kind === 'repeat' || g.outcome.kind === 'aside') continue;
        // A second gift straight after cuts the first one's beat: the second is what gets answered.
        if (report.gifts.slice(k + 1).some((h) => h.atMs - g.atMs < 6000 && h.outcome.kind !== 'aside')) continue;
        if (g.takeAfterMs !== 0) problemsFound.push(`${g.object} not taken at once`);
        if ((g.consequenceAfterMs ?? Infinity) > 6000) problemsFound.push(`${g.object} matters after ${g.consequenceAfterMs} ms`);
      }
      for (const g of report.gifts) if (g.reactionAfterMs != null) tally.reactionMs.push(g.reactionAfterMs);
      tally.reactions += report.gifts.filter((g) => g.outcome.kind === 'aside' || g.outcome.kind === 'fallback').length;
      if (report.director) {
        tally.admitted += report.director.admitted.reaction + report.director.admitted.callback;
        tally.offered += report.director.offered.reaction + report.director.offered.callback;
      }
      if (problemsFound.length) {
        failures += 1;
        console.log(`FAIL [${dName}] ${rName} #${i}: ${problemsFound.join('; ')}`);
        if (process.env.TT_DEBUG) console.log('  beats:', report.beats.join(' > '), '\n  gifts:', report.gifts.map((g) => `${Math.round(g.atMs / 1000)}s ${g.object} ${g.outcome.kind}`).join(', '));
      }
    }
  }
  const r = tally.reactionMs.sort((a, b) => a - b);
  console.log(
    `${dName.padEnd(8)} ${tally.runs} runs, ${(tally.min / 1000).toFixed(0)}–${(tally.max / 1000).toFixed(0)} s, director beats played ${tally.admitted} of ${tally.offered} offered, ` +
      `reactions landed ${r.length} of ${tally.reactions} wanted${r.length ? `, median ${Math.round(r[Math.floor(r.length / 2)]!)} ms, worst ${Math.round(r.at(-1)!)} ms` : ''}`,
  );
}
console.log(`${total} shows, ${failures} failing`);
process.exitCode = failures ? 1 : 0;
