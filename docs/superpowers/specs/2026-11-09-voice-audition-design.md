# Voice audition: design

Ticket 4, the voice audition workstream. Run 005. Written 2026-11-09, ahead of the Nov 18 deadline.

## What this is for

The user casts Pip, Wick, Moth and the narrator by ear, on the Quest's speakers. The target is radio-play warmth: expressive voices through a warm paper-radio treatment over room tone, cozy and not robotic (`docs/design-language.md`, Sound).

Done means the user has a small set of options grouped by character, has picked a cast or said what to try next, the chosen voices and chain are recorded so later work reproduces them exactly, and run 005 is closed with results and costs.

**Assumptions, for the reviewer to challenge:** the narrator is in scope because the PRD lists narrator with character voices for every episode, and the director's bridges are narrator lines. Wick is male (the ticket says "his sight"). Pip's and Moth's gender are open, so the shortlist can go either way.

## What official sources say, and what changes because of it

Checked on 2026-11-09 against `@runwayml/sdk` 4.24.0 types, `docs.dev.runwayml.com/api.md`, `/guides/pricing.md`, `/guides/models/`, `/assets/outputs/`, Runway's Eleven v4 guide (`dev.runwayml.com/learn/eleven-v4-api`), and ElevenLabs' Eleven v4 and best-practices pages.

| Fact | Consequence |
|---|---|
| `eleven_v4` is `POST /v1/text_to_speech`, up to 2,500 characters, 5 credits per 1,000 characters, rounded up to a whole credit, **minimum 1 credit per generation**. Failed requests are refunded, except `SAFETY.INPUT.*` failures | Any line of 200 characters or fewer costs exactly 1 credit. Credits scale with number of calls, not characters. The 15-credits-an-episode estimate in `technical-design.md` is low for short lines. Noted in `results.md` for the pre-render ticket, not fixed here |
| Voice is `{ type: 'runway-preset', presetId }` with 49 names. No custom voice type on this model | The cast must come from the 49 presets. Voice design and cloning are not available on `eleven_v4` through Runway |
| Runway publishes no description of any preset. Its Eleven v4 guide plays samples of 4 (Maya, Bernard, Ella, James), with no gender, age, accent or tone given | Names alone can't cast 45 unheard voices (a preset is literally called `Pip`, which says nothing). The audition needs a first round that covers the rest |
| Parameters on `eleven_v4`: `stability`, `similarityBoost`, `seed` (not guaranteed), `languageCode`, `style`, `speed`, `useSpeakerBoost`, `previousText`, `nextText`. ElevenLabs says v4 has only Stability and Similarity sliders | Use only `stability`, `similarityBoost`, `seed`, `languageCode`. Leave the others unset. Hold these constant across every job so the only difference is the voice |
| Audio tags go in the script: `[whispers]`, `[sighs]`, `[exhales]`, `[gulps]`, `[laughs]`, `[curious]`, `[excited]`, `[mischievously]`, `[snorts]`, `[pause]`, `[low, gravelly voice]`. A tag can occasionally come out as a sound effect | Lines use these, and we favor tags that describe voice over ones that could read as sounds |
| A finished task reports `cost.credits`, but the API reference doesn't mark `cost` as required | The cap uses real per-task costs, since balance differences are unreliable while another workspace spends on the same account. A missing cost stops the run rather than counting as zero |
| Output is MP3, at a URL that expires in 24–48 hours. Sample rate isn't documented | Download at once and read the format from the file |
| Audio tags must sit next to words. A script of only tags is rejected. `<break>` tags are rejected, and `[pause]` is the replacement | Every line obeys this |

## The audition: two rounds, one run

**Round 1, sweep.** One line through all 49 presets: 49 credits, or $0.49. The sweep is justified because the alternative is casting 45 unheard voices from their names. The user isn't asked to listen to all 49. The line is mostly spoken aloud, because whispers carry no pitch to measure, and it still asks for a startle and a laugh so a voice that can't act gets exposed:

> `Is somebody there? ... Oh! [laughs] It's only you. You gave me such a fright, I nearly dropped the lantern.`

A local analysis (free, using `ffmpeg` to decode) measures each clip: median pitch and pitch range over voiced frames only, spectral centroid, loudness and duration. Pitch comes from normalized autocorrelation over 70–500 Hz on 40 ms frames with a 10 ms hop. A frame counts as voiced only if its autocorrelation peak is at least 0.6 and its level is above −45 dBFS. With under 0.75 s of voiced frames, the pitch reads `null` and the voice can only be shortlisted by hand.

**Round 2, shortlist.** I pick **three voices per role** from those measurements, as far apart from each other as the role allows, so the options differ audibly. No preset appears in two roles unless a pitch band forces it.

| Role | Measured guide, a starting point only |
|---|---|
| Pip | Median pitch about 190–300 Hz, wide range, young and light |
| Wick | Median pitch under about 140 Hz, dark timbre |
| Moth | Highest pitch and widest range |
| Narrator | About 110–220 Hz, mid-range, steady but warm |

Honest limit: measurements are supporting evidence for register only. They can't establish age, warmth or acting, and I can't hear the clips. So all 49 sweep clips stay on the page as an "All voices" view, sorted by measured pitch, for "try this one instead" answers. The approval card before round 2 lets the user listen to the sweep first if they want to. Round 2 costs 33 credits, so a shortlist miss is cheap to fix.

**Round 2 lines.** Every option in a role reads the same lines, each 200 characters or fewer so each costs 1 credit. Each line is its own clip, so the user compares the same acting beat across voices.

| Role | Beat | Line |
|---|---|---|
| Pip | Fear | `[whispers] Hello? ... It went out. It just... went out. [gulps] I don't like it when it's this dark.` |
| Pip | Relief | `[exhales] Oh... oh, thank you. [laughs] It's warm again. I wasn't scared. [curious] Well. Only a bit.` |
| Pip | Joke, and the wish | `One day I'll keep the lamp myself. [laughs] I just have to grow into the coat first.` |
| Wick | Grumble | `[sighs] Forty years I've kept this lamp, and not one soul has wiped their boots. Mind the step. No, the other step.` |
| Wick | Sight, kept gentle | `[low, gravelly voice] Read it to me, would you? ... The page is fine. It's the ink. They make the ink too faint these days.` |
| Wick | Gruff warmth | `[sighs] That moth's in the jam again. ... Good lamp, that. You did all right, young one.` |
| Moth | Bright! | `[excited] Oh! Ooh! Is that a light? Is it MY light? I'm coming, I'm coming, I'm... ow.` |
| Moth | Silly find | `[mischievously] I found you something! It's a button. Or a biscuit. [snorts] I licked it, and I'm still not sure.` |
| Moth | Sorry, not sorry | `Sorry! Sorry, sorry. I didn't mean to land in your soup. It was just so shiny. [laughs] Can I do it again?` |
| Narrator | Opening | `Everything lost in a house drifts, in the end, to the edge of the table. And at the edge of the table... there is a lighthouse.` |
| Narrator | Dry aside | `Now, Pip had been told, more than once, never to go out after dark. [pause] Pip had also been told not to sit in the jam.` |

**Settings, held fixed across every job:** `eleven_v4`, `stability` 0.4 (lower allows broader acting, per Runway's parameter description), `similarityBoost` 0.75, `languageCode` `en`. **Seeds differ per job:** each job has its own recorded seed, so a retake is a deliberate new take. Runway doesn't guarantee seeded reproduction, so **the accepted clip file is the reference take,** not the seed. Stability is the obvious next thing to vary, but the art rules say change one thing at a time, so it's a follow-up only if the user asks.

**Cost.** Sweep 49, plus round 2 at 3 voices × 11 lines = 33. Total **82 credits ($0.82)**, with a **cap of 100**. The spare 18 pays for retakes of clips that come back broken.

**Retakes.** Only for clips that are objectively broken: silent, truncated, or heavily clipped. If the user hears a spoken tag or a bad read, that's reported and retaken within the cap, not silently dropped. The retake is a new job id, so the original stays on record.

## The voice chain

**The chain runs at playback, in Web Audio, using native nodes only.** Clips stay dry on disk. That's the only way pre-rendered and live lines can go through the same code, and changing the chain later needs no re-render and costs no credits. No `AudioWorklet`: it needs a secure context, which a LAN preview over plain HTTP doesn't have, and it isn't needed for this signal path.

Per voice, between the source and the spatial panner (the chain's position before any panner is what lets later tickets spatialize each voice):

```
source → trim → highpass → low-mid warmth (peaking) → paper presence (peaking)
       → lowpass → soft saturation (WaveShaper, 2× oversampled) → compressor → output
```

`createVoiceChain(ctx, settings)` returns `{ input, output }`. It takes any `BaseAudioContext`, so it runs in `AudioContext` or `OfflineAudioContext`, and any source node connects to `input`: `AudioBufferSource` for prepared lines, `MediaElementSource` or scheduled chunks for streamed live lines. `output` goes to the caller's panner or destination. It knows nothing about characters.

**Room tone.** `createRoomTone(ctx, settings)` is a procedural bed: seeded noise, band-limited to 180–2,500 Hz where a room's air and the Quest's speakers overlap, a 12-second loop with drift of ±1.5 dB, level about −46 dBFS RMS, 26 dB under speech. It costs no credits, works with no network, and doesn't depend on any later foley asset. One bed is shared under all voices, routed around the voice chain.

**Three settings to compare, free to toggle on the page,** plus Dry so the user can hear what the chain contributes:

| Setting | Highpass | Warmth, 280 Hz, Q 0.9 | Presence, 1.8 kHz, Q 1.0 | Lowpass | Drive | Compressor threshold / ratio / attack / release |
|---|---|---|---|---|---|---|
| Soft paper | 110 Hz | +1.5 dB | +1 dB | 9 kHz | 1.2 | −20 dB / 2 / 10 ms / 150 ms |
| Warm radio (default) | 130 Hz | +2.5 dB | +2.5 dB | 6.5 kHz | 1.6 | −22 dB / 3 / 5 ms / 180 ms |
| Old wireless | 180 Hz | +1.5 dB | +4 dB | 4.2 kHz | 2.4 | −24 dB / 4 / 3 ms / 150 ms |

Saturation is a `tanh` curve at the given drive, normalized so a full-scale input still reaches full scale. The Quest's speakers reportedly roll off low end early (a vendor write-up, unconfirmed by Meta), so warmth sits in the low-mids and the highpass stays above the speakers' weak range, rather than boosting bass they can't play. These numbers are starting points. Only the user's ears on the headset settle them.

**Level matching, so louder doesn't win.** Each setting has a fixed `outputDb` in `chain.json`, calibrated over the round 2 clips so its level matches Dry to within 1 dB RMS. Web Audio's compressor adds its own makeup gain, and fixed calibration keeps that the same on live lines. Peaks stay at or below −1 dBFS on the calibrated settings. The ceiling wins if it conflicts with level matching.

**Per-voice trim.** `trimDb` brings each voice to a mean of −20 LUFS, measured with `ffmpeg`'s `ebur128` across all of that voice's clips, so whispers stay quieter than shouts within a voice. Trims are recorded for the chosen cast. They work the same way on live lines, where per-line normalization isn't possible. The compressor handles the rest.

## The listening page

A single static page, grouped by character, one role at a time.

- For each role, a row per line (the acting beat) and a column per voice. Tap a cell to play. Tapping another cell stops the first, so the same beat can be A/B'd without overlap.
- Voices are labeled **A, B, C** and preset names stay hidden, so a voice called `Pip` doesn't get an unfair advantage. The mapping is in `plan.json` and is revealed in `results.md` after the pick.
- Toggles: chain setting (Dry, Soft paper, Warm radio, Old wireless) and room tone on or off.
- An "All voices" view lists the sweep clips.
- Big tap targets, because it's used with hands in Quest Browser. The look follows the palette and fonts in `design-language.md`, but it isn't a product build and doesn't ship.

**Listening on the Quest.** A small static server reads `CLIENT_PORT` from `.env.ports` and serves only the page and run 005's audio on the LAN. The user opens `http://<mac-lan-ip>:<CLIENT_PORT>/` in Quest Browser and taps a clip. The 2D browser panel uses the same speakers as an immersive session. No USB, no agent action on the headset.

## The run, following `art/README.md`

Run folder: `art/runs/005-voice-audition/`, with `plan.json`, `manifest.jsonl`, the audio files, and `results.md`. Generated by a new script, `art/tools/generate-voice.mjs`. `art/tools/generate.mjs` is untouched.

The script:

1. **Dry run by default.** It prints jobs, character counts and estimated credits and makes no API call. It takes `--spend` to generate, and `--phase sweep|audition` to choose a round.
2. **Exclusive window, set by the user.** The approval card asks the user to confirm the other workspace isn't generating and won't start until this round reports back. That window is the real gate, since `art/tools/generate.mjs` can't be edited to coordinate. As a warning signal only, the script checks the balance before starting and after each job, and stops if it fell by more than this run's own recorded costs.
3. **Enforces the cap with reservations.** Every job must be 200 characters or fewer, so it costs exactly 1 credit. That's what makes a 1-credit reservation correct. Before each submission, committed spend is every attempt's real `cost.credits`, plus 1 credit reserved per attempt still unresolved or ambiguous. It stops before any job that would pass the cap. Every attempt counts, including failures, retakes and downloads that failed. A finished task with no reported cost stops the run.
4. **Cannot silently pay twice.** It writes an `intent` line before the POST, then a `started` line with the task id as soon as the response arrives, then polls through network dropouts. A rerun polls a `started` task rather than resubmitting. If a POST's outcome is unknown (a network error, or an `intent` with no `started` after a crash), the job is marked `ambiguous` and the run stops. Runway has no task-list endpoint to reconcile against, so the operator checks the balance and reruns with `--accept-lost <job>`, which counts 1 credit against the cap for that attempt. A succeeded task whose download failed retries only the download.
5. **Skips finished jobs,** and treats any 4xx rejection other than 429 as a stop, since it means the plan is wrong. A 429 waits and retries, uncharged.
6. **Logs each clip** to the manifest: prompt, preset, model, settings, seed, task id, real credits, seconds and format. Seconds also give free first data for the later latency question.
7. **Reads the key only from the environment,** and never prints it.

**Approval.** Before the sweep, a question card shows the plan and estimated credits, and asks for the exclusive window described above, covering the round and any retakes of broken clips made during it. Before round 2, the same card, describing the shortlist without preset names so the audition stays blind, plus the option to hear the sweep first. Any later paid retake needs its own card and a new window: spare cap isn't confirmation that the account is idle. No paid call happens without a card.

## Recording the cast

After the pick:

- `art/cast/<who>/voice.json` for each role that was cast, matching the `rig.json` precedent: preset, model, settings, the **complete chain settings copied in** (not a name), `trimDb`, and the run and accepted clip files, which are the reference takes. The narrator gets `art/cast/narrator/voice.json`.
- `art/runs/005-voice-audition/approved-cast.json` snapshots all of this, plus the room-tone settings and whether room tone was on, with a SHA-256 of `art/voice/chain.mjs`, so later edits can't change what was approved. The user confirms the chain setting and room tone by question card, because those choices live in the browser.
- `art/voice/chain.json` holds the chain settings for later work, read by `art/voice/chain.mjs`.

**The run closes whatever happens.** `results.md` is written if the user picks a full cast, picks only some roles, rejects everything, or if the run is cancelled or hits the cap. It holds the outcome, the picks and name mapping if any, reconciled costs including lost or failed attempts, which clips are reusable, what was rejected, what we learned, what the pre-render ticket needs to know, and the next proposed experiment if the cast isn't complete. Durable learnings go in the `art/README.md` list. Cast files are written only for roles actually cast.

## Files

| Path | Purpose |
|---|---|
| `art/tools/generate-voice.mjs` | Runs a planned voice job list |
| `art/tools/analyze-voice.mjs` | Free local measurements with `ffmpeg` |
| `art/tools/serve-audition.mjs` | LAN static server, allowlisted paths only |
| `art/voice/chain.mjs` | `createVoiceChain`, `createRoomTone` |
| `art/voice/chain.json` | Named chain settings |
| `art/voice/audition.html` | The listening page |
| `art/runs/005-voice-audition/` | Plan, manifest, clips, measurements, results |
| `art/cast/<who>/voice.json` | Chosen voice per role, after the pick |

`client`, `backend` and `contracts` are not touched. A later ticket imports or moves `chain.mjs`, which is plain ESM with no dependencies, so it needs no build step here.

## How it gets verified

| Check | How |
|---|---|
| Script safety | `node --test` with a fake `fetch`: dry run makes no calls, cap counts reservations and all attempts, a resumed run doesn't pay twice, an accepted POST whose response is lost stops as `ambiguous` and never resubmits, a missing cost stops, a 4xx stops, an unexplained balance drop stops, and no key reaches output |
| Chain's response | In headless Chrome: a low-level multi-tone signal through each setting. Relative to 1 kHz, it's within 2 dB at 60, 280, 1,800, 6,000 and 10,000 Hz of the sum of each filter's `getFrequencyResponse`. Measuring relative to 1 kHz is needed because saturation and the compressor add flat small-signal gain |
| Level match and peak | On the calibrated settings, over all round 2 clips with their trims: each setting's RMS is within 1 dB of Dry, and peaks are at or below −1 dBFS. If they conflict, the peak ceiling wins, and the level shortfall is reported in `results.md` |
| Chain is the same on all sources | In headless Chrome: the same clip through `OfflineAudioContext`, a live `AudioContext` with `AudioBufferSource`, `MediaElementSource`, and scheduled chunks. Band levels must agree within 1.5 dB |
| Room tone | Same seed gives the same buffer. RMS is −46 dBFS within 2 dB. The sample step across the loop seam is under 0.002 |
| Server | Only allowlisted paths respond. `.env.local` and traversal attempts return 404 |
| Paid output | Every clip exists and is non-silent, each decoded duration is over 1 s, and the manifest's attempts sum to no more than the cap |
| Does it sound right | **Only the user can check this, on the headset** |

## Not in this ticket

Pre-rendering the full line set, music, foley, Talk, speech to text, live replies, the Runway latency test, and any change to `client`, `backend` or `contracts`. New ideas go in `docs/v2-ideas.md`.

## Risks

- **All 49 presets may sound adult and un-cozy for Pip.** If so, the user says so, and the next step is ElevenLabs directly for a designed voice. That needs a new paid account with an estimate first, so it stays the user's call.
- **Short lines may act worse than long ones.** The product's lines are short too, so the audition is honest about that.
- **Audio tags might get spoken aloud.** The user's ears catch it, and the spare credits pay for a retake.
- **Quest Browser and LAN HTTP.** Web Audio works without a secure context, and the design avoids anything that needs one. The Mac's firewall may need to allow Node. Both get checked when the user opens the page.

## Codex review of this spec, and what I did about it

| Finding | Decision |
|---|---|
| P1: exclusivity checked only at startup | **Fixed.** Exclusive window confirmed by the user for the whole round, with a balance-drift check as a warning. A cross-workspace lock isn't possible because `generate.mjs` can't be edited |
| P1: a crash or lost response can still pay twice | **Fixed.** `intent` before the POST, ambiguous outcomes stop the run, reconciliation is explicit, and it's tested |
| P1: cap accounting incomplete, and `cost` is optional | **Fixed.** Reservations, every attempt counts, and a missing cost stops the run |
| P2: "no samples for any preset" is false, so the sweep isn't justified | **Partly right.** The claim is corrected: 4 of 49 have samples, with no descriptions. **Sweep kept,** because the 45 others would otherwise be cast from their names, and it costs $0.49. The user doesn't listen to all 49 unless they choose to |
| P2: pitch measurements can't carry casting; whisper has no pitch | **Mostly fixed.** The sweep line no longer whispers, voiced-frame rules are stated, and measurements are supporting evidence only. **Rejected:** making the user approve the shortlist by ear before round 2. It would cost their time to save at most 33 credits. The card before round 2 offers it as an option instead |
| P2: no numeric targets for chain and loudness | **Fixed.** Starting numbers, a −20 LUFS target, level matching, peak ceiling and test tolerances |
| P2: approved chain not immutable; seed policy unclear | **Fixed.** Cast files embed the full chain, `approved-cast.json` snapshots it with a git revision, seeds are per job, and the accepted clip is the reference take |
| P2: closure only covers success | **Fixed.** Closure is defined for every outcome |
