import test, { before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInChrome } from "./chrome-harness.mjs";
import { auditionHandler } from "./serve-audition.mjs";

const voiceDir = fileURLToPath(new URL("../voice/", import.meta.url));

function wav(freq, seconds = 2, amp = 0.2) {
  const sr = 44100;
  const n = Math.round(sr * seconds);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i += 1) b.writeInt16LE(Math.round(amp * 32767 * Math.sin((2 * Math.PI * freq * i) / sr)), 44 + i * 2);
  return b;
}

function fixtureRun(index) {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), "page-"));
  fs.writeFileSync(path.join(runDir, "clips.json"), JSON.stringify(index));
  for (const [name, freq] of [["ok-a", 300], ["ok-b", 400], ["slow", 500], ["sw-a", 200], ["sw-b", 250]]) fs.writeFileSync(path.join(runDir, `${name}.wav`), wav(freq));
  fs.writeFileSync(path.join(runDir, "hot.wav"), wav(350, 2, 0.9));
  fs.writeFileSync(path.join(runDir, "corrupt.wav"), Buffer.from("RIFFthis is not audio at all"));
  return runDir;
}

const sweep = [{ label: "Voice 1", file: "sw-a.wav", f0Median: 110, trimDb: 0 }, { label: "Voice 2", file: "sw-b.wav", f0Median: null, trimDb: 0 }];
const full = {
  roles: [{ id: "pip", name: "Pip", options: ["A", "B", "C"], beats: [
    { id: "fear", label: "Fear", promptText: "[whispers] It went out.", clips: { A: { file: "ok-a.wav", trimDb: 0, presetId: "Katie" }, B: { file: "slow.wav", trimDb: 0 }, C: { file: "missing.wav", trimDb: 0 } } },
    { id: "relief", label: "Relief", promptText: "[exhales] Thank you.", clips: { A: { file: "corrupt.wav", trimDb: 0 }, B: { file: "ok-b.wav", trimDb: 0 }, C: { file: "ok-a.wav", trimDb: 0 } } },
    { id: "loud", label: "Loud", promptText: "Loud.", clips: { A: { file: "hot.wav", trimDb: 12 } } },
  ] }],
  sweep,
};

function runPage(index) {
  const inner = auditionHandler({ voiceDir, runDir: fixtureRun(index) });
  const handler = (req, res) => {
    // The slow clip arrives late, so a later tap's clip decodes first.
    if (req.url.startsWith("/run/slow")) setTimeout(() => inner(req, res), 500);
    else inner(req, res);
  };
  return runInChrome({ handler, path: "/?selftest=1", timeoutMs: 45000 });
}

let result;
let sweepOnly;
before(async () => {
  result = await runPage(full);
  assert.equal(result.error, undefined, result.error);
  sweepOnly = await runPage({ roles: [], sweep });
  assert.equal(sweepOnly.error, undefined, sweepOnly.error);
}, { timeout: 100000 });

test("renders each role with its beats and A, B, C options, and a sweep-only index shows just All voices", () => {
  assert.deepEqual(result.tabs, ["Pip", "All voices"]);
  assert.deepEqual(result.beats, ["Fear", "Relief", "Loud"]);
  assert.deepEqual(result.lines, ["It went out.", "Thank you.", "Loud."]);
  assert.deepEqual(result.options, ["A", "B", "C"]);
  assert.deepEqual(sweepOnly.tabs, ["All voices"]);
  assert.deepEqual(sweepOnly.sweepLabels, ["Voice 1", "Voice 2"]);
});

test("tapping a cell plays; tapping another stops the first", () => {
  assert.deepEqual(result.afterFirstTap, { active: 1, file: "ok-a.wav", playing: ["pip/fear/A"] });
  assert.deepEqual(result.afterSecondTap, { active: 1, file: "ok-b.wav", playing: ["pip/relief/B"] });
});

test("rapid taps with reversed decode order (first clip delayed by the test server) leave only the last tap audible", () => {
  assert.deepEqual(result.afterRapid, { active: 1, file: "ok-b.wav", playing: ["pip/relief/B"] });
});

test("a missing clip and a corrupt clip each mark their cell unavailable, and other cells still play", () => {
  assert.equal(result.missingUnavailable, true);
  assert.equal(result.corruptUnavailable, true);
  assert.equal(result.afterBad.active, 1);
});

test("a tap calls resume when the context is suspended", () => {
  assert.equal(result.afterSuspendTap, "running");
});

test("switching chain setting while playing reroutes without restarting the source", () => {
  assert.equal(result.reroute.sameSource, true);
  assert.equal(result.reroute.chain, "soft-paper");
  assert.equal(result.reroute.active, 1);
});

test("room tone toggles between on and off", () => {
  assert.deepEqual(result.roomToggle, [0, 1]);
});

test("Dry never lets a trimmed clip pass -1 dBFS", () => {
  assert.ok(result.dryHot.gain > 0);
  assert.ok(result.dryHot.gain * 0.9 <= 0.8913 + 0.002, `gain ${result.dryHot.gain}`);
});

test("no preset names or plan fields appear in the DOM", () => {
  assert.ok(!result.html.includes("Katie"));
  assert.ok(!result.html.includes("presetId"));
});

test("tap targets are at least 96 CSS pixels tall", () => {
  assert.ok(result.minCellHeight >= 96, `cell height ${result.minCellHeight}`);
});
