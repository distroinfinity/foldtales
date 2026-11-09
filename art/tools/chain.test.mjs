import test, { before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { runInChrome, staticHandler } from "./chrome-harness.mjs";

const voiceDir = fileURLToPath(new URL("../voice/", import.meta.url));
let result;

before(async () => {
  result = await runInChrome({ handler: staticHandler(voiceDir), path: "/chain-selftest.html", timeoutMs: 90000 });
  assert.equal(result.error, undefined, result.error);
}, { timeout: 100000 });

test("low-level multi-tone, relative to 1 kHz, is within 2 dB of summed getFrequencyResponse at 60, 280, 1800, 6000, 10000 Hz", () => {
  for (const [name, { response }] of Object.entries(result.settings)) {
    for (const { hz, measuredDb, expectedDb } of response) {
      assert.ok(Math.abs(measuredDb - expectedDb) <= 2, `${name} at ${hz} Hz: measured ${measuredDb.toFixed(1)}, expected ${expectedDb.toFixed(1)}`);
    }
  }
});

test("same signal agrees within 1.5 dB per band across OfflineAudioContext, AudioContext+AudioBufferSource, MediaElementSource, and scheduled chunks", () => {
  for (const [name, { paths }] of Object.entries(result.settings)) {
    for (const how of ["buffer", "element", "chunks"]) {
      paths[how].forEach((level, band) => {
        const delta = Math.abs(level - paths.offline[band]);
        assert.ok(delta <= 1.5, `${name} via ${how}, band ${band}: ${delta.toFixed(2)} dB off`);
      });
    }
  }
});

test("room tone: same seed gives identical buffer, RMS -46 dBFS within 2 dB, loop-seam step under 0.002", () => {
  const { identical, rmsDb, seam, seconds } = result.roomTone;
  assert.equal(identical, true);
  assert.equal(Math.round(seconds), 12);
  assert.ok(Math.abs(rmsDb - -46) <= 2, `rms ${rmsDb}`);
  assert.ok(seam < 0.002, `seam ${seam}`);
});

test("saturationCurve maps 1 to 1 and -1 to -1 and is monotonic", () => {
  assert.equal(result.curve.length, 2049);
  assert.ok(Math.abs(result.curve.first + 1) < 1e-6);
  assert.ok(Math.abs(result.curve.last - 1) < 1e-6);
  assert.equal(result.curve.monotonic, true);
});

test("chain.mjs does not reference AudioWorklet", () => {
  assert.ok(!fs.readFileSync(`${voiceDir}chain.mjs`, "utf8").includes("AudioWorklet"));
});

test("chain.json carries the spec's starting table", () => {
  const { settings, default: chosen } = JSON.parse(fs.readFileSync(`${voiceDir}chain.json`, "utf8"));
  assert.equal(chosen, "warm-radio");
  assert.deepEqual(Object.keys(settings).sort(), ["old-wireless", "soft-paper", "warm-radio"]);
  const { highpassHz, warmthDb, presenceDb, lowpassHz, drive, compressor } = settings["warm-radio"];
  assert.deepEqual([highpassHz, warmthDb, presenceDb, lowpassHz, drive, compressor.thresholdDb, compressor.ratio, compressor.attackMs, compressor.releaseMs], [130, 2.5, 2.5, 6500, 1.6, -22, 3, 5, 180]);
  assert.deepEqual([settings["soft-paper"].highpassHz, settings["soft-paper"].lowpassHz, settings["soft-paper"].drive], [110, 9000, 1.2]);
  assert.deepEqual([settings["old-wireless"].highpassHz, settings["old-wireless"].lowpassHz, settings["old-wireless"].drive], [180, 4200, 2.4]);
});
