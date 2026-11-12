# Run 009: M1 sound, results

**Closed Nov 12, 2026.** Spent **21 credits** of the 50 cap, exactly the estimate. The balance went from 111,979 to 111,958, matching the ledger, so nothing else was spending.

## What was made

| Clip | Use | Seconds | Credits | Peak before → finished |
|---|---|---|---|---|
| book-thump | the book lands on the wash | 1 | 1 | -5.6 → -6 dB |
| cover-open | the cover swings and settles | 2 | 2 | -19.7 → -8 dB |
| card-fold-a, b, c | a card stands up (taken in turn) | 1 each | 3 | -9.1, -16.8, -23.0 → -10 dB |
| gust | the wind before the light goes out | 2 | 2 | -0.3 → -7 dB |
| lantern-puff | the flame goes out | 1 | 1 | -5.8 → -8 dB |
| wash-bloom | the found surface blooms (also the beam's chime) | 2 | 2 | -7.7 → -11 dB |
| card-tap, paper-rustle, felt-thud | pinch, hold, ribbon | 1 each | 3 | levelled to -14, -15, -11 dB |
| ember-hum | the searching hum, looped | 5 | 5 | -8.4 → -26 dB |
| narrator-opening | "Down where lost things wash ashore, a small fox kept a small light." (Wanda) | 5.04 | 1 | -3.6 → -3 dB, then the chain |
| pip-gasp | Pip is frightened (Mabel) | 1.52 | 1 | -11.4 → -8 dB, then the chain |

Finished clips are in `art/sound/m1/`, made by `finish.sh` (a gain to each role's peak, mono, MP3). The raw takes stay here.

## How it was run

`art/tools/generate-sound.mjs`, a sibling of the voice tool. It reuses `runPhase` from `generate-voice.mjs`, which gained optional `endpoint`, `buildRequest`, `estimate` and `validate` hooks. Their defaults are the voice tool's own behaviour, and its 27 tests still pass. Sound effects use `POST /v1/sound_effect` with `eleven_text_to_sound_v2`, a `duration` and a `loop` flag.

## What we learned

- **Runway's sound effects cost exactly a credit per requested second,** with a 1-credit minimum, and return exactly the requested length.
- **Levels vary by more than 20 dB between prompts.** "Quiet" and "close" in a prompt don't control output level. Plan a finishing pass for every sound run.
- **A short prepared line ran 27% longer than its caption estimate** (5.04 s against 3.96 s). Time beats from the rendered voice, never the estimate.
- **Still to judge by ear on the Quest's speakers:** the whole mix, and whether the gasp reads as Pip.
