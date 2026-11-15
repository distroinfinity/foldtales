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
| **A window onto the story** | The night shore (moon, sky, the headland's rocks, the sea) with the book's beam sweeping across it from outside. On a real window in view it fills the glass; otherwise a painted opening on the wall you face, beside the book | `window`, `window-off`; `at:window`, `at:wall`, `at:door` | Nothing (falls back to a wall) | ✅ Approved: "this was good". Last change (no lighthouse in the view) not yet seen |
| **Rain** | Fine painted rain falling all round the room, hiding behind real furniture and walls; rain sound all round, thunder heard from the window's side | `rain`, `thunder`, `clear` | Nothing | 🔶 Rain approved, Nov 15: "rain is okay". Walls stay unlit by the owner's choice (no lightning light, no extra dark). Sound is a stand-in until sound run 016 |
| **Treasure hunt** | Something slips off the page and hides in the room; the lighthouse beam sweeps the room and stops on it, in a warm pool. Walk over and pinch it, or look at it and pinch to call it back | `hunt` with `what` and `at` | An object on stage | 🔶 Built and checked in the emulator; held for a session where the reader walks about |
| **Night sky** | The room goes dark, paper stars and a crescent moon come out on the ceiling, a constellation lights up, a shooting star crosses | `night-sky`, `stars-lantern`, `stars-kite`, `stars-fox`, `shooting-star`, `day` | A ceiling (or a stand-in dome) | ✅ Approved in the headset, Nov 15: "roof stars and moon look good" |
| **Snow** | Painted snow falls and settles on the real table, couch and floor | `snow`, `clear` | Nothing (settles on what Space Setup knows) | ⏳ Art ready (run 014), not built yet |
| **Fog** | Soft painted fog rolls along the floor | `fog`, `clear` | Nothing | ⏳ Art ready (run 014), not built yet |
| **The sea** | Watercolour waves across the floor, lapping at the couch; the tide rises and falls; a paper boat sails off the page | `sea`, `tide-in`, `tide-out`, `boat`, `sea-off` | A floor (or a stand-in) | ⏳ Needs art run 015 and sound |
| **Gulls** | Painted gulls fly in and perch on a shelf or the couch | `gulls`, `gulls-off`; `at:` a place | Nothing | ⏳ Needs art run 015 |
| **The bottle** | A bottle with a message washes up at the reader's feet; handed to a character, the message is read | `bottle` with `what` | An object with the `message` tag | ⏳ Needs art run 015 |

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
