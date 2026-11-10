# Voice audition implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a small, grouped set of voice options in front of the user on the Quest's speakers, record the cast they pick, and close run 005 with costs.

**Architecture:** One separate script generates dry clips through Runway's `eleven_v4`, and a ledger keeps it from ever paying twice or passing the cap. A dependency-free Web Audio module applies the paper-radio chain at playback, so prepared and live lines go through the same code. A small LAN server plays the audition page on the headset.

**Tech Stack:** Node 24 (ESM, `node:test`, built-in `fetch`), native Web Audio nodes, `ffmpeg` for measurement, headless Chrome for browser tests. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-09-voice-audition-design.md`. Read it first. The spec owns the lines, settings and numbers.

## Global Constraints

- Never edit `art/tools/generate.mjs`, `client`, `backend` or `contracts`. Do not import from `spikes/`.
- No paid API call before a question card is approved for it. Each approved window covers one round, and retakes made during it. A later paid retake needs a new card and a new window.
- Every paid process must finish, with all tasks resolved, before anything downstream runs or the user is told the round is over.
- `RUNWAYML_API_SECRET` is read from the environment only. It is never printed, logged or written. No `.env` file is opened or served.
- Run folder: `art/runs/005-voice-audition/`. Model: `eleven_v4`. Settings on every job: `stability` 0.4, `similarityBoost` 0.75, `languageCode` `en`. `capCredits` 100.
- Web Audio uses native nodes only. No `AudioWorklet`.
- Ports come from `CLIENT_PORT` in `.env.ports`, with no fallback number.
- No action on the Quest. The user performs every headset step.
- Commit to this branch after each task. Do not push, merge or open a PR.
- Do not publish to Claude artifacts or Claude Docs.

## Review Focus

1. Quest suspends audio when the headset comes off: the next tap must resume the `AudioContext` and play. Test in Task 5.
2. A clip that is missing or won't decode: its cell shows as unavailable and every other cell keeps working. Test in Task 5.
3. Rapid taps across cells: only the most recent clip is audible, with no overlap. Test in Task 5.
4. The manifest's last line was cut off by a crash: the run stops and asks for reconciliation rather than guessing. Test in Task 1.
5. Rerunning a round after the cap stopped it, or after a partial run: nothing already paid for is paid again. Test in Task 1.

---

### Task 1: The generation script and its ledger

**Files:**
- Create: `art/tools/generate-voice.mjs`
- Test: `art/tools/generate-voice.test.mjs`

**Interfaces:**
- Produces, all exported from `generate-voice.mjs`:
  - `estimateCredits(promptText: string): number`, `max(1, ceil(chars × 5 / 1000))`.
  - `validatePlan(plan): void`, throws on a job whose `promptText` is empty, over 200 characters (the spec's 1-credit invariant), contains only `[tags]` or has `<break>`, or whose `presetId` is not one of the 49 names; and on duplicate job ids.
  - `readLedger(manifestPath: string): Ledger`, throws `LedgerCorrupt` on a line that isn't JSON.
  - `committedCredits(ledger): number`.
  - `runPhase({ plan, runDir, phase, spend, acceptLost, apiKey, fetchImpl, log, sleep }): Promise<{ stopped: string|null, committed: number }>`.
- Plan shape used here and in Task 6: `{ id, question, why, decideBy, learnEvenIfRejected, reusableOutput, capCredits, model, settings, jobs: [{ id, phase, role, option, beat, presetId, promptText, seed, retakeOf? }] }`.
- Manifest: one JSON event per line, each with `event`, `job`, `attempt`, `at`.

| Event | Extra fields | Counts toward committed |
|---|---|---|
| `intent` | `request`, the exact POST body | 1 until a later event for this attempt |
| `started` | `taskId`, `estimatedCredits` | 1 until resolved |
| `succeeded` | `taskId`, `credits`, `seconds` | `credits`, or 1 and stop if null |
| `done` | `file`, `format`, `presetId`, `model`, `settings`, `seed`, `promptText`, `taskId`, `credits`, `seconds` | Already counted on `succeeded` |
| `failed` | `taskId?`, `credits`, `reason` | `credits`, or 1 and stop if null |
| `ambiguous` | `reason` | 1 |
| `accepted-lost` | | 1, and the attempt is resolved |
| `balance` | `credits`, `when`: `start` or `end` | No, it's for reconciling each round |

A rerun that finds `succeeded` with no `done`, or `done` whose file is missing or has unrecognized bytes, re-reads that task id and retries only the download, with zero POSTs. If the URL has expired, it stops and says so. A job is finished when a `done` event exists and its file is on disk and valid.

- [ ] **Step 1: Write failing tests** with a fake `fetchImpl` that scripts `/organization`, `/text_to_speech`, `/tasks/:id` and the output URL, and a no-op `sleep`. Names and assertions:

```js
test('dry run makes no network calls and reports estimated credits')
test('estimateCredits: 200 chars is 1, 201 chars is 2')
test('validatePlan rejects tag-only, <break>, unknown preset, over 200 chars, duplicate ids')
test('spend run sends only eleven_v4 fields: model, promptText, voice preset, stability, similarityBoost, languageCode, seed')
test('intent, with the exact request body, is on disk before the POST, and started before the first poll')
test('cap: stops before a job that would pass the cap, with no POST')
test('cap counts failed attempts, retakes and unresolved attempts')
test('rerun after a partial run submits only unfinished jobs and never repays')
test('rerun of a started task polls and does not POST')
test('network error on POST writes ambiguous and stops, with no resubmit on rerun')
test('intent with no started on rerun stops as ambiguous')
test('--accept-lost resolves an ambiguous job at 1 credit, then the job can be resubmitted')
test('poll survives network errors until the task finishes')
test('succeeded task with failed download retries only the download on rerun')
test('done job whose file was deleted recovers by task id with zero POSTs')
test('balance events are written at the start and end of a round')
test('missing cost on a finished task stops the run and counts 1')
test('4xx other than 429 stops; 429 waits and retries with no charge')
test('balance dropping by more than recorded costs stops the run')
test('truncated final manifest line throws LedgerCorrupt and makes no POST')
test('format is read from bytes: ID3 and MPEG sync give mp3; unknown bytes fail the job')
test('the api key never appears in log output or the manifest, including on errors')
```

- [ ] **Step 2: Run to verify failure.** `node --test art/tools/generate-voice.test.mjs`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `generate-voice.mjs`.** API base `https://api.dev.runwayml.com/v1`, header `X-Runway-Version: 2024-11-06`. `POST /text_to_speech` body: `{ model, promptText, voice: { type: 'runway-preset', presetId }, stability, similarityBoost, languageCode, seed }`. Poll `/tasks/:id` every 2 s for up to 15 minutes, keep polling through network errors, and at the limit stop with the `started` line in place. A POST that returns 5xx or throws is `ambiguous`. A rejected 4xx writes `failed` with `credits: 0`, then stops. Check balance before the first job and after each job, and stop if `start − current` exceeds the sum of this process's recorded credits. The CLI, run only when the file is the entry point: `node --env-file=.env.local art/tools/generate-voice.mjs <runDir> --phase <sweep|audition> [--spend] [--accept-lost <job>]`. A missing key exits with an error naming the variable, only when `--spend` is set.

- [ ] **Step 4: Run tests.** Expected: all PASS.

- [ ] **Step 5: Commit.** `git add art/tools/generate-voice.mjs art/tools/generate-voice.test.mjs && git commit -m "Add voice generation script with spend ledger"`

### Task 2: The voice chain and room tone

**Files:**
- Create: `art/voice/chain.mjs`, `art/voice/chain.json`, `art/tools/chrome-harness.mjs`, `art/voice/chain-selftest.html`
- Test: `art/tools/chain.test.mjs`

**Interfaces:**
- Produces, from `chain.mjs`, with no imports and no fetch:
  - `createVoiceChain(ctx: BaseAudioContext, settings, { trimDb = 0 } = {}) → { input: AudioNode, output: AudioNode, filters: BiquadFilterNode[] }`. Order: trim gain, highpass, warmth peaking, presence peaking, lowpass, WaveShaper with `oversample: '2x'`, compressor, output gain at `settings.outputDb`.
  - `createRoomTone(ctx, settings) → { output: AudioNode, buffer: AudioBuffer, start(when?): void, stop(): void }`.
  - `saturationCurve(drive: number): Float32Array`, 2049 points of `tanh(drive·x)/tanh(drive)`.
- Produces `chain.json`: `{ version: 1, default: "warm-radio", settings: { "soft-paper": {...}, "warm-radio": {...}, "old-wireless": {...} }, roomTone: { seed, loopSeconds: 12, lowHz: 180, highHz: 2500, rmsDb: -46, driftDb: 1.5 } }`. Each setting has `highpassHz`, `warmthHz`, `warmthQ`, `warmthDb`, `presenceHz`, `presenceQ`, `presenceDb`, `lowpassHz`, `drive`, `compressor: { thresholdDb, ratio, attackMs, releaseMs }`, `outputDb: 0`. Values are the spec's table. `outputDb` gets calibrated in Task 7.
- Produces `chrome-harness.mjs`: `runInChrome({ handler, path, timeoutMs }) → Promise<result>`. It starts a local server on an OS-assigned port (test only, no `.env.ports` use), serves `handler`, and adds `POST /__result` which resolves with the JSON body. It launches `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` with `--headless=new --autoplay-policy=no-user-gesture-required --user-data-dir=<temp>`, and always kills Chrome and removes the temp directory.

- [ ] **Step 1: Write the failing test.** `chain.test.mjs` runs `chain-selftest.html` in Chrome and asserts on the posted JSON, for each of the three settings:

```js
test('low-level multi-tone, relative to 1 kHz, is within 2 dB of summed getFrequencyResponse at 60, 280, 1800, 6000, 10000 Hz')   // saturation and compressor add flat gain, so compare relative to 1 kHz
test('same signal agrees within 1.5 dB per band across OfflineAudioContext, AudioContext+AudioBufferSource, MediaElementSource, and scheduled chunks')
test('room tone: same seed gives identical buffer, RMS -46 dBFS within 2 dB, loop-seam step under 0.002')
test('saturationCurve maps 1 to 1 and -1 to -1 and is monotonic')
test('chain.mjs does not reference AudioWorklet')
```

The self-test synthesizes all signals itself. For `MediaElementSource`, it builds a WAV `Blob` URL.

- [ ] **Step 2: Run to verify failure.** `node --test art/tools/chain.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement `chain.mjs`, `chain.json`, `chain-selftest.html`, `chrome-harness.mjs`.** Room tone: seeded `mulberry32` white noise, cascaded one-pole high and low passes at `lowHz` and `highHz`, a wrap crossfade over the final 100 ms for the seam, drift as a sine with a whole number of cycles per loop, normalized to `rmsDb`. Compute it in JS so the buffer is deterministic and adds no live nodes.

- [ ] **Step 4: Run tests.** Expected: all PASS. If a tolerance fails, fix the chain, never the tolerance. A failure that shows a spec number is unachievable goes back to the spec with a written reason.

- [ ] **Step 5: Commit.** `git add art/voice art/tools/chrome-harness.mjs art/tools/chain.test.mjs && git commit -m "Add paper-radio voice chain and room tone"`

### Task 3: Measurement and clip index

**Files:**
- Create: `art/tools/analyze-voice.mjs`
- Test: `art/tools/analyze-voice.test.mjs`

**Interfaces:**
- Consumes: the Task 1 manifest and plan shape.
- Produces, exported:
  - `measurePitch(samples: Float32Array, sampleRate: number): { f0Median, f0P10, f0P90, voicedSeconds } | { f0Median: null, voicedSeconds }`, using the spec's estimator (70–500 Hz, 40 ms frames, 10 ms hop, peak ≥ 0.6, level > −45 dBFS, under 0.75 s voiced gives null).
  - `trimForVoice(lufsValues: number[]): number`, `-20 - mean(lufs)`.
  - `buildClipIndex(plan, ledger, measurements): ClipIndex`.
- `art/runs/005-voice-audition/measurements.json`: `{ [jobId]: { durationSeconds, lufs, peakDb, centroidHz, f0Median, f0P10, f0P90, voicedSeconds } }`. Contains no preset names.
- `art/runs/005-voice-audition/clips.json`: `{ roles: [{ id, name, options: ['A','B','C'], beats: [{ id, label, promptText, clips: { A: { file, trimDb } } }] }], sweep: [{ label: 'Voice 1', file, f0Median, trimDb }] }`. Sorted by `f0Median`, nulls last. No preset names, so the page stays blind. Retakes replace their `retakeOf` clip.
- CLI: `node art/tools/analyze-voice.mjs <runDir>`. Decodes with `ffmpeg` to 16 kHz mono float PCM, `ebur128` for loudness, `aspectralstats=measure=centroid` for centroid. Reports any clip that is silent, shorter than 1 s, or peaking at 0 dBFS.

- [ ] **Step 1: Write failing tests:**

```js
test('220 Hz sine measures within 3 Hz of 220')
test('white noise gives f0Median null')
test('under 0.75 s of voice gives f0Median null')
test('trimForVoice averages across clips: [-18, -22] gives 0')
test('buildClipIndex: retake replaces original; no preset name appears anywhere in the JSON; sweep sorted by pitch with nulls last')
```

- [ ] **Step 2: Run to verify failure.** `node --test art/tools/analyze-voice.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run tests.** Expected: all PASS.

- [ ] **Step 5: Commit.** `git add art/tools/analyze-voice.mjs art/tools/analyze-voice.test.mjs && git commit -m "Add voice clip measurement and index"`

### Task 4: The LAN server

**Files:**
- Create: `art/tools/serve-audition.mjs`
- Test: `art/tools/serve-audition.test.mjs`

**Interfaces:**
- Produces, exported:
  - `auditionHandler({ voiceDir, runDir }) → (req, res) => void`. Serves exactly: `/` (`audition.html`), `/chain.mjs`, `/chain.json`, `/run/clips.json`, `/run/<name>.(mp3|wav|ogg)` where `<name>` matches `^[a-z0-9A-Z-]+$`. Everything else is 404. Audio responses honor `Range` requests.
  - `readClientPort(portsFilePath: string): number`, throws if the file or `CLIENT_PORT` is missing.
- CLI: `node art/tools/serve-audition.mjs [art/runs/005-voice-audition]`. Binds `0.0.0.0`, prints the `http://<lan-ip>:<CLIENT_PORT>/` URLs.

- [ ] **Step 1: Write failing tests:**

```js
test('serves the allowlisted paths with correct content types')
test('404s /.env.local, /plan.json, /run/plan.json, /run/manifest.jsonl, /../AGENTS.md, and %2e%2e-encoded traversal')
test('Range request returns 206 with the right bytes')
test('readClientPort reads the value and throws when missing, with no default')
```

- [ ] **Step 2: Run to verify failure.** `node --test art/tools/serve-audition.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run tests.** Expected: all PASS.

- [ ] **Step 5: Commit.** `git add art/tools/serve-audition.mjs art/tools/serve-audition.test.mjs && git commit -m "Add LAN audition server"`

### Task 5: The listening page

**Files:**
- Create: `art/voice/audition.html`
- Test: `art/tools/audition-page.test.mjs`

**Interfaces:**
- Consumes: `chain.mjs`, `chain.json`, `clips.json` shape from Task 3, `auditionHandler` from Task 4, `runInChrome` from Task 2.
- Produces: the page. When loaded with `?selftest=1`, it runs its scripted clicks and POSTs results to `/__result`.

The page: one section per role (Pip, Wick, Moth, Narrator) and an "All voices" view. Per role, a grid with beats as rows and A, B, C as columns. Top controls: chain setting (Dry, Soft paper, Warm radio, Old wireless, default Warm radio) and room tone (on by default). Beat row shows the spoken line without tags. Tap targets at least 96 px CSS tall. Colors and fonts follow `docs/design-language.md`: Page `#F6EFE2`, Ink `#2B2420`, Lamp gold `#D4A23E` for the playing state, Fraunces and Atkinson Hyperlegible Next with serif and sans fallbacks, loaded from Google Fonts. The playing state is shown by label and position as well as by color. A chain or room-tone change applies to the clip playing without restarting it. One `AudioContext`, created on first tap and resumed on every tap. Each cell plays `source → createVoiceChain(ctx, settings, { trimDb }) → destination`, or `source → trim → destination` for Dry.

- [ ] **Step 1: Write the failing test,** using a temp run folder with synthesized short WAVs, a `clips.json` that references one missing file, and the real handler:

```js
test('renders each role with its beats and A, B, C options, and a sweep-only index shows just All voices')
test('tapping a cell plays; tapping another stops the first')
test('rapid taps with reversed decode order (first clip delayed by the test server) leave only the last tap audible')
test('a missing clip and a corrupt clip each mark their cell unavailable, and other cells still play')
test('a tap calls resume when the context is suspended')   // does not prove first-tap activation or headset removal: those are user checks in Task 8
test('switching chain setting while playing reroutes without restarting the source')
test('no preset names or plan fields appear in the DOM')
```

- [ ] **Step 2: Run to verify failure.** `node --test art/tools/audition-page.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement `audition.html`.**

- [ ] **Step 4: Run tests.** Expected: all PASS.

- [ ] **Step 5: View the page in a phone-width and a desktop-width headless screenshot** and fix anything that overflows or is unreadable.

- [ ] **Step 6: Commit.** `git add art/voice/audition.html art/tools/audition-page.test.mjs && git commit -m "Add audition listening page"`

### Task 6: Plan and sweep round — paid, needs approval

**Files:**
- Create: `art/tools/build-voice-plan.mjs`, `art/runs/005-voice-audition/plan.json`, `results.md` at close
- Modified by the run: `manifest.jsonl`, `sweep-*.mp3`, `measurements.json`, `clips.json`

**Interfaces:**
- Produces: `build-voice-plan.mjs <runDir> [shortlist.json]`. Writes `plan.json` with one `jobs` array: `phase: 'sweep'` jobs for all 49 presets using the spec's sweep line (ids like `sweep-Maya`), and, given `shortlist.json` (`{ pip: ['Preset','Preset','Preset'], wick: [...], moth: [...], narrator: [...] }`), `phase: 'audition'` jobs from the spec's line table with ids like `pip-a-fear`. Seed: FNV-1a 32-bit of the job id. The script copies the spec's text exactly and calls `validatePlan`.

- [ ] **Step 1: Write the builder and generate the plan.** Fill in `question`, `why`, `decideBy`, `learnEvenIfRejected`, `reusableOutput` from the spec. Test in `art/tools/build-voice-plan.test.mjs`: `test('builder output passes validatePlan; sweep has 49 jobs; a 12-voice shortlist adds 33 audition jobs')`.

- [ ] **Step 2: Dry run.** `node art/tools/generate-voice.mjs art/runs/005-voice-audition --phase sweep`. Expected: 49 jobs, estimated 49 credits, cap 100, no network. Commit plan.

- [ ] **Step 3: Question card (AskUserQuestion).** Show: 49 credits ($0.49) for the sweep, total plan 82, cap 100, and ask the user to confirm the other workspace isn't generating and won't start until this round reports back. **Stop here until approved.**

- [ ] **Step 4: Run with spend,** with the key read from the environment file: `node --env-file=.env.local art/tools/generate-voice.mjs art/runs/005-voice-audition --phase sweep --spend`, in the background. **Wait for its completion notice.** If it stops at the polling limit, rerun until every task is resolved. If it stops for money or `ambiguous`, go to the user. If it can't continue, close the run per the terminal outcomes in Task 8.

- [ ] **Step 5: Measure.** `node art/tools/analyze-voice.mjs art/runs/005-voice-audition`. Expected: 49 entries, a list of any broken clips. Start the server in the background so the sweep can be heard if the user asks at the next card, and confirm the page loads a sweep-only `clips.json`.

- [ ] **Step 6: Commit.** `git add art/runs/005-voice-audition art/tools/build-voice-plan.mjs && git commit -m "Run voice sweep for run 005"`

### Task 7: Shortlist and audition round — paid, needs approval

**Files:**
- Create: `art/runs/005-voice-audition/shortlist.json`, `art/tools/calibrate-chain.mjs`
- Modify: `plan.json`, `art/voice/chain.json` (only `outputDb`)

**Interfaces:**
- Consumes: `measurements.json`, the plan, `runInChrome`, `createVoiceChain`.
- Produces: `calibrate-chain.mjs <runDir>`, exporting `calibrate({ clips, chainJson, runInChrome }) → { settings: { [name]: { outputDb, rmsDeltaDb, peakDb, peakLimited } } }`. It renders every round 2 clip with its trim through each setting in Chrome and writes each setting's `outputDb` so RMS is within 1 dB of Dry. Peak wins: if matching would pass −1 dBFS, it lowers `outputDb` to the ceiling and sets `peakLimited`, for reporting in `results.md`. Test in `art/tools/calibrate-chain.test.mjs` with synthesized clips, including a transient burst: `test('calibrated settings match Dry within 1 dB')`, `test('a peak conflict lowers outputDb, sets peakLimited and keeps peaks at or below -1 dBFS')`.

- [ ] **Step 1: Choose the shortlist** per the spec: three per role, far apart in the measurements, no preset in two roles unless a pitch band forces it. Record the reasoning in `shortlist.json` under a `why` key.

- [ ] **Step 2: Regenerate the plan and dry run.** `node art/tools/build-voice-plan.mjs art/runs/005-voice-audition art/runs/005-voice-audition/shortlist.json`, then dry-run `--phase audition`. Expected: 33 jobs, 33 credits, committed 49 from the sweep, within the cap.

- [ ] **Step 3: Question card.** Describe the shortlist by role and measured character, **with no preset names**, and 33 credits, with the exclusive-window confirmation and the option to hear the sweep first. **Stop here until approved.**

- [ ] **Step 4: Run with spend,** as in Task 6 Step 4, with `--phase audition`. Wait for its completion notice.

- [ ] **Step 5: Measure, retake any objectively broken clip** as a new job with `retakeOf`, within the cap and within this approved window, then run the rebuild sequence: generate, `analyze-voice.mjs`, `calibrate-chain.mjs`. Always run all three, in that order, after any new clip, so `clips.json`, trims and calibration can't go stale.

- [ ] **Step 6: Commit.** `git add art/runs/005-voice-audition art/voice/chain.json art/tools/calibrate-chain.mjs && git commit -m "Run voice audition round for run 005"`

### Task 8: The user's audition, then close the run

**Files:**
- Create: `art/cast/<who>/voice.json` for each cast role, `art/runs/005-voice-audition/approved-cast.json`, `art/runs/005-voice-audition/results.md`
- Modify: `art/README.md` (durable learnings only), `docs/v2-ideas.md` only if a new idea came up

- [ ] **Step 1: Start the server in the background** and confirm the page responds. Command: `node art/tools/serve-audition.mjs art/runs/005-voice-audition`.

- [ ] **Step 2: Hand it over.** Give the user the LAN URL and exactly what to do in Quest Browser, including the first-tap and headset-off-and-on checks the browser tests can't prove. Ask for the cast with question cards, one role at a time, with options A, B, C and "try something else". Then one card for the chain setting, with room tone on or off, shared across the cast (the user can answer per role through Other).

- [ ] **Step 3: If anything is rejected,** propose the next step. A paid retake needs a new question card and a new exclusive window, even within the cap. Then run the rebuild sequence from Task 7 Step 5 and go back to Step 2. Anything past the cap needs a new approved plan.

**Terminal outcomes,** each of which goes to Step 4 and Step 5 with whatever exists: full cast; partial cast; total rejection; user cancels; cap reached or `ambiguous` unresolved. Closure never depends on reaching a full cast.

- [ ] **Step 4: Record the cast.** Write `art/cast/<who>/voice.json` for each cast role: `{ role, presetId, model, settings, chain: { name, ...fullSettings }, roomTone: { enabled, ...fullSettings }, trimDb, run, referenceTakes: [files] }`. Write `approved-cast.json` with the same data for all roles, the name mapping, and the SHA-256 of `art/voice/chain.mjs`.

- [ ] **Step 5: Close the run.** Write `results.md` for whichever outcome happened, covering everything the spec's closure paragraph lists, including the 1-credit-minimum consequence for the pre-render estimate. Add durable learnings to `art/README.md`. Check that the manifest's committed credits are within the cap and that each round's cost matches its `balance` events, and report any difference.

- [ ] **Step 6: Run all tests.** `node --test art/tools/*.test.mjs`. Expected: all PASS. Stop the server.

- [ ] **Step 7: Commit.** `git add art/cast art/runs/005-voice-audition art/README.md && git commit -m "Close voice audition run 005"`

## Codex review of this plan, and what I did about it

| Finding | Decision |
|---|---|
| Commits violate `AGENTS.md` | **Rejected.** The user explicitly asked for commits on this branch as we go, which is what that rule is waiting for. Took the useful part: a SHA-256 identifies the chain instead of a git revision |
| Paid processes have no completion gate | **Fixed** |
| Later retakes bypass the exclusive window | **Fixed** |
| Builder and generator schema disagree | **Fixed,** and the builder's output is tested |
| Frequency test contradicts the chain's flat gain | **Fixed,** by measuring relative to 1 kHz. The peak ceiling moved to the calibrated configuration, in the spec too |
| Final approval doesn't capture chain and room tone | **Fixed,** with a card and a fuller snapshot |
| Retakes don't reach the page | **Fixed** with one rebuild sequence |
| No path for cancellation or rejection | **Fixed** with terminal outcomes |
| "Hear the sweep first" before the server exists | **Fixed** |
| 1-credit reservation vs 2,500-character jobs | **Fixed** by enforcing the approved 200-character limit |
| Deleted files lose recovery | **Fixed** by re-reading the task id, with no POST |
| Calibration doesn't check peaks | **Fixed,** with a test and a rule for conflicts |
| Browser tests overclaim | **Fixed.** Corrupt and reversed-order fixtures added, and first-tap and headset-off moved to the user's checks |
| Approval card reveals the blind mapping | **Fixed** |
| Failed attempts lack an immutable record | **Fixed** with the request in `intent` and per-round balance events |
| Too much tooling before a first listen | **Rejected.** Nothing can be heard until a paid round is approved, and the page needs the chain to be worth hearing, so reordering wouldn't save the user any time. The money safeguards can't be cut, and the Chrome harness is shared across three tasks |

The fixes tighten the run's safety and its tests. The design's shape is unchanged, so no third review was run.
