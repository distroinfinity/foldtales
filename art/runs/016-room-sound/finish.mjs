// Finishes run 016 into art/sound/room/: makes the two beds loop without a seam (the last 0.6 s
// crossfaded into the first), levels every clip, and names them in the show manifest.
// Usage, from the repo root: node art/runs/016-room-sound/finish.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const RUN = 'art/runs/016-room-sound';
const OUT = 'art/sound/room';
const MANIFEST = 'client/public/show/manifest.json';
const XFADE_S = 0.6;
fs.mkdirSync(OUT, { recursive: true });

/** Beds are levelled by their average (they play for a long time, under the story); one-offs by their peak. */
const CLIPS = {
  'rain-loop': { sound: 'rain', mean: -30, loop: true },
  'sea-loop': { sound: 'sea', mean: -31, loop: true },
  'thunder-a': { sound: 'thunder', peak: -8 },
  'thunder-b': { sound: 'thunder', peak: -8 },
  'gull-calls': { sound: 'gull', peak: -15 },
  'bottle-wash': { sound: 'wash', peak: -13 },
  'shooting-star': { sound: 'shooting', peak: -17 },
};

const stat = (file, what) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  return Number(new RegExp(`${what}_volume: (-?[\\d.]+) dB`).exec(r.stderr)?.[1] ?? 0);
};
const seconds = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
for (const sound of new Set(Object.values(CLIPS).map((c) => c.sound))) manifest.sounds[sound] = { files: [] };
for (const [id, clip] of Object.entries(CLIPS)) {
  const src = `${RUN}/${id}.mp3`;
  let work = src;
  if (clip.loop) {
    const t = seconds(src);
    work = `${RUN}/${id}.seamless.wav`;
    ffmpeg('-i', src, '-filter_complex',
      `[0]asplit=3[a][b][c];[a]atrim=0:${XFADE_S},asetpts=N/SR/TB[head];[b]atrim=${XFADE_S}:${t - XFADE_S},asetpts=N/SR/TB[mid];` +
      `[c]atrim=${t - XFADE_S}:${t},asetpts=N/SR/TB[tail];[tail][head]acrossfade=d=${XFADE_S}:c1=tri:c2=tri[xf];[mid][xf]concat=n=2:v=0:a=1[out]`,
      '-map', '[out]', work);
  }
  const gain = clip.loop ? clip.mean - stat(work, 'mean') : clip.peak - stat(work, 'max');
  const dst = `${OUT}/${id}.mp3`;
  ffmpeg('-i', work, '-af', `volume=${gain.toFixed(2)}dB`, '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '3', dst);
  if (work !== src) fs.rmSync(work);
  manifest.sounds[clip.sound].files.push(`sound/room/${id}.mp3`);
  console.log(`${id}: gain ${gain.toFixed(1)} dB, now peak ${stat(dst, 'max')} dB, mean ${stat(dst, 'mean')} dB, ${seconds(dst).toFixed(2)} s`);
}
if (!manifest.artFolders.includes('sound/room')) manifest.artFolders.push('sound/room');
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
