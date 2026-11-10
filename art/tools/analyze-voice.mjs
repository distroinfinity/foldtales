// Free local measurements of a run's clips, and the blind clip index the listening page reads.
// Usage, from the repo root: node art/tools/analyze-voice.mjs art/runs/<id>
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readLedger } from "./generate-voice.mjs";

const ROLE_NAMES = { pip: "Pip", wick: "Wick", moth: "Moth", narrator: "Narrator" };
const toDb = (x) => 20 * Math.log10(Math.max(x, 1e-12));

function quantile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

// Normalized autocorrelation over 70-500 Hz. Whispers and laughs drop out through the voicing test.
export function measurePitch(samples, sampleRate) {
  const frame = Math.round(0.04 * sampleRate);
  const hop = Math.round(0.01 * sampleRate);
  const minLag = Math.floor(sampleRate / 500);
  const maxLag = Math.ceil(sampleRate / 70);
  const pitches = [];
  for (let start = 0; start + frame + maxLag <= samples.length; start += hop) {
    let energy = 0;
    for (let i = 0; i < frame; i += 1) energy += samples[start + i] ** 2;
    if (toDb(Math.sqrt(energy / frame)) <= -45) continue;
    const corr = new Float64Array(maxLag + 2);
    let best = 0;
    for (let lag = minLag; lag <= maxLag + 1; lag += 1) {
      let cross = 0;
      let e0 = 0;
      let e1 = 0;
      for (let i = 0; i < frame; i += 1) {
        const a = samples[start + i];
        const b = samples[start + i + lag] ?? 0;
        cross += a * b;
        e0 += a * a;
        e1 += b * b;
      }
      corr[lag] = cross / Math.sqrt(e0 * e1 || 1);
      if (lag <= maxLag && corr[lag] > best) best = corr[lag];
    }
    if (best < 0.6) continue;
    // Take the shortest lag near the best peak, which guards against octave errors.
    for (let lag = minLag + 1; lag <= maxLag; lag += 1) {
      if (corr[lag] >= 0.9 * best && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
        const denom = corr[lag - 1] - 2 * corr[lag] + corr[lag + 1];
        const shift = denom === 0 ? 0 : (0.5 * (corr[lag - 1] - corr[lag + 1])) / denom;
        pitches.push(sampleRate / (lag + shift));
        break;
      }
    }
  }
  const voicedSeconds = (pitches.length * hop) / sampleRate;
  if (voicedSeconds < 0.75) return { f0Median: null, f0P10: null, f0P90: null, voicedSeconds };
  pitches.sort((a, b) => a - b);
  return { f0Median: quantile(pitches, 0.5), f0P10: quantile(pitches, 0.1), f0P90: quantile(pitches, 0.9), voicedSeconds };
}

export function trimForVoice(lufsValues) {
  const mean = lufsValues.reduce((sum, v) => sum + v, 0) / lufsValues.length;
  return Math.round((-20 - mean) * 10) / 10;
}

// Maps each job to its last finished clip, so a retake can replace what it retakes.
function keptClips(plan, ledger, measurements) {
  const files = new Map();
  for (const event of ledger.events) if (event.event === "done") files.set(event.job, event.file);
  const kept = new Map();
  for (const job of plan.jobs) {
    if (!files.has(job.id) || !measurements[job.id]) continue;
    kept.set(job.retakeOf ?? job.id, { job, file: files.get(job.id), measurement: measurements[job.id] });
  }
  return [...kept.values()];
}

export function buildClipIndex(plan, ledger, measurements) {
  const kept = keptClips(plan, ledger, measurements);
  const audition = kept.filter((clip) => clip.job.phase === "audition");

  const voiceLufs = new Map();
  for (const { job, measurement } of audition) {
    const key = `${job.role}/${job.option}`;
    voiceLufs.set(key, [...(voiceLufs.get(key) ?? []), measurement.lufs]);
  }

  const roles = [];
  for (const { job, file } of audition) {
    let role = roles.find((r) => r.id === job.role);
    if (!role) {
      role = { id: job.role, name: ROLE_NAMES[job.role] ?? job.role, options: [], beats: [] };
      roles.push(role);
    }
    if (!role.options.includes(job.option)) role.options.push(job.option);
    let beat = role.beats.find((b) => b.id === job.beat);
    if (!beat) {
      beat = { id: job.beat, label: job.beatLabel ?? job.beat, promptText: job.promptText, clips: {} };
      role.beats.push(beat);
    }
    beat.clips[job.option] = { file, trimDb: trimForVoice(voiceLufs.get(`${job.role}/${job.option}`)) };
  }
  for (const role of roles) role.options.sort();

  const sweep = kept
    .filter((clip) => clip.job.phase === "sweep")
    .sort((a, b) => (a.measurement.f0Median ?? Infinity) - (b.measurement.f0Median ?? Infinity))
    .map(({ file, measurement }, i) => ({ label: `Voice ${i + 1}`, file, f0Median: measurement.f0Median, trimDb: trimForVoice([measurement.lufs]) }));

  return { roles, sweep };
}

function measureFile(file) {
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  const samples = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4));
  const loud = spawnSync("ffmpeg", ["-nostats", "-i", file, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const lufs = Number(loud.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
  const peakDb = Number(loud.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
  const stats = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-af", "aspectralstats=measure=centroid,ametadata=print:file=-", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
  const centroids = [...stats.matchAll(/centroid=([\d.]+)/g)].map((m) => Number(m[1])).filter(Number.isFinite);
  const centroidHz = centroids.length ? centroids.reduce((a, b) => a + b, 0) / centroids.length : null;
  return { durationSeconds: samples.length / 16000, lufs, peakDb, centroidHz, ...measurePitch(samples, 16000) };
}

function main() {
  const runDir = process.argv[2];
  if (!runDir) {
    console.error("usage: analyze-voice.mjs <runDir>");
    process.exit(2);
  }
  const plan = JSON.parse(fs.readFileSync(path.join(runDir, "plan.json"), "utf8"));
  const ledger = readLedger(path.join(runDir, "manifest.jsonl"));
  const measurements = {};
  const broken = [];
  for (const event of ledger.events) {
    if (event.event !== "done") continue;
    const m = measureFile(path.join(runDir, event.file));
    measurements[event.job] = m;
    if (!Number.isFinite(m.lufs) || m.lufs < -60) broken.push(`${event.job}: silent or unmeasurable`);
    else if (m.durationSeconds < 1) broken.push(`${event.job}: shorter than 1 s`);
    else if (m.peakDb >= 0) broken.push(`${event.job}: peaking at 0 dBFS`);
  }
  fs.writeFileSync(path.join(runDir, "measurements.json"), `${JSON.stringify(measurements, null, 2)}\n`);
  fs.writeFileSync(path.join(runDir, "clips.json"), `${JSON.stringify(buildClipIndex(plan, ledger, measurements), null, 2)}\n`);
  console.log(`measured ${Object.keys(measurements).length} clips`);
  console.log(broken.length ? `broken:\n${broken.join("\n")}` : "no broken clips");
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
