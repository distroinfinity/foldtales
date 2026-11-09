import test from "node:test";
import assert from "node:assert/strict";
import { measurePitch, trimForVoice, buildClipIndex } from "./analyze-voice.mjs";

const SR = 16000;
function sine(f, seconds, amp = 0.3) {
  const out = new Float32Array(Math.round(SR * seconds));
  for (let i = 0; i < out.length; i += 1) out[i] = amp * Math.sin((2 * Math.PI * f * i) / SR);
  return out;
}

test("220 Hz sine measures within 3 Hz of 220", () => {
  const { f0Median, voicedSeconds } = measurePitch(sine(220, 2), SR);
  assert.ok(Math.abs(f0Median - 220) < 3, `got ${f0Median}`);
  assert.ok(voicedSeconds > 1.5);
});

test("white noise gives f0Median null", () => {
  const noise = new Float32Array(SR * 2);
  for (let i = 0; i < noise.length; i += 1) noise[i] = (Math.random() * 2 - 1) * 0.3;
  assert.equal(measurePitch(noise, SR).f0Median, null);
});

test("under 0.75 s of voice gives f0Median null", () => {
  const clip = new Float32Array(SR * 2);
  clip.set(sine(220, 0.5), SR * 0.5);
  assert.equal(measurePitch(clip, SR).f0Median, null);
});

test("trimForVoice averages across clips: [-18, -22] gives 0", () => {
  assert.equal(trimForVoice([-18, -22]), 0);
  assert.equal(trimForVoice([-26]), 6);
});

function fixture() {
  const job = (id, phase, presetId, extra = {}) => ({ id, phase, presetId, promptText: "Hello there.", seed: 1, ...extra });
  const jobs = [
    job("sweep-01", "sweep", "Maya"),
    job("sweep-02", "sweep", "Bernard"),
    job("sweep-03", "sweep", "Katie"),
    job("pip-a-fear", "audition", "Maya", { role: "pip", option: "A", beat: "fear", beatLabel: "Fear" }),
    job("pip-a-relief", "audition", "Maya", { role: "pip", option: "A", beat: "relief", beatLabel: "Relief" }),
    job("pip-b-fear", "audition", "Katie", { role: "pip", option: "B", beat: "fear", beatLabel: "Fear" }),
    job("pip-a-fear-r2", "audition", "Maya", { role: "pip", option: "A", beat: "fear", beatLabel: "Fear", retakeOf: "pip-a-fear", promptText: "Hello again." }),
  ];
  const done = (id) => ({ event: "done", job: id, attempt: 1, file: `${id}.mp3` });
  const ledger = { events: jobs.map((j) => done(j.id)), attempts: new Map() };
  const m = (f0Median, lufs) => ({ durationSeconds: 3, lufs, peakDb: -3, centroidHz: 1500, f0Median, f0P10: f0Median, f0P90: f0Median, voicedSeconds: 2 });
  const measurements = { "sweep-01": m(180, -20), "sweep-02": m(null, -24), "sweep-03": m(110, -18), "pip-a-fear": m(200, -30), "pip-a-relief": m(210, -20), "pip-b-fear": m(190, -22), "pip-a-fear-r2": m(205, -24) };
  return { plan: { jobs }, ledger, measurements };
}

test("buildClipIndex: retake replaces original; no preset name appears anywhere in the JSON; sweep sorted by pitch with nulls last", () => {
  const { plan, ledger, measurements } = fixture();
  const index = buildClipIndex(plan, ledger, measurements);
  const text = JSON.stringify(index);
  for (const name of ["Maya", "Bernard", "Katie"]) assert.ok(!text.includes(name), `leaked ${name}`);

  const pip = index.roles.find((r) => r.id === "pip");
  assert.equal(pip.name, "Pip");
  assert.deepEqual(pip.options, ["A", "B"]);
  const fear = pip.beats.find((b) => b.id === "fear");
  assert.equal(fear.label, "Fear");
  assert.equal(fear.clips.A.file, "pip-a-fear-r2.mp3");
  assert.equal(fear.promptText, "Hello again.");
  assert.equal(fear.clips.B.file, "pip-b-fear.mp3");

  assert.deepEqual(index.sweep.map((s) => s.file), ["sweep-03.mp3", "sweep-01.mp3", "sweep-02.mp3"]);
  assert.deepEqual(index.sweep.map((s) => s.label), ["Voice 1", "Voice 2", "Voice 3"]);
  assert.equal(index.sweep[2].f0Median, null);
});

test("buildClipIndex: trim is per voice and uses the kept takes only", () => {
  const { plan, ledger, measurements } = fixture();
  const index = buildClipIndex(plan, ledger, measurements);
  const fear = index.roles[0].beats.find((b) => b.id === "fear");
  // Option A keeps the retake (-24) and relief (-20), so the mean is -22 and the trim is +2.
  assert.equal(fear.clips.A.trimDb, 2);
  assert.equal(index.sweep[0].trimDb, -2);
});

test("buildClipIndex with only a sweep gives no roles", () => {
  const { plan, ledger, measurements } = fixture();
  plan.jobs = plan.jobs.filter((j) => j.phase === "sweep");
  const index = buildClipIndex(plan, ledger, measurements);
  assert.deepEqual(index.roles, []);
  assert.equal(index.sweep.length, 3);
});
