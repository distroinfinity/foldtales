import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { estimateCredits, validatePlan, readLedger, committedCredits, runPhase, LedgerCorrupt } from "./generate-voice.mjs";

const KEY = "sk-test-SECRET-KEY";
const MP3 = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 1, 2, 3]);
const SETTINGS = { stability: 0.4, similarityBoost: 0.75, languageCode: "en" };

const job = (id, over = {}) => ({ id, phase: "sweep", role: null, option: null, beat: "sweep", presetId: "Maya", promptText: `Hello there, ${id}.`, seed: 123, ...over });
const plan = (jobs, capCredits = 100) => ({ id: "test", capCredits, model: "eleven_v4", settings: SETTINGS, jobs });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "voice-"));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// A scriptable Runway: each hook can replace the normal response.
function fakeRunway(hooks = {}) {
  const s = { balance: 1000, posts: [], polls: 0, downloads: 0, nextId: 1, calls: 0 };
  s.fetchImpl = async (url, init = {}) => {
    s.calls += 1;
    if (url.endsWith("/organization")) return json({ creditBalance: s.balance });
    if (url.endsWith("/text_to_speech")) {
      s.posts.push(JSON.parse(init.body));
      const replaced = await hooks.onPost?.(s);
      if (replaced) return replaced;
      s.balance -= 1;
      return json({ id: `task-${s.nextId++}`, estimatedCost: { credits: 1 } });
    }
    const task = url.match(/\/tasks\/(.+)$/);
    if (task) {
      s.polls += 1;
      const replaced = await hooks.onPoll?.(s, task[1]);
      if (replaced) return replaced;
      return json({ id: task[1], status: "SUCCEEDED", cost: { credits: 1 }, output: [`https://cdn.test/${task[1]}.mp3`] });
    }
    s.downloads += 1;
    const replaced = await hooks.onDownload?.(s);
    if (replaced) return replaced;
    return new Response(MP3);
  };
  return s;
}

function runner(runDir, s, extra = {}) {
  const lines = [];
  const promise = runPhase({ plan: extra.plan, runDir, phase: extra.phase ?? "sweep", spend: extra.spend ?? true, acceptLost: extra.acceptLost ?? null, apiKey: KEY, fetchImpl: s.fetchImpl, log: (l) => lines.push(l), sleep: async () => {} });
  return { promise, lines };
}
const run = async (runDir, s, extra) => {
  const r = runner(runDir, s, extra);
  const result = await r.promise;
  return { ...result, lines: r.lines };
};
const manifest = (dir) => fs.readFileSync(path.join(dir, "manifest.jsonl"), "utf8");
const events = (dir) => manifest(dir).trim().split("\n").map((l) => JSON.parse(l));
const seed = (dir, list) => fs.writeFileSync(path.join(dir, "manifest.jsonl"), list.map((e) => JSON.stringify({ at: "2026-11-09T00:00:00Z", ...e })).join("\n") + "\n");

test("dry run makes no network calls and reports estimated credits", async () => {
  const dir = tmp();
  const s = fakeRunway();
  const { lines } = await run(dir, s, { plan: plan([job("a"), job("b")]), spend: false });
  assert.equal(s.calls, 0);
  assert.match(lines.join("\n"), /2 jobs/);
  assert.match(lines.join("\n"), /2 credits/);
});

test("estimateCredits: 200 chars is 1, 201 chars is 2", () => {
  assert.equal(estimateCredits("x".repeat(200)), 1);
  assert.equal(estimateCredits("x".repeat(201)), 2);
  assert.equal(estimateCredits("hi"), 1);
});

test("validatePlan rejects tag-only, <break>, unknown preset, over 200 chars, duplicate ids", () => {
  assert.doesNotThrow(() => validatePlan(plan([job("a")])));
  assert.throws(() => validatePlan(plan([job("a", { promptText: "[laughs] [sighs]" })])), /tag/i);
  assert.throws(() => validatePlan(plan([job("a", { promptText: 'wait <break time="1s"/> now' })])), /break/i);
  assert.throws(() => validatePlan(plan([job("a", { presetId: "Nobody" })])), /preset/i);
  assert.throws(() => validatePlan(plan([job("a", { promptText: "x".repeat(201) })])), /200/);
  assert.throws(() => validatePlan(plan([job("a", { promptText: "" })])), /empty/i);
  assert.throws(() => validatePlan(plan([job("a"), job("a")])), /duplicate/i);
});

test("spend run sends only eleven_v4 fields: model, promptText, voice preset, stability, similarityBoost, languageCode, seed", async () => {
  const dir = tmp();
  const s = fakeRunway();
  await run(dir, s, { plan: plan([job("a")]) });
  assert.deepEqual(s.posts[0], { model: "eleven_v4", promptText: "Hello there, a.", voice: { type: "runway-preset", presetId: "Maya" }, stability: 0.4, similarityBoost: 0.75, languageCode: "en", seed: 123 });
  assert.ok(fs.existsSync(path.join(dir, "a.mp3")));
  const done = events(dir).find((e) => e.event === "done");
  assert.equal(done.format, "mp3");
  assert.equal(done.credits, 1);
  assert.equal(done.presetId, "Maya");
  assert.equal(done.seed, 123);
  assert.equal(done.model, "eleven_v4");
  assert.deepEqual(done.settings, SETTINGS);
  assert.equal(done.promptText, "Hello there, a.");
  assert.equal(typeof done.seconds, "number");
});

test("intent, with the exact request body, is on disk before the POST, and started before the first poll", async () => {
  const dir = tmp();
  let atPost;
  let atPoll;
  const s = fakeRunway({
    onPost: () => { atPost = events(dir); },
    onPoll: () => { atPoll = atPoll ?? events(dir); },
  });
  await run(dir, s, { plan: plan([job("a")]) });
  const intent = atPost.find((e) => e.event === "intent");
  assert.ok(intent);
  assert.equal(intent.request.promptText, "Hello there, a.");
  assert.ok(atPoll.find((e) => e.event === "started" && e.taskId === "task-1"));
});

test("cap: stops before a job that would pass the cap, with no POST", async () => {
  const dir = tmp();
  const s = fakeRunway();
  const { stopped } = await run(dir, s, { plan: plan([job("a"), job("b"), job("c")], 2) });
  assert.match(stopped, /cap/i);
  assert.equal(s.posts.length, 2);
  assert.ok(!fs.existsSync(path.join(dir, "c.mp3")));
});

test("cap counts failed attempts, retakes and unresolved attempts", async () => {
  const dir = tmp();
  seed(dir, [
    { event: "intent", job: "x", attempt: 1, request: {} },
    { event: "failed", job: "x", attempt: 1, taskId: "t", credits: 1, reason: "x" },
    { event: "intent", job: "y-r2", attempt: 1, request: {} },
    { event: "started", job: "y-r2", attempt: 1, taskId: "t2", estimatedCredits: 1 },
    { event: "succeeded", job: "y-r2", attempt: 1, taskId: "t2", credits: 1, seconds: 1 },
    { event: "intent", job: "z", attempt: 1, request: {} },
    { event: "started", job: "z", attempt: 1, taskId: "t3", estimatedCredits: 1 },
  ]);
  assert.equal(committedCredits(readLedger(path.join(dir, "manifest.jsonl"))), 3);
  const s = fakeRunway();
  const { stopped } = await run(dir, s, { plan: plan([job("new")], 3) });
  assert.match(stopped, /cap/i);
  assert.equal(s.posts.length, 0);
});

test("rerun after a partial run submits only unfinished jobs and never repays", async () => {
  const dir = tmp();
  const s = fakeRunway();
  await run(dir, s, { plan: plan([job("a"), job("b"), job("c")], 2) });
  assert.equal(s.posts.length, 2);
  const again = fakeRunway();
  const { committed } = await run(dir, again, { plan: plan([job("a"), job("b"), job("c")], 3) });
  assert.equal(again.posts.length, 1);
  assert.equal(committed, 3);
});

test("rerun of a started task polls and does not POST", async () => {
  const dir = tmp();
  seed(dir, [
    { event: "intent", job: "a", attempt: 1, request: {} },
    { event: "started", job: "a", attempt: 1, taskId: "task-old", estimatedCredits: 1 },
  ]);
  const s = fakeRunway();
  await run(dir, s, { plan: plan([job("a")]) });
  assert.equal(s.posts.length, 0);
  assert.equal(s.polls, 1);
  assert.ok(fs.existsSync(path.join(dir, "a.mp3")));
});

test("network error on POST writes ambiguous and stops, with no resubmit on rerun", async () => {
  const dir = tmp();
  const s = fakeRunway({ onPost: () => { throw new TypeError("network down"); } });
  const first = await run(dir, s, { plan: plan([job("a"), job("b")]) });
  assert.match(first.stopped, /ambiguous/i);
  assert.equal(s.posts.length, 1);
  assert.ok(events(dir).some((e) => e.event === "ambiguous" && e.job === "a"));
  const again = fakeRunway();
  const second = await run(dir, again, { plan: plan([job("a"), job("b")]) });
  assert.match(second.stopped, /ambiguous/i);
  assert.equal(again.posts.length, 0);
});

test("a POST answered with 5xx is ambiguous, not retried", async () => {
  const dir = tmp();
  const s = fakeRunway({ onPost: () => json({ error: "boom" }, 502) });
  const { stopped } = await run(dir, s, { plan: plan([job("a")]) });
  assert.match(stopped, /ambiguous/i);
  assert.equal(s.posts.length, 1);
});

test("intent with no started on rerun stops as ambiguous", async () => {
  const dir = tmp();
  seed(dir, [{ event: "intent", job: "a", attempt: 1, request: {} }]);
  const s = fakeRunway();
  const { stopped } = await run(dir, s, { plan: plan([job("a")]) });
  assert.match(stopped, /ambiguous/i);
  assert.equal(s.posts.length, 0);
  assert.ok(events(dir).some((e) => e.event === "ambiguous"));
});

test("--accept-lost resolves an ambiguous job at 1 credit, then the job can be resubmitted", async () => {
  const dir = tmp();
  seed(dir, [
    { event: "intent", job: "a", attempt: 1, request: {} },
    { event: "ambiguous", job: "a", attempt: 1, reason: "lost" },
  ]);
  const s = fakeRunway();
  const { committed, stopped } = await run(dir, s, { plan: plan([job("a")]), acceptLost: "a" });
  assert.equal(stopped, null);
  assert.equal(s.posts.length, 1);
  assert.equal(committed, 2);
  const attempts = events(dir).filter((e) => e.event === "intent").map((e) => e.attempt);
  assert.deepEqual(attempts, [1, 2]);
});

test("poll survives network errors until the task finishes", async () => {
  const dir = tmp();
  let n = 0;
  const s = fakeRunway({ onPoll: () => { n += 1; if (n < 4) throw new TypeError("dropped"); } });
  const { stopped } = await run(dir, s, { plan: plan([job("a")]) });
  assert.equal(stopped, null);
  assert.equal(s.posts.length, 1);
  assert.ok(fs.existsSync(path.join(dir, "a.mp3")));
});

test("succeeded task with failed download retries only the download on rerun", async () => {
  const dir = tmp();
  const s = fakeRunway({ onDownload: () => new Response("nope", { status: 500 }) });
  const first = await run(dir, s, { plan: plan([job("a")]) });
  assert.match(first.stopped, /download/i);
  assert.ok(events(dir).some((e) => e.event === "succeeded"));
  const again = fakeRunway();
  const second = await run(dir, again, { plan: plan([job("a")]) });
  assert.equal(second.stopped, null);
  assert.equal(again.posts.length, 0);
  assert.equal(second.committed, 1);
  assert.ok(fs.existsSync(path.join(dir, "a.mp3")));
});

test("done job whose file was deleted recovers by task id with zero POSTs", async () => {
  const dir = tmp();
  const s = fakeRunway();
  await run(dir, s, { plan: plan([job("a")]) });
  fs.rmSync(path.join(dir, "a.mp3"));
  const again = fakeRunway();
  const second = await run(dir, again, { plan: plan([job("a")]) });
  assert.equal(second.stopped, null);
  assert.equal(again.posts.length, 0);
  assert.equal(second.committed, 1);
  assert.ok(fs.existsSync(path.join(dir, "a.mp3")));
});

test("balance events are written at the start and end of a round", async () => {
  const dir = tmp();
  const s = fakeRunway();
  await run(dir, s, { plan: plan([job("a")]) });
  const balance = events(dir).filter((e) => e.event === "balance");
  assert.deepEqual(balance.map((e) => [e.when, e.credits]), [["start", 1000], ["end", 999]]);
});

test("missing cost on a finished task stops the run and counts 1", async () => {
  const dir = tmp();
  const s = fakeRunway({ onPoll: (_, id) => json({ id, status: "SUCCEEDED", output: [`https://cdn.test/${id}.mp3`] }) });
  const { stopped, committed } = await run(dir, s, { plan: plan([job("a"), job("b")]) });
  assert.match(stopped, /cost/i);
  assert.equal(committed, 1);
  assert.equal(s.posts.length, 1);
});

test("4xx other than 429 stops", async () => {
  const dir = tmp();
  const s = fakeRunway({ onPost: () => json({ error: "bad" }, 400) });
  const { stopped, committed } = await run(dir, s, { plan: plan([job("a"), job("b")]) });
  assert.match(stopped, /rejected/i);
  assert.equal(s.posts.length, 1);
  assert.equal(committed, 0);
});

test("429 waits and retries with no charge", async () => {
  const dir = tmp();
  let n = 0;
  const s = fakeRunway({ onPost: () => { n += 1; if (n === 1) return json({ error: "slow" }, 429); } });
  const { stopped, committed } = await run(dir, s, { plan: plan([job("a")]) });
  assert.equal(stopped, null);
  assert.equal(s.posts.length, 2);
  assert.equal(committed, 1);
  assert.equal(events(dir).filter((e) => e.event === "intent").length, 1);
});

test("balance dropping by more than recorded costs stops the run", async () => {
  const dir = tmp();
  const s = fakeRunway({ onPost: (state) => { state.balance -= 7; } });
  const { stopped } = await run(dir, s, { plan: plan([job("a"), job("b")]) });
  assert.match(stopped, /balance/i);
  assert.equal(s.posts.length, 1);
});

test("truncated final manifest line throws LedgerCorrupt and makes no POST", async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "manifest.jsonl"), '{"event":"intent","job":"a","attempt":1}\n{"event":"sta');
  assert.throws(() => readLedger(path.join(dir, "manifest.jsonl")), LedgerCorrupt);
  const s = fakeRunway();
  await assert.rejects(run(dir, s, { plan: plan([job("a")]) }), LedgerCorrupt);
  assert.equal(s.posts.length, 0);
});

test("format is read from bytes: ID3 and MPEG sync give mp3; unknown bytes fail the job", async () => {
  const dir = tmp();
  const s = fakeRunway({ onDownload: () => new Response(Buffer.from([0xff, 0xfb, 0x90, 0x64, 0, 0])) });
  await run(dir, s, { plan: plan([job("a")]) });
  assert.equal(events(dir).find((e) => e.event === "done").format, "mp3");

  const bad = tmp();
  const t = fakeRunway({ onDownload: () => new Response("this is not audio") });
  const { stopped } = await run(bad, t, { plan: plan([job("a")]) });
  assert.match(stopped, /download/i);
  assert.ok(!fs.existsSync(path.join(bad, "a.txt")));
  assert.ok(!events(bad).some((e) => e.event === "done"));
});

test("the api key never appears in log output or the manifest, including on errors", async () => {
  const dir = tmp();
  const s = fakeRunway({ onPost: () => json({ error: `bad key ${KEY}` }, 401) });
  const { lines } = await run(dir, s, { plan: plan([job("a")]) });
  assert.ok(!lines.join("\n").includes(KEY));
  assert.ok(!manifest(dir).includes(KEY));
});
