// Writes run 021's voice jobs: every playable line of chapter 3 (scene beats and bridges) with no
// rendered voice yet, once per line id, across every version of the chapter given (ruling 3: the
// hunt's room version and its page version are both voiced), keeping the plan's approved cap.
// With --check, instead asserts that every playable line of every version has a voice in the show
// manifest (after finishing), and exits 1 naming any that don't. Run 019's builder (lane B), for
// several episode files.
// Usage, from the repo root:
//   node art/runs/021-chapter-3-voices/build_plan.mjs [episode.json ...] [--check]
import fs from 'node:fs';
import { linesOf } from '../../../contracts/src/beats.ts';

const args = process.argv.slice(2);
const check = args.includes('--check');
const given = args.filter((a) => !a.startsWith('--'));
const episodes = given.length
  ? given
  : ['client/public/show/episode-3.json', 'client/public/show/episode-3.page-hunt.json'].filter((p) => fs.existsSync(p));
const manifest = JSON.parse(fs.readFileSync('client/public/show/manifest.json', 'utf8'));
const planPath = 'art/runs/021-chapter-3-voices/plan.json';
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
// Run 005's voices; Thimble's is lane B's choice (art/cast/thimble/voice.json, runs 017 and 019).
const thimble = fs.existsSync('art/cast/thimble/voice.json') ? JSON.parse(fs.readFileSync('art/cast/thimble/voice.json', 'utf8')).presetId : null;
const PRESETS = { narrator: 'Wanda', pip: 'Mabel', wick: 'Arjun', thimble: plan.thimblePreset ?? thimble ?? null };

const lines = new Map();
for (const file of episodes) {
  const spine = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const beat of [...spine.scenes.flatMap((s) => s.beats), ...spine.bridges])
    for (const line of linesOf(beat)) if (!lines.has(line.lineId)) lines.set(line.lineId, { ...line, beat: beat.id, file });
}

if (check) {
  const missing = [...lines.values()].filter((l) => !manifest.voiceLines[l.lineId]);
  for (const l of missing) console.log(`no voice: ${l.speaker} "${l.text}" (${l.beat}, ${l.file})`);
  console.log(`${lines.size} playable lines across ${episodes.length} version(s), ${lines.size - missing.length} voiced`);
  process.exit(missing.length ? 1 : 0);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '');
const ids = new Set();
const jobs = [];
for (const line of lines.values()) {
  if (manifest.voiceLines[line.lineId]) continue;
  const presetId = PRESETS[line.speaker];
  if (!presetId) throw new Error(`no voice chosen for ${line.speaker}: lane B's art/cast/thimble/voice.json, or plan.thimblePreset`);
  let id = `${line.speaker}-${slug(line.text)}`;
  for (let n = 2; ids.has(id); n++) id = `${line.speaker}-${slug(line.text)}-${n}`;
  ids.add(id);
  jobs.push({ id, role: line.speaker, presetId, promptText: line.text, lineId: line.lineId, beat: line.beat });
}
const soundCredits = plan.soundJobs.reduce((sum, j) => sum + j.durationS, 0);
if (jobs.length + soundCredits > plan.capCredits) throw new Error(`${jobs.length} lines and ${soundCredits} s of sound pass the approved cap of ${plan.capCredits}: trim first (${plan.trimOrder})`);
fs.writeFileSync(planPath, `${JSON.stringify({ ...plan, voiceJobs: jobs, estimateCredits: jobs.length + soundCredits }, null, 2)}\n`);
console.log(`${jobs.length} lines to voice (${lines.size} playable across ${episodes.length} version(s), ${lines.size - jobs.length} already voiced), ${soundCredits} credits of sound; cap ${plan.capCredits}`);
