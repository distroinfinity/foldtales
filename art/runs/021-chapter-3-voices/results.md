# Run 021: chapter 3's voices (batch 1 of 2)

**Nov 16, 2026. Batch 1 closed:** the narrator's, Pip's and Wick's 72 lines across both versions of the chapter (the hunt in your room and its page version, ruling 3), 72 credits by this run's own ledger (`manifest.jsonl`, 1 credit a line), cap 90. Nothing failed or was lost. **Batch 2** (Thimble's 9 lines) waits for lane B to choose her voice (`art/cast/thimble/voice.json`, runs 017/019); `build_plan.mjs --defer-unchosen` wrote this batch without them.

- **Finished** with `finish.mjs` (run 010's levelling: narrator -3 dB peak, Pip and Wick -5) into `art/sound/ch3/`, and written into the show manifest's `voiceLines` under each line's contract id, with its measured length.
- **Lengths:** real lines ran 0.91–2.22× the caption estimate, median 1.21× (just under run 010's 1.3×). The longest ratios are short lines with natural pauses ("A kite? At my age?", "Wick? Wick! Where are you?"); `silencedetect` finds no padding at their ends.
- **Re-timed from the real voices** (Thimble's lines still at 1.3×), room version: quick turn 1:32–1:34, end 5:08–5:10; zero input 1:52–1:54, 6:15–6:17; late wrong 2:10–2:12, 6:46–6:48; holding 2:04–2:06, 6:35–6:37. Page version: ends 5:05–6:55, the same turns.
- **Still to judge:** the owner, by ear on the Quest's speakers, in the headset session after lane C's emulator pass. Retakes come out of the 9 credits left after batch 2.
