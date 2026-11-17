# Lane F1, book and page polish: evidence (Nov 17–18)

Emulator shots: IWSDK emulator, Quest 3 profile, seated (eyes at 1.2 m), hand input, the head brought over the
caption band; the show clock is frozen on the moment named. Page shots: Chromium on the Mac with the headset's
layout (`?page=landing`), each door state forced with `?door=`.

## Captions fit the book

| Moment | Before | After |
|---|---|---|
| Ch 2, the letter (140 characters), seated | `before-ch2-letter.jpg`: two lines fill the band to its edge | `after-ch2-letter-1.jpg`: first chunk, two lines with room |
| Ch 2, the letter on the smallest book (`bookscale=0.6`) | `before-ch2-letter-small.jpg`: three lines, "light," falls off the book | `after-ch2-letter-small.jpg`: one line at a time |
| Storyteller hint "Your turn … Powered by Runway." | `before-storyteller-hint.jpg`: three lines over the stage's edge | `after-storyteller-hint.jpg`: shown in two chunks, in turn |
| Ch 1, the opening (126) | `before-ch1-opening.jpg` | `after-ch1-opening.jpg` |
| Ch 3, the morning (119) | `before-ch3-morning.jpg` | `after-ch3-morning.jpg` |

Every line in all three chapters, the Storyteller's recorded lines and a 240-character live line are checked
at four sizes in `tests/caption-fit.test.ts`.

## The hand-over cue

- `after-cue-ch1-lantern.jpg`: chapter 1's first ask; the lantern wears the gold rim (strength 0.77, a first-timer).
- `after-cue-ch1-gap.jpg`: the gap; the drawer opens and the ladder, the sock and the key wear the same rim (0.79 each), right and funny answers alike.
- `after-cue-ch1-gap-practised.jpg`: the same moment for a reader who has handed six things over: the rim settles to a faint hint (0.30).

## The door cards

`before-landing-*` and `after-landing-*` at 1440×900 and 1280×670 (signed out, signed in, offline) and 390×844.
Measured at 1440, signed out: before, the chapter button was 64 px tall at y 600 and the Storyteller's 56 px at y 626; after, both are 64 × 223 px at y 620, in every state, and at 1280×670 both are 64 × 214 px at y 520.
