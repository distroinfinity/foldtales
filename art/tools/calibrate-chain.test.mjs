import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { calibrate } from "./calibrate-chain.mjs";
import { runInChrome } from "./chrome-harness.mjs";

const chainJson = JSON.parse(fs.readFileSync(new URL("../voice/chain.json", import.meta.url), "utf8"));
const SR = 48000;

function wavBytes(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((x, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), 44 + i * 2));
  return b;
}

// A rough speech-like signal: a few voiced harmonics, amplitude-modulated into syllables.
function speechy(f0, seconds, amp) {
  const out = new Float32Array(Math.round(SR * seconds));
  for (let i = 0; i < out.length; i += 1) {
    const t = i / SR;
    const syllable = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3.5 * t);
    let x = 0;
    for (const [h, a] of [[1, 1], [2, 0.6], [3, 0.4], [5, 0.25], [8, 0.1]]) x += a * Math.sin(2 * Math.PI * f0 * h * t);
    out[i] = amp * syllable * x;
  }
  return out;
}

function transient(seconds) {
  const out = speechy(200, seconds, 0.12);
  for (let i = SR; i < SR + 2000; i += 1) out[i] += 0.8 * Math.sin((2 * Math.PI * 900 * i) / SR);
  return out;
}

const clips = [
  { bytes: wavBytes(speechy(150, 2.5, 0.12)), trimDb: 0 },
  { bytes: wavBytes(speechy(280, 2.5, 0.08)), trimDb: 3 },
  { bytes: wavBytes(transient(2.5)), trimDb: 0 },
];

test("calibrated settings match Dry within 1 dB", { timeout: 60000 }, async () => {
  const { settings } = await calibrate({ clips, chainJson, runInChrome });
  for (const [name, r] of Object.entries(settings)) {
    if (r.peakLimited) continue;
    assert.ok(Math.abs(r.rmsDeltaDb) <= 1, `${name}: ${r.rmsDeltaDb} dB off Dry`);
    assert.ok(Number.isFinite(r.outputDb), name);
  }
});

test("a peak conflict lowers outputDb, sets peakLimited and keeps peaks at or below -1 dBFS", { timeout: 60000 }, async () => {
  // Steady, very loud input: matching Dry's level here would push the compressed chain past the ceiling.
  const steady = new Float32Array(SR * 2).map((_, i) => 0.9 * Math.sin((2 * Math.PI * 300 * i) / SR));
  const hot = [{ bytes: wavBytes(steady), trimDb: 6 }];
  const { settings } = await calibrate({ clips: hot, chainJson, runInChrome });
  for (const [name, r] of Object.entries(settings)) assert.ok(r.peakDb <= -0.95, `${name}: peak ${r.peakDb}`);
  assert.ok(Object.values(settings).some((r) => r.peakLimited), "expected a peak-limited setting");
});
