// Levels run 010's clips into art/sound/m2/, measures each line's real length, and writes them into
// the show manifest: foley under its sound name, lines under the contract's line id.
// Usage, from the repo root: node art/runs/010-m2-sound/finish.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { lineIdOf } from '../../../contracts/src/beats.ts';

const RUN = 'art/runs/010-m2-sound';
const OUT = 'art/sound/m2';
const MANIFEST = 'client/public/show/manifest.json';
const plan = JSON.parse(fs.readFileSync(`${RUN}/plan.json`, 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

/** Peak each role or clip is levelled to, as run 009 did. */
const FOLEY_PEAK = {
  'lantern-clink': -12, 'lantern-flare': -12, 'object-set-down': -14, 'page-turn': -11, 'kite-whoosh': -12, 'ladder-creak': -12,
  'thread-pluck': -14, 'rope-throw': -12, 'spark-rise': -16, 'lamp-light': -11, 'satchel-in': -13, 'drawer-slide': -12,
  'pick-up': -17, 'give-pleased': -18, 'give-puzzled': -18, 'rustle-dark': -14, 'hop-land': -16,
};
const VOICE_PEAK = { narrator: -3, pip: -5, wick: -5, moth: -6 };
/** Which show sound each foley clip becomes. */
const SOUND_NAME = {
  'lantern-clink': 'clink', 'lantern-flare': 'flare', 'object-set-down': 'setdown', 'page-turn': 'page', 'kite-whoosh': 'whoosh',
  'ladder-creak': 'creak', 'thread-pluck': 'pluck', 'rope-throw': 'rope', 'spark-rise': 'spark', 'lamp-light': 'lamp',
  'satchel-in': 'satchel', 'drawer-slide': 'drawer', 'pick-up': 'grab', 'give-pleased': 'pleased', 'give-puzzled': 'puzzled',
  'rustle-dark': 'reeds', 'hop-land': 'hop',
};

/** ffmpeg's volumedetect reports on stderr. */
const peakOf = (file) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  return Number(/max_volume: (-?[\d.]+) dB/.exec(r.stderr)?.[1] ?? 0);
};
const level = (src, dst, target) => {
  const peak = peakOf(src);
  const gain = (target - peak).toFixed(2);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-af', `volume=${gain}dB`, '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '3', dst]);
  return { peak, gain };
};
const seconds = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
let missing = 0;
for (const job of plan.soundJobs) {
  const src = `${RUN}/${job.id}.mp3`;
  if (!fs.existsSync(src)) {
    missing++;
    console.log(`missing ${job.id}`);
    continue;
  }
  const { peak, gain } = level(src, `${OUT}/${job.id}.mp3`, FOLEY_PEAK[job.id] ?? -14);
  manifest.sounds[SOUND_NAME[job.id]] = { files: [`sound/m2/${job.id}.mp3`] };
  console.log(`${job.id}: peak ${peak} dB, gain ${gain} dB`);
}
for (const job of plan.voiceJobs) {
  const src = `${RUN}/${job.id}.mp3`;
  if (!fs.existsSync(src)) {
    missing++;
    console.log(`missing ${job.id}`);
    continue;
  }
  const dst = `${OUT}/${job.id}.mp3`;
  level(src, dst, VOICE_PEAK[job.role] ?? -5);
  const durationMs = Math.round(seconds(dst) * 1000);
  manifest.voiceLines[lineIdOf(job.role, job.promptText)] = { url: `sound/m2/${job.id}.mp3`, durationMs };
}
if (!manifest.artFolders.includes('sound/m2')) manifest.artFolders.push('sound/m2');
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log(`done, ${missing} missing, ${Object.keys(manifest.voiceLines).length} lines in the manifest`);
