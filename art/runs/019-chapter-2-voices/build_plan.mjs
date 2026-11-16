// Writes run 019's voice jobs: every playable line of chapter 2 (scene beats and bridges) that has no
// rendered voice yet, once per line id, keeping the plan's approved cap. With --check, instead
// asserts that every playable line has a voice in the show manifest (after finishing), and exits 1
// naming any that don't.
// Usage, from the repo root: node art/runs/019-chapter-2-voices/build_plan.mjs [episode.json] [--check]
import fs from 'node:fs';
import { linesOf } from '../../../contracts/src/beats.ts';

const args = process.argv.slice(2);
const check = args.includes('--check');
const episodePath = args.find((a) => !a.startsWith('--')) ?? 'client/public/show/episode-2.json';
const spine = JSON.parse(fs.readFileSync(episodePath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync('client/public/show/manifest.json', 'utf8'));
const planPath = process.env.PLAN ?? 'art/runs/019-chapter-2-voices/plan.json';
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
// Run 005's voices; Thimble's is set here once it's chosen by ear (from Xylar, Ella or Pip).
const PRESETS = { narrator: 'Wanda', pip: 'Mabel', wick: 'Arjun', thimble: plan.thimblePreset ?? null };

const beats = [...spine.scenes.flatMap((scene) => scene.beats), ...spine.bridges];
const lines = new Map();
for (const beat of beats) for (const line of linesOf(beat)) if (!lines.has(line.lineId)) lines.set(line.lineId, { ...line, beat: beat.id });

if (check) {
  const missing = [...lines.values()].filter((l) => !manifest.voiceLines[l.lineId]);
  for (const l of missing) console.log(`no voice: ${l.speaker} "${l.text}" (${l.beat})`);
  console.log(`${lines.size} playable lines, ${lines.size - missing.length} voiced`);
  process.exit(missing.length ? 1 : 0);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '');
const ids = new Set();
const jobs = [];
for (const line of lines.values()) {
  if (manifest.voiceLines[line.lineId]) continue;
  const presetId = PRESETS[line.speaker];
  if (!presetId) throw new Error(`no voice chosen for ${line.speaker}: set plan.thimblePreset first`);
  let id = `${line.speaker}-${slug(line.text)}`;
  for (let n = 2; ids.has(id); n++) id = `${line.speaker}-${slug(line.text)}-${n}`;
  ids.add(id);
  jobs.push({ id, role: line.speaker, presetId, promptText: line.text, lineId: line.lineId, beat: line.beat });
}
const soundCredits = plan.soundJobs.reduce((sum, j) => sum + j.durationS, 0);
if (jobs.length + soundCredits > plan.capCredits) throw new Error(`${jobs.length} lines and ${soundCredits} s of sound pass the approved cap of ${plan.capCredits}: trim first (${plan.trimOrder})`);
fs.writeFileSync(planPath, `${JSON.stringify({ ...plan, voiceJobs: jobs, estimateCredits: jobs.length + soundCredits }, null, 2)}\n`);
console.log(`${jobs.length} lines to voice (${lines.size} playable, ${lines.size - jobs.length} already voiced), ${soundCredits} credits of sound; cap ${plan.capCredits}`);
