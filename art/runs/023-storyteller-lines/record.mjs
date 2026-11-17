// Records run 023's lines with OpenAI's gpt-4o-mini-tts, using art/voice/live.json's voice, direction
// and speed per speaker, so a recorded line sounds like the same character live. A line already
// recorded is skipped, so a rerun never pays twice; the plan's character cap is kept across reruns.
// Every call is logged to manifest.jsonl: the request (never the key), the time, the characters and
// the audio's length, and an estimate of its cost at OpenAI's published prices.
//
// Usage, from the repo root: node --env-file=.env.local art/runs/023-storyteller-lines/record.mjs [--go]
// Without --go it only says what it would record.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const RUN = 'art/runs/023-storyteller-lines';
const plan = JSON.parse(fs.readFileSync(`${RUN}/plan.json`, 'utf8'));
const live = JSON.parse(fs.readFileSync('art/voice/live.json', 'utf8'));
const go = process.argv.includes('--go');
const key = process.env.OPENAI_API_KEY;
const LEDGER = `${RUN}/manifest.jsonl`;

const log = (entry) => fs.appendFileSync(LEDGER, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`);
const ledger = fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
let spentChars = ledger.filter((e) => e.event === 'done').reduce((n, e) => n + e.characters, 0);
const seconds = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());
/** OpenAI's published figures for gpt-4o-mini-tts: $0.60 per 1M text tokens (about 4 characters each), and about $0.015 a minute of audio. */
const costOf = (characters, audioS) => (characters / 4) * (0.6 / 1e6) + (audioS / 60) * 0.015;

if (go && !key) throw new Error('needs OPENAI_API_KEY (in .env.local)');
for (const job of plan.lineJobs) {
  const out = `${RUN}/${job.id}.mp3`;
  if (fs.existsSync(out)) {
    console.log(`have ${job.id}`);
    continue;
  }
  const v = live.voices[job.speaker];
  if (!v) throw new Error(`no live voice for ${job.speaker}`);
  if (spentChars + job.text.length > plan.capCharacters) {
    console.log(`stop: ${job.id} would pass the cap (${spentChars} + ${job.text.length} > ${plan.capCharacters})`);
    break;
  }
  const request = { model: live.model, voice: v.voice, input: job.text, instructions: v.instructions, response_format: 'mp3', speed: v.speed };
  if (!go) {
    console.log(`would record ${job.id} (${job.speaker}, ${job.text.length} chars)`);
    continue;
  }
  log({ event: 'intent', job: job.id, request });
  const started = Date.now();
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 200);
    log({ event: 'failed', job: job.id, status: response.status, body });
    throw new Error(`${job.id}: OpenAI answered ${response.status} ${body}`);
  }
  fs.writeFileSync(out, Buffer.from(await response.arrayBuffer()));
  const audioS = seconds(out);
  spentChars += job.text.length;
  const estimatedUsd = Number(costOf(job.text.length, audioS).toFixed(5));
  log({ event: 'done', job: job.id, ms: Date.now() - started, characters: job.text.length, audioS, estimatedUsd });
  console.log(`${job.id}: ${job.text.length} chars, ${audioS.toFixed(2)} s, ${Date.now() - started} ms, ~$${estimatedUsd}`);
}
console.log(`characters spent in this run: ${spentChars} of ${plan.capCharacters}`);
