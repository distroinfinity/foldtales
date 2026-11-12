// Runs a planned sound round: foley through Runway's sound effects, and prepared lines through its
// text to speech, with generate-voice.mjs's ledger, cap and recovery. Dry run by default.
// Usage, from the repo root:
//   node art/tools/generate-sound.mjs art/runs/<id>
//   node --env-file=.env.local art/tools/generate-sound.mjs art/runs/<id> --spend [--accept-lost <job>] [--retry <job>]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PRESETS, estimateCredits, runPhase } from "./generate-voice.mjs";

/** Sound effects cost a credit a second (vendor price list), rounded up. */
export const estimateSoundCredits = (job) => Math.max(1, Math.ceil(job.durationS));

export function toJobs(plan) {
  return [...plan.soundJobs.map((job) => ({ ...job, phase: "sound" })), ...plan.voiceJobs.map((job) => ({ ...job, phase: "voice" }))];
}

export function validateSoundPlan(plan) {
  const seen = new Set();
  for (const job of plan.jobs) {
    if (seen.has(job.id)) throw new Error(`duplicate job id: ${job.id}`);
    seen.add(job.id);
    if (!job.promptText) throw new Error(`${job.id}: empty promptText`);
    if (job.phase === "sound" && !(job.durationS >= 0.5 && job.durationS <= 30)) throw new Error(`${job.id}: duration must be 0.5 to 30 seconds`);
    if (job.phase === "voice" && !PRESETS.includes(job.presetId)) throw new Error(`${job.id}: unknown preset ${job.presetId}`);
    if (job.phase === "voice" && job.promptText.length > 200) throw new Error(`${job.id}: over 200 characters`);
  }
}

/** The endpoint, request and estimate for each phase. `voice` is a run-005 voice file's model and settings. */
export function soundOptions(phase, voice) {
  if (phase === "sound") {
    return {
      endpoint: "sound_effect",
      buildRequest: (_plan, job) => ({ model: "eleven_text_to_sound_v2", promptText: job.promptText, duration: job.durationS, loop: Boolean(job.loop) }),
      estimate: estimateSoundCredits,
      validate: validateSoundPlan,
    };
  }
  return {
    endpoint: "text_to_speech",
    buildRequest: (_plan, job) => ({ model: voice.model, promptText: job.promptText, voice: { type: "runway-preset", presetId: job.presetId }, ...voice.settings }),
    estimate: (job) => estimateCredits(job.promptText),
    validate: validateSoundPlan,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const runDir = args[0];
  if (!runDir) {
    console.error("usage: generate-sound.mjs art/runs/<id> [--spend]");
    process.exit(2);
  }
  const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : null);
  const spend = args.includes("--spend");
  if (spend && !process.env.RUNWAYML_API_SECRET) {
    console.error("RUNWAYML_API_SECRET is not set");
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(path.join(runDir, "plan.json"), "utf8"));
  const plan = { ...raw, jobs: toJobs(raw) };
  const narrator = JSON.parse(fs.readFileSync("art/voice/narrator.json", "utf8"));
  for (const phase of ["sound", "voice"]) {
    const { stopped } = await runPhase({ plan, runDir, phase, spend, acceptLost: valueOf("--accept-lost"), retry: valueOf("--retry"), apiKey: process.env.RUNWAYML_API_SECRET, ...soundOptions(phase, { model: narrator.model, settings: narrator.settings }) });
    if (stopped) process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  await main();
}
