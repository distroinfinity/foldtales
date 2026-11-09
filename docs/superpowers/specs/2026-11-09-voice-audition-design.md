# Voice audition: design

Ticket 4, the voice audition workstream. Run 005. Written 2026-11-09, ahead of the Nov 18 deadline.

## What this is for

The user casts Pip, Wick, Moth and the narrator by ear, on the Quest's speakers. The target is radio-play warmth: expressive voices through a warm paper-radio treatment over room tone, cozy and not robotic (`docs/design-language.md`, Sound).

Done means the user has a small set of options grouped by character, has picked a cast or said what to try next, the chosen voices and chain are recorded so later work reproduces them exactly, and run 005 is closed with results and costs.

**Assumptions, for the reviewer to challenge:** the narrator is in scope because the PRD lists narrator with character voices for every episode, and the director's bridges are narrator lines. Wick is male (the ticket says "his sight"). Pip's and Moth's gender are open, so the shortlist can go either way.

## What official sources say, and what changes because of it

Checked on 2026-11-09 against `@runwayml/sdk` 4.24.0 types, `docs.dev.runwayml.com/api.md`, `/guides/pricing.md`, `/guides/models/`, `/assets/outputs/`, and ElevenLabs' Eleven v4 and best-practices pages.

| Fact | Consequence |
|---|---|
| `eleven_v4` is `POST /v1/text_to_speech`, up to 2,500 characters, 5 credits per 1,000 characters, **minimum 1 credit per generation** | Any line of 200 characters or fewer costs exactly 1 credit. Credits scale with number of calls, not characters. The 15-credits-an-episode estimate in `technical-design.md` is low for short lines. Noted in `results.md` for the pre-render ticket, not fixed here |
| Voice is `{ type: 'runway-preset', presetId }` with 49 names. No custom voice type on this model | The cast must come from the 49 presets. Voice design and cloning are not available on `eleven_v4` through Runway |
| Runway publishes no description, sample or preview for any preset | We can't choose well from names alone (a preset is literally called `Pip`, which says nothing). The audition needs a first round that hears every preset |
| Parameters on `eleven_v4`: `stability`, `similarityBoost`, `seed` (not guaranteed), `languageCode`, `style`, `speed`, `useSpeakerBoost`, `previousText`, `nextText`. ElevenLabs says v4 has only Stability and Similarity sliders | Use only `stability`, `similarityBoost`, `seed`, `languageCode`. Leave the others unset. Hold these constant across every job so the only difference is the voice |
| Audio tags go in the script: `[whispers]`, `[sighs]`, `[exhales]`, `[gulps]`, `[laughs]`, `[curious]`, `[excited]`, `[mischievously]`, `[snorts]`, `[pause]`, `[low, gravelly voice]`. A tag can occasionally come out as a sound effect | Lines use these, and we favor tags that describe voice over ones that could read as sounds |
| `task.cost.credits` reports the final charge per task | The cap uses real per-task costs. Balance differences are unreliable while another workspace spends on the same account |
| Output URLs expire in 24–48 hours. Output format and sample rate aren't documented | Download at once and sniff the format from the bytes |

## The audition: two rounds, one run

**Round 1, sweep.** One line through all 49 presets: 49 credits. The line asks for a whisper, a startle and a laugh, so a voice that can't act is exposed by the same line that measures it:

> `[whispers] Is somebody there? ... Oh! [laughs] It's only you. You gave me such a fright, I nearly dropped the lantern.`

A local analysis (free, using `ffmpeg`) measures each clip: median pitch, pitch range, spectral centroid, loudness and duration.

**Round 2, shortlist.** I pick **three voices per role** from those measurements, as far apart from each other as the role allows, so the options differ audibly. No preset appears in two roles unless a pitch band forces it.

| Role | Measured guide, a starting point only |
|---|---|
| Pip | Median pitch about 190–300 Hz, wide range, young and light |
| Wick | Median pitch under about 140 Hz, dark timbre |
| Moth | Highest pitch and widest range |
| Narrator | About 110–220 Hz, mid-range, steady but warm |

Honest limit: measurements can tell age and register, but not coziness. I can't hear the clips. So all 49 sweep clips stay available on the page as an "All voices" view, at no extra cost, for "try this one instead" answers.

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

**Settings, held fixed:** `eleven_v4`, `stability` 0.4 (lower allows broader acting, per Runway's parameter description), `similarityBoost` 0.75, `languageCode` `en`, and a fixed `seed` per job, stored in `plan.json`. Stability is the obvious next thing to vary, but the art rules say change one thing at a time, so it's a follow-up only if the user asks.

**Cost.** Sweep 49, plus round 2 at 3 voices × 11 lines = 33. Total **82 credits ($0.82)**, with a **cap of 100**. The spare 18 pays for retakes of clips that come back broken.

**Retakes.** Only for clips that are objectively broken: silent, truncated, or heavily clipped. If the user hears a spoken tag or a bad read, that's reported and retaken within the cap, not silently dropped. The retake is a new job id, so the original stays on record.

## The voice chain

**The chain runs at playback, in Web Audio, using native nodes only.** Clips stay dry on disk. That's the only way pre-rendered and live lines can go through the same code, and changing the chain later needs no re-render and costs no credits. No `AudioWorklet`: it needs a secure context, which a LAN preview over plain HTTP doesn't have, and it isn't needed for this signal path.

Per voice, between the source and the spatial panner:

```
source → trim → highpass → low-mid warmth (peaking) → paper presence (peaking)
       → lowpass → soft saturation (WaveShaper, 2× oversampled) → compressor → output
```

`createVoiceChain(ctx, settings)` returns `{ input, output }`. It takes any `BaseAudioContext`, so it runs in `AudioContext` or `OfflineAudioContext`, and any source node connects to `input`: `AudioBufferSource` for prepared lines, `MediaElementSource` or scheduled chunks for streamed live lines. `output` goes to the caller's panner or destination. It knows nothing about characters.

**Room tone.** `createRoomTone(ctx, settings)` is a procedural bed: seeded noise, band-limited to where a room's air and the Quest's speakers overlap, with slow amplitude drift, looped seamlessly. It costs no credits, works with no network, and doesn't depend on any later foley asset. One bed is shared under all voices, routed around the voice chain.

**Three settings to compare, free to toggle on the page:** Soft paper (light), Warm radio (the default), Old wireless (strongest). Plus Dry, so the user can hear what the chain contributes. The Quest's speakers reportedly roll off low end early (a vendor write-up, unconfirmed by Meta), so warmth is placed in the low-mids and the highpass sits around 130 Hz rather than boosting bass the speakers can't play. Values are starting points chosen by reasoning and checked by measured response. Only the user's ears on the headset settle them.

**Per-voice trim.** `trimDb` brings each voice to a common level, measured across all of that voice's clips, so whispers stay quieter than shouts within a voice. Trims are computed locally and recorded for the chosen cast. They work the same way on live lines, where per-line normalization isn't possible. The compressor handles the rest.

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
2. **Refuses to start if the balance moves.** It reads the balance twice about 20 seconds apart, and stops if it changed, since that suggests the other workspace is generating. This is a backstop only. The real gate is asking the user first.
3. **Enforces the cap from real costs.** It sums `task.cost.credits` from the manifest across both rounds, and stops before any job that would pass the cap.
4. **Records the task before polling.** It writes a `started` line with the task id before waiting. A rerun polls that task rather than paying again. Run 003 lost 5 credits to a dropped connection, and this closes that hole even after a crash.
5. **Skips finished jobs,** and treats any 4xx rejection as a stop, since it means the plan is wrong. A 429 waits and retries, uncharged.
6. **Logs each clip** to the manifest: prompt, preset, model, settings, seed, task id, real credits, seconds and format. Seconds also give free first data for the later latency question.
7. **Reads the key only from the environment,** and never prints it.

**Approval.** Before the sweep, a question card shows the plan and estimated credits, and asks the user to confirm the other workspace isn't generating. Before round 2, the same check, with the shortlist. No paid call happens without both.

## Recording the cast

After the pick:

- `art/cast/<who>/voice.json` for each of the four roles, matching the `rig.json` precedent: preset, model, settings, seed, chain name, `trimDb`, and the run and clip it came from. The narrator gets `art/cast/narrator/voice.json`.
- `art/voice/chain.json` holds the approved chain settings, read by `art/voice/chain.mjs`.
- Run closes with `results.md`: the picks, the name mapping, costs, what we learned, and what the pre-render ticket needs to know. Durable learnings go in the `art/README.md` list.

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
| Script safety | `node --test` with a fake `fetch`: dry run makes no calls, cap stops before overspending, a resumed run doesn't pay twice, a 4xx stops, the balance guard stops, and no key reaches output |
| Chain's response | In headless Chrome: a multi-tone signal through each setting, checking lows and highs are cut as designed and hot input doesn't clip |
| Chain is the same on all sources | In headless Chrome: the same clip through `OfflineAudioContext`, a live `AudioContext` with `AudioBufferSource`, `MediaElementSource`, and scheduled chunks. Band levels must agree within 1.5 dB |
| Room tone | Same seed gives the same buffer, and the loop seam has no click |
| Server | Only allowlisted paths respond. `.env.local` and traversal attempts return 404 |
| Paid output | Every clip exists, is non-silent, and the manifest's cost sums match the cap |
| Does it sound right | **Only the user can check this, on the headset** |

## Not in this ticket

Pre-rendering the full line set, music, foley, Talk, speech to text, live replies, the Runway latency test, and any change to `client`, `backend` or `contracts`. New ideas go in `docs/v2-ideas.md`.

## Risks

- **All 49 presets may sound adult and un-cozy for Pip.** If so, the user says so, and the next step is ElevenLabs directly for a designed voice. That needs a new paid account with an estimate first, so it stays the user's call.
- **Short lines may act worse than long ones.** The product's lines are short too, so the audition is honest about that.
- **Audio tags might get spoken aloud.** The user's ears catch it, and the spare credits pay for a retake.
- **Quest Browser and LAN HTTP.** Web Audio works without a secure context, and the design avoids anything that needs one. The Mac's firewall may need to allow Node. Both get checked when the user opens the page.
