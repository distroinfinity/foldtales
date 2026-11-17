// Finishes run 023's lines into art/sound/storyteller/: trims the silence at each end (kept to a short
// breath), levels each voice to run 010's peaks, mono mp3. Then checks every finished clip: it decodes
// with no errors, its length, and (with GROQ_API_KEY) that what it says matches its line, by
// transcribing it with the Storyteller's own listening model.
// Usage, from the repo root: node --env-file=.env.local art/runs/023-storyteller-lines/finish.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const RUN = 'art/runs/023-storyteller-lines';
const OUT = 'art/sound/storyteller';
const plan = JSON.parse(fs.readFileSync(`${RUN}/plan.json`, 'utf8'));
/** Run 010's peaks, so recorded lines sit at the same loudness as the chapters' lines. */
const VOICE_PEAK = { narrator: -3, pip: -5, wick: -5, moth: -6 };
fs.mkdirSync(OUT, { recursive: true });

const peakOf = (file) => Number(/max_volume: (-?[\d.]+) dB/.exec(spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr)?.[1] ?? 0);
const seconds = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());
/** Silence below -45 dB at either end goes, keeping 0.12 s of it as a breath. */
const TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse';
const words = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);

async function heard(file) {
  if (!process.env.GROQ_API_KEY) return null;
  const form = new FormData();
  form.set('model', 'whisper-large-v3-turbo');
  form.set('language', 'en');
  form.set('response_format', 'json');
  form.set('file', new Blob([fs.readFileSync(file)], { type: 'audio/mpeg' }), 'line.mp3');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: form });
  if (!r.ok) return `(transcription failed: ${r.status})`;
  return (await r.json()).text.trim();
}

const rows = [];
for (const job of plan.lineJobs) {
  const src = `${RUN}/${job.id}.mp3`;
  const dst = `${OUT}/${job.id}.mp3`;
  const trimmed = `${RUN}/.${job.id}.trim.wav`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-af', TRIM, trimmed]);
  const gain = ((VOICE_PEAK[job.speaker] ?? -5) - peakOf(trimmed)).toFixed(2);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', trimmed, '-af', `volume=${gain}dB`, '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '3', dst]);
  fs.rmSync(trimmed);
  // Decodes start to finish with no errors.
  const decode = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-i', dst, '-f', 'null', '-'], { encoding: 'utf8' });
  const said = await heard(dst);
  const want = words(job.text);
  const got = said ? words(said) : [];
  const missing = want.filter((w) => !got.includes(w));
  rows.push({ id: job.id, speaker: job.speaker, rawS: seconds(src), s: seconds(dst), peak: peakOf(dst), decodes: decode.status === 0 && !decode.stderr.trim(), said, matches: said ? missing.length === 0 : null, missing });
}
for (const r of rows) console.log(`${r.id.padEnd(17)} ${r.speaker.padEnd(9)} ${r.rawS.toFixed(2)} s → ${r.s.toFixed(2)} s  peak ${r.peak} dB  ${r.decodes ? 'decodes' : 'DECODE ERROR'}  ${r.matches === null ? '' : r.matches ? 'matches' : `MISSING ${r.missing.join(' ')}`}  "${r.said ?? ''}"`);
fs.writeFileSync(`${RUN}/check.json`, `${JSON.stringify(rows, null, 2)}\n`);
console.log(`all decode: ${rows.every((r) => r.decodes)}; all match: ${rows.every((r) => r.matches)}; longest ${Math.max(...rows.map((r) => r.s)).toFixed(2)} s`);
