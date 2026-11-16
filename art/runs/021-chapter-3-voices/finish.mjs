// Levels run 021's clips (run 010's finishing, as run 012's) into art/sound/ch3/, measures each line's real
// length, and writes them into the show manifest under the contract's line id. Only lines whose clip has
// rendered; run it again after each batch (Thimble's lines wait for her voice).
// Usage, from the repo root: node art/runs/021-chapter-3-voices/finish.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { lineIdOf } from '../../../contracts/src/beats.ts';

const RUN = 'art/runs/021-chapter-3-voices';
const OUT = 'art/sound/ch3';
const MANIFEST = 'client/public/show/manifest.json';
const plan = JSON.parse(fs.readFileSync(`${RUN}/plan.json`, 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

/** Peak each role is levelled to, as runs 009, 010 and 012 did; Thimble as Pip, the other small bright voice. */
const VOICE_PEAK = { narrator: -3, pip: -5, wick: -5, thimble: -5 };

/** ffmpeg's volumedetect reports on stderr. */
const peakOf = (file) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  return Number(/max_volume: (-?[\d.]+) dB/.exec(r.stderr)?.[1] ?? 0);
};
const level = (src, dst, target) => {
  const gain = (target - peakOf(src)).toFixed(2);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-af', `volume=${gain}dB`, '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '3', dst]);
};
const seconds = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
let missing = 0;
let added = 0;
for (const job of plan.voiceJobs) {
  const src = `${RUN}/${job.id}.mp3`;
  if (!fs.existsSync(src)) {
    missing++;
    continue;
  }
  const dst = `${OUT}/${job.id}.mp3`;
  level(src, dst, VOICE_PEAK[job.role] ?? -5);
  const id = lineIdOf(job.role, job.promptText);
  if (job.lineId && job.lineId !== id) throw new Error(`${job.id}: line id ${job.lineId} isn't ${id}`);
  manifest.voiceLines[id] = { url: `sound/ch3/${job.id}.mp3`, durationMs: Math.round(seconds(dst) * 1000) };
  added++;
}
if (!manifest.artFolders.includes('sound/ch3')) manifest.artFolders.push('sound/ch3');
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${added} lines finished into ${OUT}, ${missing} not rendered yet; ${Object.keys(manifest.voiceLines).length} lines in the manifest`);
