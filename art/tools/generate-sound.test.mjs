import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { soundOptions, toJobs, estimateSoundCredits } from "./generate-sound.mjs";
import { runPhase } from "./generate-voice.mjs";

const MP3 = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 1, 2, 3]);
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const plan = {
  id: "t", capCredits: 50,
  soundJobs: [{ id: "gust", durationS: 2, promptText: "A gust." }, { id: "hum", durationS: 5, loop: true, promptText: "A hum." }],
  voiceJobs: [{ id: "line", role: "narrator", presetId: "Wanda", promptText: "Hello." }],
};

function fake() {
  const s = { posts: [], balance: 100 };
  s.fetchImpl = async (url, init = {}) => {
    if (url.endsWith("/organization")) return json({ creditBalance: s.balance });
    if (url.endsWith("/sound_effect") || url.endsWith("/text_to_speech")) {
      const body = JSON.parse(init.body);
      s.posts.push({ url: url.split("/").pop(), body });
      const cost = body.duration ? Math.ceil(body.duration) : 1;
      s.balance -= cost;
      return json({ id: `task-${s.posts.length}`, estimatedCost: { credits: cost } });
    }
    const task = url.match(/\/tasks\/(.+)$/);
    if (task) {
      const post = s.posts[Number(task[1].split("-")[1]) - 1];
      return json({ id: task[1], status: "SUCCEEDED", cost: { credits: post.body.duration ? Math.ceil(post.body.duration) : 1 }, output: [`https://cdn.test/${task[1]}.mp3`] });
    }
    return new Response(MP3);
  };
  return s;
}

test("a sound costs a credit a second, rounded up", () => {
  assert.equal(estimateSoundCredits({ durationS: 1.5 }), 2);
  assert.equal(estimateSoundCredits({ durationS: 0.5 }), 1);
});

test("sound jobs go to the sound-effect endpoint with their duration and loop, voice jobs to speech with their preset", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sound-"));
  const s = fake();
  const voice = { model: "eleven_v4", settings: { stability: 0.4, similarityBoost: 0.75, languageCode: "en" } };
  for (const phase of ["sound", "voice"]) {
    const { stopped } = await runPhase({ plan: { ...plan, jobs: toJobs(plan) }, runDir: dir, phase, spend: true, acceptLost: null, apiKey: "k", fetchImpl: s.fetchImpl, log: () => {}, sleep: async () => {}, ...soundOptions(phase, voice) });
    assert.equal(stopped, null);
  }
  assert.deepEqual(s.posts[0], { url: "sound_effect", body: { model: "eleven_text_to_sound_v2", promptText: "A gust.", duration: 2, loop: false } });
  assert.deepEqual(s.posts[1].body.loop, true);
  assert.equal(s.posts[2].url, "text_to_speech");
  assert.equal(s.posts[2].body.voice.presetId, "Wanda");
  assert.ok(fs.existsSync(path.join(dir, "gust.mp3")));
  assert.ok(fs.existsSync(path.join(dir, "line.mp3")));
});

test("the cap counts sound seconds, not one credit a job", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sound-"));
  const s = fake();
  const { stopped } = await runPhase({ plan: { ...plan, capCredits: 4, jobs: toJobs(plan) }, runDir: dir, phase: "sound", spend: true, acceptLost: null, apiKey: "k", fetchImpl: s.fetchImpl, log: () => {}, sleep: async () => {}, ...soundOptions("sound", {}) });
  assert.match(stopped, /cap reached/);
  assert.equal(s.posts.length, 1);
});
