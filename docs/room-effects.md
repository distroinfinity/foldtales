# Room effects: the catalogue

Effects that act on the reader's real room, for **upcoming chapters** and the **AI Storyteller**. Chapter 1 is only where they're tested (through review links): we don't add them to chapter 1 (owner, Nov 15: "we don't have to fill everything in chapter 1 and bloat it"). Kept up to date as effects are built, changed and approved.

Design and build plan: `docs/plans/2026-11-15-room-comes-alive.md`. Headset feedback: `docs/playtest-notes.md`.

## How to use one

**In a chapter beat** (episode JSON), one stage action:

```json
{ "do": "room", "withPrev": false, "effect": "rain", "what": null, "at": null }
{ "do": "room", "withPrev": false, "effect": "hunt", "what": "object:kite", "at": "room:couch" }
```

**In the AI Storyteller**, one step, written just before the line that talks about it:

```
ROOM rain
ROOM hunt object:kite at:couch
```

- `effect` is from the list below. `what` is an object on stage, only for effects that use one. `at` is a place in the reader's room: `room:couch` means the best couch or the next best place; `room:couch-2` one exact place (only the Storyteller sees those ids).
- A lasting effect stays on until its "off" (or `clear`, `day`, `sea-off`). Timings are in contracts (`ROOM_EFFECTS`).
- Only the room the book is in counts: Space Setup can hold the whole home, and other rooms are ignored.
- The Storyteller is offered only effects that are built, whose art has loaded, and that this room supports. If it names one that can't happen, its next line is dropped too, so it never promises what doesn't show.
- To try one on chapter 1: `?room=<effect>` on a review build, or several in turn, `?room=rain,fireflies`. Use **Start from the beginning**, so it doesn't overlap the chapter's own ending.

## The effects

| Effect | What the reader sees | Calls | Needs | Status |
|---|---|---|---|---|
| **Shadow play** | Giant soft shadows of the cast on the real wall behind the book, inside a warm pool of light, moving as they move | `shadows`, `shadows-off` | A wall (or a stand-in wall ahead) | ✅ Approved in the headset, Nov 15: "looking great" |
| **Fireflies** | Small yellow-green glows rise off the page, each breathing light on its own slow rhythm, wandering about the room; they drift near a hand held up | `fireflies`, `fireflies-off` | Nothing | ✅ Approved, Nov 15: "Fireflies are great" (after the breathing rework) |
| **A window onto the story** | The night shore (moon, sky, the headland's rocks, the sea) with the book's beam sweeping across it from outside. On a real window in view it fills the glass; otherwise a painted opening on the wall you face, beside the book | `window`, `window-off`; `at:window`, `at:wall`, `at:door` | Nothing (falls back to a wall) | ✅ Approved: "this was good". The last change (no lighthouse in the view) checked in the emulator, not yet in the headset |
| **Rain** | Fine painted rain falling all round the room, hiding behind real furniture and walls; rain sound all round, thunder heard from the window's side | `rain`, `thunder`, `clear` | Nothing | ✅ Rain approved, Nov 15: "rain is okay". Walls stay unlit: no lightning light, no extra dark. The lit wall patches it showed were a bug (the room's depth hid the dim), fixed. Real rain and thunder sound from run 016 (two rolls, taken in turn), checked in the emulator; mix not yet heard on the Quest |
| **Treasure hunt** | Something slips off the page and hides in the room; the lighthouse beam sweeps the room and stops on it, in a warm pool. Walk over and pinch it, or look at it and pinch to call it back | `hunt` with `what` and `at` | An object on stage | 🔶 Built. Emulator, Nov 15: the beam found the kite on the armchair in a warm pool; walked over, pinched it, it came to the hand and the beam and pool went out. Not yet walked in the headset |
| **Night sky** | The room goes dark, paper stars and a crescent moon come out on the ceiling, a constellation lights up, a shooting star crosses with a soft shimmer | `night-sky`, `stars-lantern`, `stars-kite`, `stars-fox`, `shooting-star`, `day` | A ceiling (or a stand-in dome) | ✅ Approved in the headset, Nov 15: "roof stars and moon look good" |
| **Snow** | A ring of painted snow drifting down round the reader, settling softly on the real table, couch and bed (not the floor) | `snow`, `clear` | Nothing (settles on what Space Setup knows) | ✅ Approved in the headset, Nov 15: "snow in itself, we have cracked. Ring of snow, it looks very nice" |
| **Fog** | Soft painted wisps low along the floor | `fog`, `clear` | Nothing | ❌ Dropped (Nov 15): the owner didn't like it on the floor, and the code is removed. `fog` stays in contracts, unbuilt, so it's never offered; the painted wisps stay in `art/room-fx/weather/` for a later try |
| **The sea** | Moonlit painted water in a ring round the reader on the floor (thinning away at their feet), slow swells, a lacy foam edge; real furniture stands out of it; the tide rises and falls; a paper boat sails a slow circle | `sea`, `tide-in`, `tide-out`, `boat`, `sea-off` | Nothing (the floor's height is always known) | ✅ Approved in the headset, Nov 15: "boat and sea look nice". The sea's wash from run 016 plays while it's in |
| **Gulls** | Painted gulls fly in and perch on a shelf or the couch | `gulls`, `gulls-off`; `at:` a place | Nothing | ✅ Seen in the headset, Nov 15: "fine for now". Built. Emulator, Nov 15: two gulls fly in from the window flapping, settle side by side on the far table, call now and then (run 016), fly off the way they came. |
| **The bottle** | A bottle with a message washes up at the reader's feet; handed to a character, the message is read | `bottle` with `what` | An object with the `message` tag | ✅ Seen in the headset, Nov 15: "fine for now". Built. Emulator, Nov 15: washes up by your feet with a splash and clink, leans back toward you so it reads from above, and can be picked up and handed over (it was left ungrabbable at first; fixed). The Storyteller reads the message from the object's description. |

## Rules the app keeps, whatever a chapter or the Storyteller asks

- One weather at a time. Rain and snow put the stars away.
- At most two big effects at once (weather, night sky, sea, window); a third ends the oldest with a fade.
- Closing the book pauses the room too; pause, resume and "Read it again" bring effects back exactly, with nothing saved.
- A real window is used only if it's in view (within about 70° either side of the way the reader faces the book); never behind them.

## Cost on the Quest 3

Measured from headset telemetry. The look bar asks for at least 72 fps.

| Effect | Median fps | Low | Draw calls | Notes |
|---|---|---|---|---|
| (chapter 1, no room effect) | 85–90 | 78–80 | 80–134 | From earlier sessions |
| Rain | 80–82 | 60–65 | about 146 | Nov 15, before the rain was made finer |
