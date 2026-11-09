// Runs a planned voice generation round through Runway's text to speech.
// Dry run by default. Skips finished jobs, cannot silently pay twice, and stops at the plan's credit cap.
// Usage, from the repo root:
//   node art/tools/generate-voice.mjs art/runs/<id> --phase <sweep|audition>
//   node --env-file=.env.local art/tools/generate-voice.mjs art/runs/<id> --phase <sweep|audition> --spend [--accept-lost <job>]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const API = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";
const POLL_MS = 2000;
const MAX_POLLS = 450; // 15 minutes
const MAX_RATE_LIMIT_RETRIES = 8;
const MAX_CHARS_PER_JOB = 200; // A job of 200 characters or fewer always costs exactly 1 credit, which keeps reservations exact.

export const PRESETS = ["Maya", "Arjun", "Serene", "Bernard", "Billy", "Mark", "Clint", "Mabel", "Chad", "Leslie", "Eleanor", "Elias", "Elliot", "Grungle", "Brodie", "Sandra", "Kirk", "Kylie", "Lara", "Lisa", "Malachi", "Marlene", "Martin", "Miriam", "Monster", "Paula", "Pip", "Rusty", "Ragnar", "Xylar", "Maggie", "Jack", "Katie", "Noah", "James", "Rina", "Ella", "Mariah", "Frank", "Claudia", "Niki", "Vincent", "Kendrick", "Myrna", "Tom", "Wanda", "Benjamin", "Kiana", "Rachel"];

export class LedgerCorrupt extends Error {}

export function estimateCredits(promptText) {
  return Math.max(1, Math.ceil((promptText.length * 5) / 1000));
}

export function validatePlan(plan) {
  const seen = new Set();
  for (const job of plan.jobs) {
    if (seen.has(job.id)) throw new Error(`duplicate job id: ${job.id}`);
    seen.add(job.id);
    if (!job.promptText) throw new Error(`${job.id}: empty promptText`);
    if (job.promptText.length > MAX_CHARS_PER_JOB) throw new Error(`${job.id}: over ${MAX_CHARS_PER_JOB} characters`);
    if (job.promptText.includes("<break")) throw new Error(`${job.id}: <break> tags are not supported, use [pause]`);
    if (!/\p{L}/u.test(job.promptText.replace(/\[[^\]]*\]/g, ""))) throw new Error(`${job.id}: script is only tags`);
    if (!PRESETS.includes(job.presetId)) throw new Error(`${job.id}: unknown preset ${job.presetId}`);
  }
}

export function readLedger(manifestPath) {
  const events = [];
  if (fs.existsSync(manifestPath)) {
    const lines = fs.readFileSync(manifestPath, "utf8").split("\n").filter((line) => line.trim());
    lines.forEach((line, i) => {
      try {
        events.push(JSON.parse(line));
      } catch {
        throw new LedgerCorrupt(`manifest line ${i + 1} is not JSON. A crash may have cut it off. Reconcile by hand before spending.`);
      }
    });
  }
  const attempts = new Map();
  for (const event of events) {
    if (event.attempt === undefined) continue;
    const key = `${event.job}#${event.attempt}`;
    if (!attempts.has(key)) attempts.set(key, { job: event.job, attempt: event.attempt, events: [] });
    attempts.get(key).events.push(event);
  }
  return { events, attempts };
}

const find = (attempt, name) => attempt.events.find((e) => e.event === name);
const findLast = (attempt, name) => attempt.events.findLast((e) => e.event === name);

function attemptState(attempt) {
  for (const state of ["accepted-lost", "done", "succeeded", "failed", "ambiguous", "started"]) {
    if (find(attempt, state)) return state;
  }
  return "intent";
}

function attemptCost(attempt) {
  const state = attemptState(attempt);
  if (state === "done" || state === "succeeded") return find(attempt, "succeeded")?.credits ?? 1;
  if (state === "failed") return find(attempt, "failed").credits ?? 1;
  return 1; // Unresolved, ambiguous or accepted-lost attempts all hold 1 credit.
}

export function committedCredits(ledger) {
  let total = 0;
  for (const attempt of ledger.attempts.values()) total += attemptCost(attempt);
  return total;
}

function latestAttempt(ledger, jobId) {
  let latest = null;
  for (const attempt of ledger.attempts.values()) {
    if (attempt.job === jobId && (!latest || attempt.attempt > latest.attempt)) latest = attempt;
  }
  return latest;
}

function detectFormat(bytes) {
  if (bytes.length < 4) return null;
  if (bytes.subarray(0, 3).toString("latin1") === "ID3") return "mp3";
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mp3";
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF") return "wav";
  if (bytes.subarray(0, 4).toString("latin1") === "OggS") return "ogg";
  return null;
}

function requestBody(plan, job) {
  return { model: plan.model, promptText: job.promptText, voice: { type: "runway-preset", presetId: job.presetId }, ...plan.settings, seed: job.seed };
}

export async function runPhase({ plan, runDir, phase, spend, acceptLost, apiKey, fetchImpl = fetch, log = console.log, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  validatePlan(plan);
  const manifestPath = path.join(runDir, "manifest.jsonl");
  const jobs = plan.jobs.filter((job) => job.phase === phase);
  const ledger = () => readLedger(manifestPath);
  const redact = (text) => (apiKey ? String(text).replaceAll(apiKey, "[redacted]") : String(text));
  const say = (line) => log(redact(line));
  const append = (event) => fs.appendFileSync(manifestPath, `${redact(JSON.stringify({ ...event, at: new Date().toISOString() }))}\n`);
  const committed = () => committedCredits(ledger());
  const finishedFile = (done) => {
    const file = path.join(runDir, done.file);
    return fs.existsSync(file) && detectFormat(fs.readFileSync(file)) !== null;
  };

  if (!spend) {
    const current = committedCredits(readLedger(manifestPath));
    const open = jobs.filter((job) => {
      const latest = latestAttempt(readLedger(manifestPath), job.id);
      return !(latest && attemptState(latest) === "done");
    });
    const estimate = open.reduce((sum, job) => sum + estimateCredits(job.promptText), 0);
    const chars = open.reduce((sum, job) => sum + job.promptText.length, 0);
    say(`dry run, ${phase}: ${open.length} jobs to generate of ${jobs.length}, ${chars} characters, estimated ${estimate} credits`);
    say(`committed so far ${current}, cap ${plan.capCredits}${current + estimate > plan.capCredits ? ", WOULD PASS THE CAP" : ""}`);
    return { stopped: null, committed: current };
  }

  if (!apiKey) throw new Error("RUNWAYML_API_SECRET is not set");
  const headers = { Authorization: `Bearer ${apiKey}`, "X-Runway-Version": RUNWAY_VERSION, "Content-Type": "application/json" };

  async function readBalance() {
    const r = await fetchImpl(`${API}/organization`, { headers });
    if (!r.ok) throw new Error(`organization ${r.status}`);
    return (await r.json()).creditBalance;
  }

  // Reads and validates the ledger before anything else, so a corrupt file can never lead to a POST.
  let current = ledger();
  if (acceptLost) {
    const lost = latestAttempt(current, acceptLost);
    if (!lost || !["intent", "ambiguous"].includes(attemptState(lost))) return { stopped: `nothing to accept for ${acceptLost}`, committed: committedCredits(current) };
    append({ event: "accepted-lost", job: lost.job, attempt: lost.attempt });
    say(`accepted ${lost.job} attempt ${lost.attempt} as lost, 1 credit counted`);
    current = ledger();
  }
  let unresolved = null;
  for (const attempt of current.attempts.values()) {
    const state = attemptState(attempt);
    if (state === "intent") append({ event: "ambiguous", job: attempt.job, attempt: attempt.attempt, reason: "no task id was recorded, so the outcome is unknown" });
    if (state === "intent" || state === "ambiguous") unresolved = unresolved ?? attempt.job;
  }
  if (unresolved) {
    const stopped = `ambiguous submission for ${unresolved}. Check the balance, then rerun with --accept-lost ${unresolved}.`;
    say(stopped);
    return { stopped, committed: committed() };
  }

  const startBalance = await readBalance();
  append({ event: "balance", when: "start", credits: startBalance });
  say(`round ${phase}: balance ${startBalance}, committed ${committed()}, cap ${plan.capCredits}`);
  let sessionCost = 0;

  async function pollTask(taskId) {
    for (let i = 0; i < MAX_POLLS; i += 1) {
      try {
        const r = await fetchImpl(`${API}/tasks/${taskId}`, { headers });
        if (r.ok) {
          const task = await r.json();
          if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(task.status)) return task;
        }
      } catch {
        // A network dropout must not lose a task that's already paid for, so keep checking.
      }
      await sleep(POLL_MS);
    }
    return null;
  }

  // The output link is public and short-lived. It gets no auth header.
  async function fetchAudio(url) {
    const r = await fetchImpl(url);
    if (!r.ok) throw new Error(`download ${r.status}`);
    const bytes = Buffer.from(await r.arrayBuffer());
    const format = detectFormat(bytes);
    if (!format) throw new Error("download was not recognizable audio");
    return { bytes, format };
  }

  async function saveClip(job, attempt, taskId, url, succeeded) {
    try {
      const { bytes, format } = await fetchAudio(url);
      const file = `${job.id}.${format}`;
      fs.writeFileSync(path.join(runDir, file), bytes);
      append({ event: "done", job: job.id, attempt, taskId, file, format, presetId: job.presetId, model: plan.model, settings: plan.settings, seed: job.seed, promptText: job.promptText, credits: succeeded.credits, seconds: succeeded.seconds });
      return true;
    } catch (e) {
      say(`download failed for ${job.id}: ${e.message}. Rerun to retry the download only.`);
      return false;
    }
  }

  // Re-reads a task we already paid for and fetches its audio. Never submits anything.
  async function recover(job, attempt) {
    const taskId = find(attempt, "started").taskId;
    const task = await pollTask(taskId);
    if (!task || task.status !== "SUCCEEDED" || !task.output?.[0]) return false;
    const succeeded = findLast(attempt, "succeeded");
    return saveClip(job, attempt.attempt, taskId, task.output[0], succeeded);
  }

  async function settle(job, attemptNumber, taskId, began) {
    const task = await pollTask(taskId);
    if (!task) return { stop: `still waiting on ${job.id} at the polling limit. Rerun to keep polling. Its task is not lost.` };
    const seconds = Math.round((Date.now() - began) / 100) / 10;
    const credits = Number.isFinite(task.cost?.credits) ? task.cost.credits : null;
    if (credits !== null) sessionCost += credits;
    if (task.status !== "SUCCEEDED") {
      append({ event: "failed", job: job.id, attempt: attemptNumber, taskId, credits, reason: `${task.status}: ${task.failure ?? ""} ${task.failureCode ?? ""}`.trim() });
      say(`FAILED ${job.id}: ${task.status} ${task.failureCode ?? ""}`);
      return credits === null ? { stop: `no reported cost for ${job.id}. Stopping so spend stays known.` } : {};
    }
    const succeeded = { event: "succeeded", job: job.id, attempt: attemptNumber, taskId, credits, seconds };
    append(succeeded);
    if (!(await saveClip(job, attemptNumber, taskId, task.output[0], succeeded))) return { stop: `download failed for ${job.id}` };
    say(`done ${job.id}: ${seconds}s, ${credits ?? "unknown"} credits`);
    return credits === null ? { stop: `no reported cost for ${job.id}. Stopping so spend stays known.` } : {};
  }

  async function submit(job, attemptNumber) {
    const request = requestBody(plan, job);
    append({ event: "intent", job: job.id, attempt: attemptNumber, request });
    let response;
    for (let tries = 0; ; tries += 1) {
      try {
        response = await fetchImpl(`${API}/text_to_speech`, { method: "POST", headers, body: JSON.stringify(request) });
      } catch (e) {
        append({ event: "ambiguous", job: job.id, attempt: attemptNumber, reason: `network error on submit: ${e.message}` });
        return { stop: `ambiguous submission for ${job.id}. Check the balance, then rerun with --accept-lost ${job.id}.` };
      }
      if (response.status !== 429) break;
      if (tries >= MAX_RATE_LIMIT_RETRIES) {
        append({ event: "failed", job: job.id, attempt: attemptNumber, credits: 0, reason: "rate limited, retries used up" });
        return { stop: `rejected ${job.id}: rate limited` };
      }
      await sleep(15000 * (tries + 1));
    }
    if (response.status >= 400 && response.status < 500) {
      const body = (await response.text()).slice(0, 300);
      append({ event: "failed", job: job.id, attempt: attemptNumber, credits: 0, reason: `rejected ${response.status}: ${body}` });
      return { stop: `rejected ${job.id} (${response.status}): ${body}` };
    }
    let created = null;
    if (response.ok) {
      try {
        created = await response.json();
      } catch {
        created = null;
      }
    }
    if (!created?.id) {
      append({ event: "ambiguous", job: job.id, attempt: attemptNumber, reason: `unusable response ${response.status} on submit` });
      return { stop: `ambiguous submission for ${job.id}. Check the balance, then rerun with --accept-lost ${job.id}.` };
    }
    append({ event: "started", job: job.id, attempt: attemptNumber, taskId: created.id, estimatedCredits: created.estimatedCost?.credits ?? null });
    return { taskId: created.id };
  }

  async function processJob(job) {
    const latest = latestAttempt(ledger(), job.id);
    const state = latest ? attemptState(latest) : null;
    if (state === "done" && finishedFile(findLast(latest, "done"))) return { skipped: true };
    if (state === "done" || state === "succeeded") {
      if (await recover(job, latest)) {
        say(`recovered ${job.id} from its existing task`);
        return {};
      }
      return { stop: `download failed for ${job.id}` };
    }
    if (state === "started") {
      return settle(job, latest.attempt, find(latest, "started").taskId, Date.now());
    }
    const estimate = estimateCredits(job.promptText);
    const spent = committed();
    if (spent + estimate > plan.capCredits) return { stop: `cap reached: committed ${spent} plus ${estimate} would pass ${plan.capCredits}. Stopped before ${job.id}.` };
    const attemptNumber = (latest?.attempt ?? 0) + 1;
    const began = Date.now();
    const submitted = await submit(job, attemptNumber);
    if (submitted.stop) return submitted;
    return settle(job, attemptNumber, submitted.taskId, began);
  }

  let stopped = null;
  for (const job of jobs) {
    const outcome = await processJob(job);
    if (outcome.skipped) {
      say(`skip ${job.id}, already generated`);
      continue;
    }
    if (outcome.stop) {
      stopped = outcome.stop;
      break;
    }
    let balance = null;
    try {
      balance = await readBalance();
    } catch {
      say(`could not read the balance after ${job.id}. Continuing.`);
    }
    if (balance !== null && startBalance - balance > sessionCost) {
      stopped = `balance fell by ${startBalance - balance} but this run recorded only ${sessionCost}. Another run may be spending on this account.`;
      break;
    }
  }

  let endBalance = null;
  try {
    endBalance = await readBalance();
  } catch {
    say("could not read the final balance");
  }
  if (endBalance !== null) append({ event: "balance", when: "end", credits: endBalance });
  if (stopped) say(`STOPPED: ${stopped}`);
  const total = committed();
  say(`round ${phase} ended: committed ${total} of cap ${plan.capCredits}`);
  return { stopped, committed: total };
}

async function main() {
  const args = process.argv.slice(2);
  const runDir = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--phase" && args[args.indexOf(a) - 1] !== "--accept-lost");
  const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : null);
  const phase = valueOf("--phase");
  if (!runDir || !["sweep", "audition"].includes(phase)) {
    console.error("usage: generate-voice.mjs <runDir> --phase <sweep|audition> [--spend] [--accept-lost <job>]");
    process.exit(2);
  }
  const spend = args.includes("--spend");
  if (spend && !process.env.RUNWAYML_API_SECRET) {
    console.error("RUNWAYML_API_SECRET is not set. Run with --env-file=.env.local.");
    process.exit(2);
  }
  const plan = JSON.parse(fs.readFileSync(path.join(runDir, "plan.json"), "utf8"));
  const { stopped } = await runPhase({ plan, runDir, phase, spend, acceptLost: valueOf("--accept-lost"), apiKey: process.env.RUNWAYML_API_SECRET });
  if (stopped) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  await main();
}
