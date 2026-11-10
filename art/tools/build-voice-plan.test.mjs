import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildPlan } from "./build-voice-plan.mjs";
import { PRESETS, validatePlan, estimateCredits } from "./generate-voice.mjs";

const spec = fs.readFileSync(new URL("../../docs/superpowers/specs/2026-11-09-voice-audition-design.md", import.meta.url), "utf8");
const shortlist = {
  why: "ignored",
  pip: PRESETS.slice(0, 3),
  wick: PRESETS.slice(3, 6),
  moth: PRESETS.slice(6, 9),
  narrator: PRESETS.slice(9, 12),
};

test("builder output passes validatePlan; sweep has 49 jobs; a 12-voice shortlist adds 33 audition jobs", () => {
  const plan = buildPlan(shortlist);
  validatePlan(plan);
  assert.equal(plan.jobs.filter((j) => j.phase === "sweep").length, 49);
  assert.equal(plan.jobs.filter((j) => j.phase === "audition").length, 33);
  assert.equal(plan.capCredits, 100);
  assert.equal(plan.jobs.reduce((sum, j) => sum + estimateCredits(j.promptText), 0), 82);
});

test("without a shortlist the plan holds only the sweep", () => {
  const plan = buildPlan(null);
  validatePlan(plan);
  assert.equal(plan.jobs.length, 49);
  assert.ok(plan.jobs.every((j) => j.phase === "sweep"));
});

test("every job holds the spec's model, settings and exact line text", () => {
  const plan = buildPlan(shortlist);
  assert.equal(plan.model, "eleven_v4");
  assert.deepEqual(plan.settings, { stability: 0.4, similarityBoost: 0.75, languageCode: "en" });
  for (const job of plan.jobs) assert.ok(spec.includes(job.promptText), job.promptText);
});

test("job ids carry no preset names, and seeds are stable and differ per job", () => {
  const a = buildPlan(shortlist);
  const b = buildPlan(shortlist);
  assert.deepEqual(a.jobs.map((j) => j.seed), b.jobs.map((j) => j.seed));
  assert.equal(new Set(a.jobs.map((j) => j.seed)).size, a.jobs.length);
  for (const job of a.jobs) {
    assert.ok(Number.isInteger(job.seed) && job.seed >= 0 && job.seed <= 4294967295);
    assert.ok(!PRESETS.some((p) => job.id.toLowerCase().split("-").includes(p.toLowerCase()) && !["pip"].includes(p.toLowerCase())), job.id);
  }
  assert.ok(a.jobs.some((j) => j.id === "pip-a-fear"));
  assert.ok(a.jobs.some((j) => j.id === "sweep-49"));
  assert.equal(a.jobs.find((j) => j.id === "wick-b-sight").presetId, shortlist.wick[1]);
});
