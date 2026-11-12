# Run 010: M2 sound, results

**Closed Nov 13, 2026.** Spent **109 credits** of the 120 cap, exactly the estimate: 26 for 17 foley clips (1 credit a second) and 83 for the episode's lines (1 credit a line). The balance read 111,719 at the start and 111,693 after the foley, matching the ledger, so nothing else was spending. The owner approved the run on Nov 13 (about 80 quoted, capped at 120); the episode grew to 83 lines while it was written, and the spend stayed under that cap.

## What was made

- **Every line of episode 1** in the run-005 voices: narrator (Wanda), Pip (Mabel), Wick (Arjun). Levelled to -3 dB (narrator) and -5 dB (characters) before the chain, mono MP3, in `art/sound/m2/`. The manifest's `voiceLines` holds each under the contract's line id with its real length, so every beat is timed by the voice.
- **Foley** for the new actions, levelled per clip (`finish.mjs`): the lantern's clink and flare, setting things down, the page turn, the kite, the ladder, the thread, the rope, the spark, the lamp, the satchel, the drawer, picking up, a pleased and a puzzled chime, reeds rustling in the dark, and a hop's landing.

`finish.mjs` rebuilds all of it from this folder and rewrites the manifest's entries.

## What we learned

- **Real lines run 29% longer than the caption estimate** across 83 lines (324 s against 251 s), matching run 009's single line. With real voices every path through the episode runs 5:52 to 6:44 (simulator), against 5:08 to 6:01 estimated. Write episodes against 1.3× the estimate.
- **Quiet prompts come back very quiet.** The chimes and the hop came back near -30 dB and needed +14 to +19 dB of gain. Level every clip; never trust the prompt's loudness.
- **Still to judge by ear on the Quest's speakers:** the three voices across a whole episode, and the mix.
