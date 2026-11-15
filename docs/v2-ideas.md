# Ideas for v2

Not in scope now. We build and use the frozen v1 first, then decide these from real play.

## Open questions from you

- **Are three fixed characters enough?** You weren't sure how much depth and how many interesting stories Pip, Wick and Moth can carry. Watch for episodes starting to feel the same.
- **Is the first five minutes constraining the product too much?** It shapes much of v1, because judges decide quickly and it has its own award. After submission, the product should be designed for the evening you come back, as well as the first time.

## From the owner, Nov 12 (after the first ticket 1 headset session)

- **A complete story, told in chapters.** Aim to finish one whole story with real chapters, then keep adding more detailed chapters and books, so it feels like an actual theater. v1's tickets 2 and 3 build the first episode and the next; anything past that goes here.

## Directions to consider

- **New characters that join for good.** Visitors who stay, instead of passing through.
- **New worlds.** Whole new settings and casts beyond the Lost and Found.
- **Stories you start from your own idea.** Spoken premises that aren't tied to the current world.
- **Characters invented live and fully jointed,** using the same two-sheet recipe, with automatic rigging.
- **Longer arcs across a series.** Relationships that change, and characters who grow or leave.
- **Live art,** if v1 play doesn't already bring it in.

## What v1 does to keep these cheap

Characters, objects and scene problems are data, not code, so a new cast or world shouldn't need the engine rewritten. A speaking character costs about 10 credits to prepare.

## From the AI Storyteller (Nov 15, ticket 3)

- **Show them something real.** Hold up a real mug, and a painted copy appears in the book. It depends on whether Quest Browser gives our page the passthrough camera inside XR, which hasn't been tested yet.
- **You're in the cast.** With consent, a sample of your voice makes "the Giant", who speaks your lines in your voice.
- **Characters on demand that really talk**: painted, rigged and voiced live. Asked about in session 2; the owner preferred room effects for now.
- **The satchel follows your account** onto other devices (stored on the backend; needs a storage route and a contracts PR).
- **A contents page of everything you've made,** printed in the book.
- **They remember you between evenings** in the Storyteller: your name, and what you asked for last time (chapter-end memory already exists for chapter 1).

## From the room effects plan, Nov 15

- **Ask for Space Setup from inside the book.** The browser can start Space Setup once per session (`initiateRoomCapture`). A reader with no Space Setup could be offered it before a room effect, instead of only getting fallbacks.
- **Match your real lamps.** Light estimation isn't offered by IWSDK today. If it comes, the room dim could follow how bright your room really is.

## Cut from v1, Nov 15 (the finish sprint)

- **Story Circle:** two headsets in one room, then remote (ticket 5, M5). Cut by the owner to finish the single-player product.
- **Talk in the written chapters:** at a chapter's asks (the lantern, the wick, the gap), say your idea instead of handing something over, such as "Pip, use your coat as a sail!", and Pip acts it out in voice. This is shape B in `docs/plans/2026-11-14-ai-mode-research.md`. Cut by the owner on Nov 15: the AI inside a written chapter didn't land in ticket 3's first session, the chapters are hands-only by design, and lanes B and C are building chapters 2 and 3. Worth trying once those exist. Your voice belongs to the AI Storyteller in v1.
- **Continue an unfinished AI story** on the same headset (cut by the sprint master, Nov 15, after Codex's review). It needs a committed playback checkpoint covering cast places, held things, light and room effects. A story is left as played-only, and paid work is never replayed while restoring.
- **Read your AI stories on the phone or desktop page** (cut, Nov 15). The stories are already on the account, so this is a page that reads them.
- **A SOUND step in the Storyteller** for live sound effects, such as the teapot's broken whistle. The `soundEffect` route exists, and is budgeted at zero until it's used.
- **Facebook Login,** once Meta business verification is done (app 1124471020437890 exists; its secret is on Railway).
