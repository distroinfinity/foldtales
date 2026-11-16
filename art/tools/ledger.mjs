// A run's own spending, from its manifest.jsonl, and the check made before every paid job: a job
// starts only if what the run has already spent plus the job's known price stays within the run's
// cap, and (when the plan names its lane) within the lane's cap across the lane's runs. Spending is
// counted at list price from our own records, never from the shared balance, so other lanes'
// charges can neither stop a run early nor let it run past its cap (run 015's lesson).
import fs from "node:fs";
import path from "node:path";

/** List prices, in credits (vendor price list, measured in runs 001, 004 and 013). */
export function priceOf(job) {
  if (typeof job.credits === "number") return job.credits;
  const [w, h] = String(job.ratio ?? "").split(":").map(Number);
  const twoK = Math.max(w || 0, h || 0) > 1600;
  if (job.model === "seedream5_pro") return twoK ? 9 : 5;
  if (job.model === "seedream5_flash") return 2;
  throw new Error(`no known price for ${job.model} at ${job.ratio}: give the job a "credits" field`);
}

/** Credits a run has spent, from its manifest: each line's list-price cost (older lines: their logged credits). */
export function spentIn(runDir) {
  const file = path.join(runDir, "manifest.jsonl");
  if (!fs.existsSync(file)) return 0;
  let total = 0;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    total += typeof entry.cost === "number" ? entry.cost : typeof entry.credits === "number" ? entry.credits : 0;
  }
  return total;
}

/** What the lane has spent across the runs its plan names (`lane.runs`, folders beside this run). */
export function laneSpent(runDir, plan) {
  if (!plan.lane) return null;
  const runsDir = path.dirname(path.resolve(runDir));
  return plan.lane.runs.reduce((sum, id) => sum + spentIn(path.join(runsDir, id)), 0);
}

/** Whether the next job may start. Pure: the caller passes what's been spent. */
export function mayStart({ price, runSpent, runCap, laneSpent = null, laneCap = null }) {
  if (runSpent + price > runCap) return { ok: false, why: `run would reach ${runSpent + price} of its ${runCap} cap` };
  if (laneCap !== null && laneSpent !== null && laneSpent + price > laneCap) return { ok: false, why: `lane would reach ${laneSpent + price} of its ${laneCap} cap` };
  return { ok: true, why: null };
}

/** Appends one line to the run's ledger. `cost` is the list price, counted even if the job failed after it was accepted. */
export function record(runDir, entry) {
  fs.appendFileSync(path.join(runDir, "manifest.jsonl"), `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`);
}
