# Run 016: room sound, results

**Closed Nov 15, 2026.** Spent **61 credits** of the 85 cap, the plan's estimate exactly (balance 109,995 before, 109,934 after; no other session spent during the run). Room effects' art and sound together: 107 of the 180 the owner approved. The owner said to go ahead ("build these … move forward"). We went straight to Runway rather than CC0 libraries: one tool, one ledger, no licence checks, and the price was known.

## What we made

`finish.mjs` rebuilds the finished clips from this folder, for no credits. In `art/sound/room/`, named in the show manifest:

| Clip | Show sound | Length | Level | Where it plays |
|---|---|---|---|---|
| `rain-loop.mp3` | `rain` | 19.4 s loop | average -29 dB | Rain all round you, easing in and out with the storm |
| `sea-loop.mp3` | `sea` | 19.4 s loop | average -28.5 dB | The sea's wash while it's in |
| `thunder-a.mp3`, `thunder-b.mp3` | `thunder` (taken in turn) | 6 s | peak -5 dB | Each `thunder`, from the window's side |
| `gull-calls.mp3` | `gull` | 3 s | peak -12 dB | Gulls arriving, every 9 to 15 s while perched, and leaving |
| `bottle-wash.mp3` | `wash` | 3 s | peak -10 dB | The bottle washing up at your feet |
| `shooting-star.mp3` | `shooting` | 3 s | peak -17 dB | A shooting star crossing the ceiling |

## What we learned

- **`loop: true` gives beds that nearly loop.** Rain's first and last 0.3 s were within 1 dB; the sea's were 3.6 dB apart. `finish.mjs` crossfades the last 0.6 s into the first anyway, so both repeat without a seam (19.4 s each).
- **Levels varied by 16 dB again** (rain came back at -44 dB average, the sea at -28), so the finishing pass stays a must, as run 009 found.
- **Room sound names are client-side** (`SoundCall` in `client/src/sound/engine.ts`), so new effect sounds need no contracts change.
- Checked in the emulator: all seven decode and play at the right moments. **Still to judge on the Quest's speakers:** the mix under the narrator.
