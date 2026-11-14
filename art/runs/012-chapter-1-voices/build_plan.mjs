// Writes run 012's plan: every line of the rebuilt chapter 1 that has no rendered voice yet.
// Usage, from the repo root: node art/runs/012-chapter-1-voices/build_plan.mjs
import fs from 'node:fs';
import { lineIdOf, linesOf } from '../../../contracts/src/beats.ts';

const spine = JSON.parse(fs.readFileSync('client/public/show/episode-1.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('client/public/show/manifest.json', 'utf8'));
const PRESETS = { narrator: 'Wanda', pip: 'Mabel', wick: 'Arjun', moth: 'Pip' };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '');
const jobs = [];
const ids = new Set();
const seen = new Set();
for (const scene of spine.scenes) {
  for (const beat of scene.beats) {
    for (const line of linesOf(beat)) {
      const key = `${line.speaker}\0${line.text}`;
      if (seen.has(key) || manifest.voiceLines[line.lineId]) continue;
      seen.add(key);
      let id = `${line.speaker}-${slug(line.text)}`;
      for (let n = 2; ids.has(id); n++) id = `${line.speaker}-${slug(line.text)}-${n}`;
      ids.add(id);
      jobs.push({ id, role: line.speaker, presetId: PRESETS[line.speaker], promptText: line.text, beat: beat.id });
    }
  }
}
void lineIdOf;
const plan = {
  id: '012-chapter-1-voices',
  question: "Voices for the rebuilt chapter 1's new and changed lines, in the run-005 voices.",
  why: 'Owner, headset session 1: chapter 1 re-cut around the lamp (opens lit, goes out, journey to relight it). New and changed lines need their voices so the stranger at M2 hears the whole chapter.',
  sameAcrossJobs: "Runway text to speech with run 005's presets and the narrator file's model and settings, 1 credit a line. Finished like run 010.",
  decideBy: ['Each clip decodes; the simulator times every path from the real lines and finds them inside 5 to 7 minutes.', "The owner judges by ear on the Quest's speakers."],
  learnEvenIfRejected: 'How far the 1.3x line-length rule holds for a second batch.',
  reusableOutput: "Chapter 1's lines.",
  estimateCredits: jobs.length,
  capNote: "Owner's cap for voices while away: 80 credits.",
  capCredits: 80,
  soundJobs: [],
  voiceJobs: jobs,
};
fs.writeFileSync('art/runs/012-chapter-1-voices/plan.json', JSON.stringify(plan, null, 2));
console.log(`${jobs.length} lines to voice`);
