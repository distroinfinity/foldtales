// Runs a planned art generation run. Skips finished jobs, logs each image, and stops before any job
// that would take the run past its own cap, or its lane past the lane's cap (art/tools/ledger.mjs).
// Usage, from the repo root: node --env-file=.env.local art/tools/generate.mjs art/runs/<id> [--dry]
// --dry prints what would be spent, job by job, and spends nothing.
import fs from "node:fs";
import path from "node:path";
import { laneSpent, mayStart, priceOf, record, spentIn } from "./ledger.mjs";

const runDir = process.argv[2];
const dry = process.argv.includes("--dry");
const plan = JSON.parse(fs.readFileSync(path.join(runDir, "plan.json"), "utf8"));
const API = "https://api.dev.runwayml.com/v1";
const headers = {
  Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`,
  "X-Runway-Version": "2024-11-06",
  "Content-Type": "application/json",
};

async function balance() {
  const r = await fetch(`${API}/organization`, { headers });
  if (!r.ok) throw new Error(`organization ${r.status}`);
  return (await r.json()).creditBalance;
}

function referenceImages(job) {
  return (job.refs ?? []).map((ref) => {
    const image = { uri: `data:image/png;base64,${fs.readFileSync(ref.file).toString("base64")}` };
    if (ref.tag) image.tag = ref.tag;
    return image;
  });
}

/** Creates the task (from here on it's paid for) and waits for it. */
async function generate(job, accepted) {
  const body = { model: job.model, ratio: job.ratio, promptText: job.prompt, ...job.params };
  if (job.refs?.length) body.referenceImages = referenceImages(job);
  const r = await fetch(`${API}/text_to_image`, { method: "POST", headers, body: JSON.stringify(body) });
  const made = await r.json();
  if (!r.ok) throw Object.assign(new Error(`rejected ${r.status}: ${JSON.stringify(made).slice(0, 300)}`), { charged: false });
  accepted(made.id);
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    // A network dropout mustn't lose an image that's already paid for, so keep checking until it returns.
    const task = await fetch(`${API}/tasks/${made.id}`, { headers }).then((r) => r.json()).catch(() => ({ status: "UNKNOWN" }));
    if (task.status === "SUCCEEDED") return { taskId: made.id, url: task.output[0] };
    if (task.status === "FAILED" || task.status === "CANCELLED") throw Object.assign(new Error(`${task.status}: ${task.failure ?? ""} ${task.failureCode ?? ""}`), { charged: true, taskId: made.id });
  }
}

let runSpent = spentIn(runDir);
let lane = laneSpent(runDir, plan);
const laneCap = plan.lane?.capCredits ?? null;
console.log(`Run ${plan.id}: ${plan.question}\nspent so far ${runSpent} of the run's ${plan.capCredits}${lane !== null ? `; lane ${plan.lane.id} ${lane} of ${laneCap}` : ""}${dry ? " (dry run)" : ""}`);
const start = dry ? null : await balance();
for (const job of plan.jobs) {
  const file = path.join(runDir, `${job.id}.png`);
  if (fs.existsSync(file)) { console.log(`skip ${job.id}, already generated`); continue; }
  const price = priceOf(job);
  const check = mayStart({ price, runSpent, runCap: plan.capCredits, laneSpent: lane, laneCap });
  if (!check.ok) { console.log(`stopping before ${job.id} (${price} credits): ${check.why}`); break; }
  if (dry) {
    console.log(`would run ${job.id}: ${price} credits, run total ${runSpent + price}`);
    runSpent += price;
    if (lane !== null) lane += price;
    continue;
  }
  const before = await balance();
  const began = Date.now();
  let taskId = null;
  const count = () => {
    runSpent += price;
    if (lane !== null) lane += price;
  };
  try {
    const made = await generate(job, (id) => (taskId = id));
    fs.writeFileSync(file, Buffer.from(await (await fetch(made.url)).arrayBuffer()));
    const balanceDrop = before - (await balance());
    const seconds = Math.round((Date.now() - began) / 1000);
    record(runDir, { job: job.id, model: job.model, ratio: job.ratio, params: job.params ?? {}, refs: (job.refs ?? []).map((ref) => ref.file), prompt: job.prompt, taskId, cost: price, balanceDrop, seconds });
    count();
    console.log(`done ${job.id}: ${seconds}s, ${price} credits (balance fell ${balanceDrop}${balanceDrop > price ? ": someone else is spending too" : ""})`);
  } catch (e) {
    // An accepted task is counted at list price even if it failed, so a retry can't pass the cap.
    if (e.charged !== false && taskId) {
      record(runDir, { job: job.id, model: job.model, ratio: job.ratio, taskId, cost: price, failed: e.message });
      count();
    }
    console.log(`FAILED ${job.id}: ${e.message}`);
  }
}
console.log(dry ? `dry run: would spend ${runSpent - spentIn(runDir)}` : `finished: run ${runSpent} of ${plan.capCredits}${lane !== null ? `, lane ${lane} of ${laneCap}` : ""}; shared balance fell ${start - (await balance())}`);
