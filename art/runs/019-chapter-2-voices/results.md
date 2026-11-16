# Run 019 results

**Closed Nov 16, 2026.** Spent **83 credits** of the 89 cap, by the voice tool's ledger: 79 lines at 1 credit each and two sounds (2 s each). Lane B's runs 017-019 together: 130 of 150.

**Reopened Nov 16 (sprint master approved, owner's headset note on where chapter 2 opens):** 2 more credits, **85 of 89** in all, lane B **132 of 150**. The opening narration now says where we are ("The next night, up at the very top of the tall lighthouse, the lamp burned bright, and a new keeper stood on its gallery. A very small one, in a very big coat.", 10.9 s) and Pip adds "Look how far down the sea is, Wick!" (2.5 s), both in the run's voices; `build_plan.mjs` wrote the two jobs (the plan's `voiceJobs` now lists only them; the first 79 are in git history and the ledger), `generate-sound.mjs --spend` voiced them, `finish.mjs` levelled them. The old opening line's clip is gone from `art/sound/ch2/` and the manifest (its raw take stays here). Re-timed: every path still inside 5-7 minutes, the longest (a late wrong gift after a carried crossing) 6:57.

## What was made

- Chapter 2's 79 new lines in run 005's voices (narrator Wanda, Pip Mabel, Wick Arjun) and Thimble's, Runway preset "Pip" (run 005's moth-c, chosen by measurement; `art/cast/thimble/voice.json`). Four more lines reuse chapter 1's.
- Two sounds: `small-splash` (Thimble lands, the tide's heave) and `nib-scratch` (Pip writes in the log), as show sounds `splash` and `nib`.
- Finished by `finish.mjs` (run 010's levelling) into `art/sound/ch2/`, each line in the manifest under its contract line id with its measured length.

## Checks

- `node art/runs/019-chapter-2-voices/build_plan.mjs --check`: 83 playable lines (scene beats and bridges), 83 voiced.
- `tools/chapter-timings.ts` from the rendered voice: quick 5:10-5:14 (first turn 1:38-1:42), zero input 6:09-6:13, late wrong gift 6:44-6:48, holding 6:29-6:33. Every path inside 5-7 minutes; the real lines ran a little shorter than the 1.3x estimate.

## Still to judge

By ear in lane B's emulator pass, then the owner's: Thimble's voice beside Pip's, and the nib's level (it was recorded quiet, -39.7 dB, and raised 23.7 dB).
