# Run 005 results: voice audition

**Status:** closed, with a full cast. The user delegated the casting ("Choose any voices... Anything that you like"), so the picks below came from measurements. **Nobody has heard these voices judged against each other,** so treat them as a good starting cast, not a decision made by ear. Every clip is kept, so swapping a voice later costs nothing: change the role's `voice.json`.

## The cast

| Role | Option | Preset | Trim | Why |
|---|---|---|---|---|
| Pip | A | Mabel | +5.5 dB | Warmest of the three (centroid about 3,130 Hz), with wide range across fear and relief |
| Wick | A | Arjun | +4.9 dB | Lowest and most continuously voiced (about 110–119 Hz). Ragnar was darker but much louder, which works against "gentle" |
| Moth | C | Pip (the preset) | 0 dB | Most consistently voiced and high (about 320–330 Hz). Xylar lost pitch entirely on one line, so it risks being unclear |
| Narrator | B | Wanda | +1.1 dB | Darkest and most continuous delivery (centroid about 2,530 Hz) |

Median pitches land near 115, 170, 230 and 325 Hz, so the four should sound clearly different. Treatment: **Warm radio** with **room tone on**, the design's default.

The shortlist's other options, by label: Pip B Kylie, C Elliot. Wick B Clint, C Ragnar. Moth A Xylar, B Ella. Narrator A Bernard, C Tom. The full map is in `approved-cast.json`. `art/cast/<who>/voice.json` holds each role's voice and complete chain settings, and its accepted clips are the reference takes, since Runway doesn't guarantee seeded reproduction.

## What it cost

**82 credits of a 100 cap ($0.82):** 49 for the sweep and 33 for the audition. No retakes, no failures and nothing paid twice. Every clip cost exactly 1 credit, as estimated.

| Round | Credits | Balance |
|---|---|---|
| Sweep, 49 clips | 49 | 112,226 to 112,177 |
| Audition, first 12 clips | 12 | 112,172 to 112,155, of which 5 were not ours |
| Audition, last 21 clips | 21 | 112,150 to 112,129 |

Another run spent 15 credits on the account during this run, in three 5-credit drops (one art sheet's worth each): between the two rounds, inside the audition's first part, and before its second part. The balance guard stopped the audition after 12 clips because of the one inside it. Nothing was lost. The user allowed parallel running for the rest, through a new `--allow-concurrent-spend` flag that keeps the cap and only turns the guard into a warning.

## What we learned

- **Credits follow the number of calls, not characters.** A line of 200 characters or fewer always costs 1 credit, so a script of about 60 short lines costs about 60 credits, not the 15 in `technical-design.md`. It's still cheap, but the pre-render ticket should budget per line.
- **Only presets are available on `eleven_v4`.** The closed list is 49 names. Voice design or cloning would mean ElevenLabs directly, on a separate paid account.
- **Runway describes none of its presets,** so names say nothing. A cheap sweep is the only way to know what's there.
- **Generation took about 5–6 seconds per clip** (sweep 4.9 s, audition 5.9 s, queued jobs). That's a first data point for the live-reply latency test, not an answer.
- **Output is MP3,** as Runway's guide says. Task links expire in 24–48 hours, so files must be saved at once.
- **Trims are large for some voices** (up to +5.9 dB) because whispered lines bring the average down. The chain's compressor and the peak ceiling handled that without clipping.

## The chain

`art/voice/chain.mjs` applies the paper-radio treatment at playback with native Web Audio only, so prepared and live lines share one code path. Its settings are in `art/voice/chain.json`, and `approved-cast.json` snapshots them with a hash of the code.

Calibration: each setting's level is within 0.05 dB of Dry on the audition clips, and all peaks are below −3 dBFS. No setting was peak-limited. On the listening page, Dry is also capped at −1 dBFS so it can't clip. For a few loud, peaky clips, Dry plays up to about 3 dB quieter than the treated settings, so in an A/B against Dry, judge tone, not loudness.

| Setting | outputDb | Peak |
|---|---|---|
| Soft paper | −4.2 | −3.5 dBFS |
| Warm radio | −4.5 | −5.1 dBFS |
| Old wireless | −4.5 | −7.1 dBFS |

## Still unproven

- **How the voices and chain actually sound.** Nobody has judged them by ear. The chain values are reasoned starting points, verified only as measured responses.
- **On the Quest:** the page opened in Quest Browser and the headset reached the server over USB. Playback, the first-tap unlock and resuming after taking the headset off were tested only on desktop Chrome, not confirmed in the headset.
- **Whether any audio tag was read aloud.** Only ears can catch that.

## Reuse

Everything in this folder stays. To listen later, run `node art/tools/serve-audition.mjs art/runs/005-voice-audition`, and either open the LAN address it prints, or, over USB, map this workspace's `CLIENT_PORT` from `.env.ports` with `adb reverse tcp:<port> tcp:<port>` and open `localhost:<port>` in Quest Browser. In run 005, the user asked the agent to open it on the headset. It used its own port's mapping, left the other workspace's mapping alone, and asked before opening because a WebXR session was running. The sweep's 49 voices are under "All voices" for "try this one instead".
