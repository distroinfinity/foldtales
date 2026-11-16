// Runs a planned image run against an API, durably: before a paid job is submitted its list price
// is reserved in the run's ledger (manifest.jsonl) under a lock shared by the run's lane, so two
// invocations can't both spend the last credits; the task id is written the moment the task is
// accepted; and a restart settles any task still in flight (downloads it if it finished, counts it
// if it failed) instead of paying for it again. Spending is counted from the ledgers, never from the
// shared balance, which other lanes move.
import fs from "node:fs";
import path from "node:path";
import { laneSpent, mayStart, priceOf, record, spentIn } from "./ledger.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A lock file per lane (or per run), taken with an exclusive create; a dead holder's lock is taken over. */
async function withLock(runDir, plan, fn) {
  const lockPath = path.join(path.dirname(path.resolve(runDir)), `.lock-${plan.lane?.id ?? plan.id}`);
  for (let tries = 0; ; tries++) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, `${process.pid} ${Date.now()}`);
      fs.closeSync(fd);
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      const [pid] = String(fs.readFileSync(lockPath, "utf8")).split(" ").map(Number);
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch {
        alive = false;
      }
      if (!alive) fs.rmSync(lockPath, { force: true });
      else if (tries > 600) throw new Error(`lane lock ${lockPath} held by ${pid} for too long`);
      else await sleep(50);
    }
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
}

/** The ledger's lines, in order. */
function entries(runDir) {
  const file = path.join(runDir, "manifest.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

/** Reservations not yet settled: done, failed, released or orphaned. */
function outstanding(runDir) {
  const open = new Map();
  for (const e of entries(runDir)) {
    if (e.kind === "reserve") open.set(e.reservation, { job: e.job, taskId: null });
    else if (e.kind === "accepted" && open.has(e.reservation)) open.get(e.reservation).taskId = e.taskId;
    else if (["done", "failed", "released", "orphaned"].includes(e.kind)) open.delete(e.reservation);
  }
  return open;
}

async function waitFor(api, taskId) {
  for (;;) {
    // A network dropout mustn't lose an image that's already paid for, so keep checking until it returns.
    const task = await api.poll(taskId).catch(() => ({ status: "UNKNOWN" }));
    if (task.status === "SUCCEEDED" || task.status === "FAILED" || task.status === "CANCELLED") return task;
    await sleep(api.pollMs ?? 4000);
  }
}

async function finish(runDir, api, job, reservation, taskId, began, log) {
  const task = await waitFor(api, taskId);
  if (task.status !== "SUCCEEDED") {
    record(runDir, { kind: "failed", job: job.id, reservation, taskId, failed: `${task.status}: ${task.failure ?? ""}` });
    log(`FAILED ${job.id}: ${task.status}`);
    return;
  }
  fs.writeFileSync(path.join(runDir, `${job.id}.png`), await api.download(task.url));
  record(runDir, { kind: "done", job: job.id, reservation, taskId, model: job.model, ratio: job.ratio, refs: (job.refs ?? []).map((r) => r.file), prompt: job.prompt, seconds: Math.round((Date.now() - began) / 1000) });
  log(`done ${job.id}`);
}

/**
 * Runs `plan` in `runDir` with `api` ({ submit(job) -> taskId, poll(taskId), download(url) }).
 * `submit` throws an error with `charged: false` when the API refused before charging.
 */
export async function runPlan({ runDir, plan, api, dry = false, log = console.log }) {
  // First, settle anything a previous invocation left in flight.
  for (const [reservation, { job: jobId, taskId }] of outstanding(runDir)) {
    const job = plan.jobs.find((j) => j.id === jobId);
    if (taskId && job) {
      log(`recovering ${jobId} (task ${taskId})`);
      await finish(runDir, api, job, reservation, taskId, Date.now(), log);
    } else {
      // Reserved but never known to be accepted: keep it counted (it may have been charged).
      record(runDir, { kind: "orphaned", job: jobId, reservation });
    }
  }
  for (const job of plan.jobs) {
    if (fs.existsSync(path.join(runDir, `${job.id}.png`))) continue;
    const price = priceOf(job);
    const reservation = await withLock(runDir, plan, () => {
      const check = mayStart({ price, runSpent: spentIn(runDir), runCap: plan.capCredits, laneSpent: laneSpent(runDir, plan), laneCap: plan.lane?.capCredits ?? null });
      if (!check.ok) return { stop: check.why };
      if (dry) return { dry: true };
      const id = `${job.id}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      record(runDir, { kind: "reserve", job: job.id, reservation: id, cost: price });
      return { id };
    });
    if (reservation.stop) {
      log(`stopping before ${job.id} (${price} credits): ${reservation.stop}`);
      break;
    }
    if (reservation.dry) {
      log(`would run ${job.id}: ${price} credits`);
      continue;
    }
    const began = Date.now();
    let taskId;
    try {
      taskId = await api.submit(job);
    } catch (e) {
      if (e.charged === false) record(runDir, { kind: "released", job: job.id, reservation: reservation.id, cost: -price, failed: e.message });
      else record(runDir, { kind: "orphaned", job: job.id, reservation: reservation.id, failed: e.message });
      log(`FAILED ${job.id}: ${e.message}`);
      continue;
    }
    record(runDir, { kind: "accepted", job: job.id, reservation: reservation.id, taskId });
    await finish(runDir, api, job, reservation.id, taskId, began, log);
  }
  return { runSpent: spentIn(runDir), laneSpent: laneSpent(runDir, plan) };
}
