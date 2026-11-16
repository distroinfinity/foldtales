// Runs a planned art generation run: art/tools/runner.mjs with Runway's API. Each paid job's price is
// reserved in the run's ledger under the lane's lock before it's submitted, its task id is written
// the moment it's accepted, and a restart settles anything left in flight, so a run can't pass its
// own cap or its lane's, whatever other lanes spend or however it's interrupted.
// Usage, from the repo root: node --env-file=.env.local art/tools/generate.mjs art/runs/<id> [--dry]
import fs from "node:fs";
import path from "node:path";
import { runPlan } from "./runner.mjs";

const runDir = process.argv[2];
const dry = process.argv.includes("--dry");
const plan = JSON.parse(fs.readFileSync(path.join(runDir, "plan.json"), "utf8"));
const API = "https://api.dev.runwayml.com/v1";
const headers = { Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`, "X-Runway-Version": "2024-11-06", "Content-Type": "application/json" };

const referenceImages = (job) =>
  (job.refs ?? []).map((ref) => {
    const image = { uri: `data:image/png;base64,${fs.readFileSync(ref.file).toString("base64")}` };
    if (ref.tag) image.tag = ref.tag;
    return image;
  });

const api = {
  async submit(job) {
    const body = { model: job.model, ratio: job.ratio, promptText: job.prompt, ...job.params };
    if (job.refs?.length) body.referenceImages = referenceImages(job);
    const r = await fetch(`${API}/text_to_image`, { method: "POST", headers, body: JSON.stringify(body) });
    const made = await r.json();
    if (!r.ok) throw Object.assign(new Error(`rejected ${r.status}: ${JSON.stringify(made).slice(0, 300)}`), { charged: false });
    return made.id;
  },
  poll: (taskId) => fetch(`${API}/tasks/${taskId}`, { headers }).then((r) => r.json()).then((t) => ({ status: t.status, url: t.output?.[0], failure: t.failure ?? t.failureCode })),
  download: async (url) => Buffer.from(await (await fetch(url)).arrayBuffer()),
};

console.log(`Run ${plan.id}: ${plan.question}${dry ? " (dry run)" : ""}`);
const { runSpent, laneSpent } = await runPlan({ runDir, plan, api, dry });
console.log(`run ${runSpent} of ${plan.capCredits}${laneSpent !== null ? `, lane ${laneSpent} of ${plan.lane.capCredits}` : ""}`);
