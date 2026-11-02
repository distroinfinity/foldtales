// Runs a planned art generation run. Skips finished jobs, logs each image, and stops at the plan's credit cap.
// Usage, from the repo root: node --env-file=.env.local art/tools/generate.mjs art/runs/<id>
import fs from "node:fs";
import path from "node:path";

const runDir = process.argv[2];
const plan = JSON.parse(fs.readFileSync(path.join(runDir, "plan.json"), "utf8"));
const manifestPath = path.join(runDir, "manifest.jsonl");
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

async function generate(job) {
  const body = { model: job.model, ratio: job.ratio, promptText: job.prompt, ...job.params };
  if (job.refs?.length) body.referenceImages = referenceImages(job);
  const r = await fetch(`${API}/text_to_image`, { method: "POST", headers, body: JSON.stringify(body) });
  const made = await r.json();
  if (!r.ok) throw new Error(`rejected ${r.status}: ${JSON.stringify(made).slice(0, 300)}`);
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    // A network dropout mustn't lose an image that's already paid for, so keep checking until it returns.
    const task = await fetch(`${API}/tasks/${made.id}`, { headers }).then((r) => r.json()).catch(() => ({ status: "UNKNOWN" }));
    if (task.status === "SUCCEEDED") return { taskId: made.id, url: task.output[0] };
    if (task.status === "FAILED" || task.status === "CANCELLED") throw new Error(`${task.status}: ${task.failure ?? ""} ${task.failureCode ?? ""}`);
  }
}

const start = await balance();
console.log(`Run ${plan.id}: ${plan.question}\nbalance ${start}, cap ${plan.capCredits}`);
for (const job of plan.jobs) {
  const file = path.join(runDir, `${job.id}.png`);
  if (fs.existsSync(file)) { console.log(`skip ${job.id}, already generated`); continue; }
  const before = await balance();
  if (start - before >= plan.capCredits) { console.log(`cap reached at ${start - before}, stopping before ${job.id}`); break; }
  const began = Date.now();
  try {
    const { taskId, url } = await generate(job);
    fs.writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
    const credits = before - (await balance());
    const seconds = Math.round((Date.now() - began) / 1000);
    fs.appendFileSync(manifestPath, `${JSON.stringify({ job: job.id, model: job.model, ratio: job.ratio, params: job.params ?? {}, refs: (job.refs ?? []).map((ref) => ref.file), prompt: job.prompt, taskId, credits, seconds, at: new Date().toISOString() })}\n`);
    console.log(`done ${job.id}: ${seconds}s, ${credits} credits`);
  } catch (e) {
    console.log(`FAILED ${job.id}: ${e.message}`);
  }
}
console.log(`finished, total spent ${start - (await balance())}`);
