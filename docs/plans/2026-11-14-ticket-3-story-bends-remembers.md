# Ticket 3: the AI Storyteller (ends at M3)

**Status:** **Done, M3 signed off by the owner on Nov 15** (PR #9). Re-cut on Nov 14 after headset session 1, reviewed once by Codex (fourteen findings, all taken; see "Re-cut review log"), and approved by the owner the same day.

**What shipped (Nov 15):**
- The AI Storyteller: its own door on the landing, mic first, then straight in.
- A voiced, staging cast: Claude writes lines and stage steps, and ElevenLabs voices each line as it's written. The first voiced word comes about 2–3 s after a turn starts.
- Hold to talk: a paper button on the table, pressed with a fingertip or pinched.
- Anything you ask for is painted live (Runway, about 2 credits, about 25 s).
- The satchel keeps every painting on the device for later evenings, and the cast can bring kept things back by voice, without painting them again.
- In-story moderation, a guest's sign-in line (when accounts are on), and the wrist tag.
- The whole PR was reviewed by Codex on Nov 15: ten findings, all fixed.

**Not built here:**
- "Your room" moved to its own workstream, *Your room comes alive* (see `docs/sprint-plan.md`), which builds room effects for the chapters and the Storyteller.
- "Show them something real" (the camera) wasn't tried.
- "You're in the cast" (voice cloning) is later.

Both are in `docs/v2-ideas.md`.

**Not yet seen in the headset:** a kept painting coming back in the satchel on a later evening (built, typechecked and reviewed; the owner closed the ticket before trying it).

**Owner decisions on the build (Nov 14):** live voices are **ElevenLabs library voices** picked to be close to the cast, through the same voice chain (cloning the cast's own voices is a nice-to-have, later). Live painting may spend **100–150 Runway credits** in total "if that increases performance", each run planned first with its cap, with the shared balance checked before and after. AI Storyteller calls need sign-in once the product workspace's accounts land: a guest's 401 shows as "Sign in on the page outside the book", never as an error. The first scope (a director layered on the written chapters, chapter 2, Tonight's lost thing) is kept further down for the record.

## Re-cut after headset session 1 (Nov 14)

**What happened.** The director's lines spliced into chapter 1 didn't land: "If a story is already written and we try to interfere with it, it's not that fun … you can easily do that with an if-else … AI responses are just being read and not spoken aloud … my immersion is lost." The owner likes chapter 1 as authored. So the product is now **two ways**: **Tales from the Table's Edge**, the authored chapters (the owner writes more, in parallel), and the **AI Storyteller**, which this ticket builds (names from the product workspace). Research: `docs/plans/2026-11-14-ai-mode-research.md`. Concept: `docs/plans/2026-11-14-ai-storyteller.md`.

**Owner decisions (Nov 14):** all four pillars, "and as many creative and wow factors as we can bring with AI": live voiced cast that also stages the world; your real room in the story; show them something real; anything you imagine appears. "You're in the cast" and "they remember you" when they make it better, or later. Live voices and speech in through **ElevenLabs** (the owner's existing account; key to come). Not bound by the PRD's older rules where the vision has grown.

**What stays from the first scope:** the scheduler's time-box work (bridges, pacing, the wrong-try guard), the gap at night, the ladder's hand-over, the wrist tag, and chapter-end memory. The director is off for chapter 1 (review flag `?director=on`); its validator and backend planner are reused by the Storyteller.

### The AI Storyteller, as built

**An evening.** You open the AI Storyteller (from the landing page's second door, or the book). The book opens on the lamp spread with Pip, Wick and Moth waiting. They greet you out loud. You talk; they answer in their own voices and act. They move about, turn the page to the shore or the gap, change the light, light the lamp, sweep the beam over your room, open the drawer, hand each other things. Every so often they turn to you, and what you say decides what happens next. Show them a real thing, or ask for something that isn't there, and it arrives, painted in the book's style. Your couch, your table, your window are part of their world. When it winds down, the narrator closes it into a page.

| Unit | Does | Where |
|---|---|---|
| **Contracts (own PR, first)** | New routes: `storyTurn` (a stream of its own turn events, each line with its audio inline), `paintProp` (a job: a description and an optional camera frame in, a painted, cut-out object out later), `soundEffect` (a short sound for a new thing). The turn's request carries the stage as it is (set, who stands where, objects, light), the room (labelled planes as simple positions), what was heard or done, and the evening so far. Coordinated with the product workspace's auth PR: one after the other, `CONTRACT_VERSION` bumped once each | `contracts/` |
| **Backend: the storyteller** | Sonnet runs the evening as an improvising director with the stage library as its only vocabulary: who may move where, what can be placed, cues, light, page turns between the three sets, the drawer, room marks. Streams lines as they're written, so the first can be voiced before the rest exists. Its own action policy (below), stricter than "anything" and wider than the director's talk-only rules | `backend/src/storyteller/` |
| **Backend: voices and ears** | ElevenLabs Flash voices each line in the speaker's voice as it's written, and the turn stream carries it (key in the backend's environment). The speech token route issues a short-lived token for ElevenLabs' realtime speech to text, so the microphone streams from the headset without the key | `backend/src/voice/` |
| **The cast's live voices** | ElevenLabs library voices picked to be close to Pip, Wick, Moth and the narrator, played through the same voice chain (owner, Nov 14). Clones of the cast's own voices are a later nice-to-have | `art/voice/live.json` |
| **Live stage** | A live scheduler with the same shape as the authored one, so the runtime, puppets, book, objects, light and beam work unchanged: beats arrive from the turn stream, each is played only once its lines are voiced, and between turns the cast idles and listens (never silent for long: small acting, room tone). Page turns move to whichever set the story asks for | `client/src/storyteller/` |
| **Listening** | While the Storyteller is open the cast listens, with a paper ear lit on the book. Speech ends, a character turns to you with a small "hm?", and the turn starts (about 1.5 s to the first voiced word). The cast's own voices are kept out of the microphone (echo cancellation, and listening pauses while they speak; you can cut in by pinching anyone) | `client/src/storyteller/` |
| **Anything appears** | When the story needs something that isn't in the library, Moth flies off the page and the backend paints it in the book's style (Runway `seedream5_flash`, about 2 credits, under 30 s), cuts it out on flat paper, checks it, and Moth brings it back. A short sound is made for it. Capped per evening; if it fails, Moth "couldn't find it" | `backend/src/storyteller/paint.ts`, client objects |
| **Show them something real** | Hold a real thing up to the book. If the Quest's browser gives us the camera (it reports one to our page; to be proven first), a frame goes to Claude's vision, which names it in the story's terms ("the Giant's cup"), and it's painted in as above | `client/src/storyteller/camera.ts` |
| **Your room** | The Quest's Space Setup planes (table, couch, wall, window, with positions) become places the story can name and go to: room marks the director can use, Moth flying to your window, Pip hopping off the book onto your table to look over its edge | `client/src/stage/`, the turn request |
| **Entry and exit** | The landing's "AI Storyteller" door enters straight in (`EnterTarget` from the product workspace's seam); `libraryState()` in `progress.ts` tells the landing it's available. The wrist tag stops it (pause, start again, put the book away) | `client/src/index.ts`, `client/src/show/progress.ts` |

**Not bound by:** the old rule that a story never waits on AI. In the Storyteller the cast *is* waiting for you, so a turn may take a second or two, always covered by listening and thinking acting, never by silence or a spinner.

### Order of work, with gates

**The three-day acceptance target** is the core evening, done properly: contracts, entry, voiced turns, bounded staging, interruption and failure recovery. The wow pillars come in behind it, each opened only when its own test passes, so a pillar that can't be proven in time is left out rather than shipped half-working.

1. **Contracts PR** (merged first, after the product workspace's auth PR or before it, one version bump each). `storyTurn` is a stream of its own event type, not `ReplyChunk`: `line` (id, speaker, text, mood, the line's audio inline as base64 MP3 with its real duration), `stage` (a batch of stage actions), `turn-to-you` (the cast waits for your answer), `done`, `error`. Lines are synthesised on the backend, so no raw-audio route is needed. `paintProp` is a job: it returns a job id at once, and a second call collects the result, so the 8 s request deadline holds. `ROUTE_NAMES`, the HTTP client, mocks and backend mounting change together. Every new route is classed as an AI route in the guard, with per-evening caps on turns, characters voiced, paintings and listening minutes.
2. **The core evening (Nov 15).**
   - A **Storyteller action policy**, separate from the director's: talk, emote, move, place and give within the library, light, music, page turns to any of the three sets, the drawer, the lamp and beam cues. It's checked against the stage as it is (who's on this spread, which objects exist, marks on this set).
   - **The runtime takes an injected scheduler.** Today it builds its own. The live scheduler supports jumps to any set (a turn to a set that isn't next), cast that stays where it was placed, and a `give` handler (one paw to another).
   - **Live lines in the sound engine:** a decoded clip is registered under its line id and played through the same voice chain, so beats are timed by real audio. A beat plays its first line as soon as that line is voiced, not after all of them.
   - **Turn state machine with generations:** listening, then thinking, then performing, then listening. Pinching anyone, or "wait!", starts a new generation, and everything from older generations (late transcripts, queued audio, actions) is dropped. The microphone stops sending while the cast speaks, plus a short tail. The commit is measured from the end of speech, with the speech-to-text silence threshold tuned down from its 1.5 s default.
   - **The microphone's lifecycle:** permission asked on the landing page before XR (the first prompt inside XR has ended the session twice), a fresh capture per listen, stopped on pause, headset off, the wrist tag and session end. If permission is denied, "Tell them" falls back to the wrist tag's choices.
   - **Moderation and privacy:** what you said is checked (Haiku) before the turn, and every line before it's voiced; off-tone becomes an in-story redirect. A first-use disclosure (cloud voice) and a mute on the wrist tag. Raw audio is never stored, and neither are detailed room shapes.
   - **Measured:** speech end to first voiced word, p50 and p95, against a 1.5 s target, with a bounded timeout and a spoken "hm, let me think" retry.
   - Then the emulator (typed "heard" lines), and **headset session 2: talk to them.**
3. **Gated wow (Nov 16), each behind its own test:**
   - **Anything appears:** painted props go in once a planned art run (plan, cap, ledger, as every run) proves the recipe: flat paper, measurable checks (alpha coverage, bounds, size, texture budget), and textures uploaded before Moth reveals them. Objects gain a runtime registration path (definition, texture, mesh, shadow, interaction, persistence, disposal). You judge the first ones in the headset.
   - **Show them something real:** only if a real passthrough frame arrives inside our immersive session with ordinary permissions. Meta has an open [investigation](https://developers.meta.com/vr/support/investigations/1557993751977106/) where only the avatar camera shows up; an ADB workaround is never a judge's requirement. Otherwise it becomes "tell them about something", painted the same way. Images are sent only after an explicit yes.
   - **Your room:** a room registry kept from Space Setup (couches, windows and vertical planes too, which placement throws away today), with labels and world positions, and a world-space actor layer so a character can leave the folding book layers. It starts with Moth, who flies, and Pip looking out at your room; walking onto the table comes after.
   - **Headset session 3.**
4. **Finish (Nov 17):** entry from the landing (`EnterTarget`, `libraryState()` with a mode in progress), the wrist tag in the headset, "they remember you" if time allows, the PR review, **sign-off**.

### How it's checked

- `pnpm test` stays green; chapter 1 unchanged (the director stays off there).
- Scripted evenings against the real backend: a set of spoken lines in, checked for voice coverage, valid staging, no repeated line, no stall over 4 s without acting or sound, time to first voiced word.
- Emulator: a typed "heard" line in place of the microphone, the turn played out on the stage, page turns, a painted prop arriving.
- Headset: talk to them, show them something, ask for something that isn't there.

### Risks

| Risk | If it happens |
|---|---|
| The turn takes too long and the pause feels dead | Haiku for the first line while Sonnet plans the rest; a character's "thinking" acting starts as soon as you stop |
| The cast hears itself | Listening pauses while they speak; pinch to cut in |
| Live paintings miss the look bar | Automatic checks reject them, and Moth "couldn't find it" |
| The camera isn't available to the browser | Ask for the thing by voice instead ("show" becomes "tell"); still painted in |
| The clones don't sound like the cast | ElevenLabs library voices picked by ear, with the same voice chain |

### Progress (Nov 14, evening)

- **Contracts v2 merged** (PR #10): `storyTurn`, `paintProp`/`paintResult`, `soundEffect`, counted as AI routes in the guard.
- **The core evening runs in the emulator** (`?storyteller=1`). The book opens on the lamp spread. Claude writes each turn as short steps (`SAY`, `MOVE`, `ENTER`, `ACT`, `GIVE`, `PLACE`, `LIGHT`, `CUE`, `SET`, `PAINT`, `LISTEN`), each checked against the stage library. Each line is voiced as soon as it's written and played in order on a live scheduler, and the page turns to whichever set the story goes to. The first line is ready about 1.9–2.4 s after the turn starts (before voicing time). "Pip is listening…" is printed on the caption band between turns.
- **Anything appears works end to end.** Run 013 (8 credits) proved the recipe. In the emulator, "a tiny blue teapot that lost its whistle" was painted in 27 s (2 credits), set on the page, and the story picked it up ("there's a hole where the whistle should be"). Caps: 6 paintings an evening, `PAINT_CREDIT_CAP` (100) in all.
- **The seam for the landing:** `libraryState()`, `LibraryState`, `EnterTarget` and `CHAPTERS` in `client/src/show/progress.ts`, with the product workspace's exact shapes. `run(world, show, resumeFrom, target)` in `index.ts` takes the landing's `EnterTarget`; `{ kind: 'storyteller' }` opens straight into the Storyteller.
- **Waiting on:** the owner's ElevenLabs key, for live voices and speech in. Until then lines are captions only and you type to them (in the emulator).
- **Still to do:** listening (ElevenLabs realtime speech to text, barge-in), choosing the library voices by ear, your room (planes with labels), the camera test, the wrist tag in the headset, a guest's sign-in line.

### Re-cut review log

Codex reviewed the re-cut once on Nov 14, read-only, against the code: no P0, twelve P1 and two P2. I checked each against the code: all real, all taken (in "Order of work, with gates").

1. **P1. The director's validator only allows talk** (`client/src/director/validate.ts`), which rules out the core feature. *Taken:* a separate Storyteller action policy, checked against the stage as it is.
2. **P1. The runtime builds its own scheduler and assumes adjacent spreads,** and has no `give` handler. *Taken:* the scheduler is injected, with jumps to any set, persistent placement and `give`.
3. **P1. Streams can only carry `ReplyChunk`,** and the backend sends JSON SSE, not audio. *Taken:* `storyTurn` has its own event type, with audio inline as base64.
4. **P1. The sound engine only plays prepared clips,** timed from the manifest. *Taken:* live clips are registered by line id and timed by their real length, and the first line plays as soon as it's voiced.
5. **P1. Objects can't be added at runtime,** and painting can't fit the 8 s deadline. *Taken:* runtime registration, and painting as a job.
6. **P1. Room planes are filtered to tables, without labels,** and actors live in the book's folding layers. *Taken:* a room registry and a world-space actor layer, starting with Moth.
7. **P1. Microphone permission and lifecycle are missing.** *Taken:* permission before XR, capture per listen, stopped on every pause, and a fallback when denied.
8. **P1. Interruptions need a turn state machine.** *Taken:* generations drop stale work; the microphone is gated through playback plus a tail.
9. **P1. New paid routes would skip the AI caps** (`backend/src/guard.ts` lists them by name). *Taken:* classed as AI routes, with per-evening caps. Told the product workspace, which is changing the guard for accounts.
10. **P1. No moderation of speech, vision or images, and no privacy controls.** *Taken:* moderation before the turn and before voicing, disclosure, mute, explicit camera consent, nothing raw stored.
11. **P1. A listed camera isn't a working camera,** per Meta's open investigation. *Taken:* gated on a real passthrough frame; "tell them" otherwise.
12. **P2. The 1.5 s promise has no budget** (the speech-to-text silence default alone is 1.5 s). *Taken:* measured p50/p95, threshold tuned, bounded timeout and retry.
13. **P2. Automatic checks can't establish the look bar.** *Taken:* a planned art run for the recipe, measurable checks, prewarmed textures, and the owner's judgment in the headset.
14. **P1. Three days miss integration and recovery work.** *Taken:* the core evening done properly is the acceptance target; each wow pillar is gated.

## The first scope (Nov 14, superseded by the re-cut above)

**Goal.** Answer the owner's words after the first headset session: "I don't see any AI in it. I think that's planned ahead." What you hand over, and when, now changes what the characters say and do, in ways nobody wrote ahead of time. Next evening, chapter 2 is really different because of chapter 1: what you kept comes back, and its owner comes looking. Turn off Wi-Fi mid-chapter and it still finishes. And from the end page you can pick a lost thing and get a brand-new story about it.

**Read with:** `docs/sprint-plan.md` (ticket 3), `docs/technical-design.md` (Objects, Director, Memory, AI pieces at a glance), `docs/design-language.md`, `docs/playtest-notes.md`, `docs/plans/2026-11-13-ticket-2-first-five-minutes.md`.

## Decisions made with the owner (Nov 14)

- **Chapter 2 is authored, with one new visitor.** I write it like chapter 1. Your keepsake turns up caught on the lamp gallery, and its owner, a new prepared visitor, comes for it. Paid runs: the visitor (about 10–15 credits) and chapter 2's voice lines (about 50–60 credits). **Cap 100 credits in total, and I can run them once each plan is written**, checking the shared balance before and after. The visitor is shown on the Mac before it goes in a build.
- **AI lines are captions only for now.** The speaker's mouth moves, with a soft murmur under the caption. Ticket 4 voices them live; the slot for a voice (`VoiceAsset.url`) already exists, so nothing here changes when it does.
- **Tonight's lost thing is picked in the book, from the drawer.** "Tonight's lost thing" is printed on the end page and the contents page. Pinch it, the drawer opens with the lost things, and you hand one to Pip.
- **No internet means stop and say so, plainly.** If a new story can't be written (no connection, or the AI fails), the book says it in plain words, like any app: "No internet connection. A new story needs the internet." (or "Couldn't write a new story just now. Try again.") with "Try again" and the chapters you have. No filler, no pretend story. A chapter already playing never needs the internet, so it always finishes.
- **Stop the show: a wrist tag** (owner, Nov 14, during headset session 1). A small painted paper tag on the back of your left wrist, like a watch, shown when you turn the back of that hand toward you (never palm-up, so it stays clear of Meta's reserved palm-pinch system gesture). Pinch or tap it with the other hand, and three paper tags fan out: "Pause" (then "Carry on"), "Start this chapter again", "Put the book away". **Put the book away** closes the book and ends the immersive session; the landing page then offers "Continue" from that exact moment. The ribbon stays as the one-touch pause, closing the book still pauses, and the Meta button still exits. Chapters, Tonight's lost thing and "Start the book over" stay on the contents page behind the sage tab. Researched first: the system gesture is reserved (VRC.Quest.Input.8) and the app pauses when the system asks (VRC.Quest.Functional.2), which it already does.
- **The API key** is in the main checkout's `.env.local` as `ANTHROPIC_API_KEY`, read by the backend only. Models as the technical design names them: `claude-sonnet-5-5` for planning beats and stories, `claude-haiku-5-5` for quick reactions. Both requests ask for the server's refusal fallback, so a declined request is retried on another model rather than failing.

## What changes in the headset

### 1. The director, in every chapter

The authored chapter stays the spine: it always plays, and it alone decides the physical story (who crosses how, the lamp, the beam). The director adds **short extra beats about what you just did**, written live, and only when they're ready.

- **Reactions.** Hand something over when nobody is asking for it, or something that doesn't answer what's being asked, and a line comes back about that exact thing and that moment. Give Wick the brass key on the lamp spread: "Hmph. I've not seen this since the door rusted shut." Give Pip the kite before the gap: he wonders what it's for. The authored take-and-examine plays at once, as now; the reaction follows within a few seconds. While a problem is open, a gift still picks its authored branch, whoever takes it (as in ticket 2: Wick passes the lantern on to Pip), and the reaction joins that branch.
- **Callbacks.** At quiet moments later in the chapter, a character remembers what you did: that you held the lantern until it woke up, that you picked Pip up and set him down on the shore, that you tried the sock before the ladder. The ending lines name it too ("Someone very big. With a ladder.").
- **What it can't do.** Director beats are talk and acting only: lines, looks, hops, examining. They can't move anyone, place anything, open the drawer, solve a problem or end the chapter, and they can only name characters and objects that are on this spread right now. The story's shape stays authored, so every resolution and the take-it-away test hold by construction. The time-box doesn't hold by itself: a director beat is admitted only if the chapter's projected end, along its slowest remaining path (including the holding grace still unspent), stays under 7 minutes.
- **Never waits.** A director beat plays only if it's ready and validated when its moment comes. Late, failed, capped or offline: it's dropped, and the authored story carries on without a gap. No bridge is ever needed for these, because nothing authored waits on them.

### 2. Memory, the satchel and chapter 2

- **What lasts.** When a chapter ends, the app records what lasts as canon: how the lantern came back (you, or Pip in the dark), how the gap was crossed, and what went into your satchel, each kept object with one sentence of history ("Carried Pip over the gap on the first night").
- **Your satchel carries across chapters.** What you kept in chapter 1 is in your satchel when chapter 2 opens, with its history, and you can hand it over again.
- **Chapter 2, "The one who came looking"** (outline below), changes for real with canon: which keepsake comes back, the recap, how Pip faces the dark, and how they cross the gap.
- **The contents page, behind the sage tab.** Pinch the sage tab and the story pauses, the pop-ups fold, and the spread shows the contents: every chapter you've played, every lost-thing story, "Tonight's lost thing", and "Start the book over" at the foot. Pinch a chapter to see its page: that chapter's own set with the cast where they ended and your keepsakes laid on it, and what lasts printed below. On a chapter's page: "Read it again", and beside each keepsake "Give it back", which undoes it, so the next chapter plays as if you'd never kept it. Pinch the sage tab again to go back to the story.
- **"Start the book over"** asks once ("Pinch again to forget everything"), then deletes the log, the satchel, the canon and the saved place, on the headset and on the server's mirror.
- **The landing page** follows: "Continue chapter 2" once chapter 1 is finished, "Read it again" choices on the contents page inside. **The landing page itself belongs to the product workspace** (branch `product-front-door`, which owns `client/index.html` and `client/src/landing/`; coordinator, Nov 14). This ticket doesn't edit those files. What the landing needs to know (the chapters, where you are, whether a new story is ready) comes from one small read-only function in `client/src/show/progress.ts`, `libraryState()`, which the product workspace reads. Requests from it about the contents page or naming come into this plan.
- **Survives reload.** Canon and satchel are derived from the event log in IndexedDB, mirrored to the backend's memory routes when it's reachable.

### 3. Tonight's lost thing

- Pinch "Tonight's lost thing" (on the end page or the contents page). The drawer opens with the lost things (kite, spool, ladder, sock, key, rope coil). Hand one to Pip.
- While the story is written (about 20–30 s), Pip and Wick turn it over and wonder whose it is (a few authored, voiced lines), then the page turns into the new story, with its title on the caption band. The request has its own 60 s deadline (the usual 8 s would cut it off); past that, it's the plain "Couldn't write a new story just now" with "Try again", and the late answer is ignored.
- **The story is written by Sonnet in a short story format** (title, three spreads, each with its lines, one problem written in tags with its branches), and **the backend builds the full spine from it**: page turns, entrances, asks, fallback and ignored beats. So the structure is always valid, and the AI's job is only the story. It plays on the existing sets with the existing cast, and ends with the lamp and the beam calling the lost thing home.
- Before it plays, the client checks it like any authored chapter: `checkSpine`, the director's validator on every line, and a run of the simulator (both the zero-input path and every branch must finish in 5–7 minutes with no repeat). If any check fails, it's treated as a failure: the plain message, and try again.
- Lines are captions only (decision above). A light moderation pass (Haiku) checks the generated words are PG and cozy before the story is offered.
- **Spoken premises** need speech, which is ticket 4. This ticket builds the object premise only; the spoken one joins with Talk.

### 4. Small things from session 2

- **The kite and spool left on the shore.** Pip says one new line as you arrive on the shore: "Take whatever you like. Lost things always come in handy." (one voice line in the chapter 2 run).
- **The ladder needed two tries.** I'll check the hand-over distance against the ladder's long body (it landed on the page first) and loosen it if it's measured to the wrong point.
- **The gap's daytime sky.** The gap set borrows the shore's day sky; it will borrow the shore's night sky from run 011 instead. No credits.
- **Turning the page by hand** hasn't been felt in the headset yet. First thing to ask about in session 1.

## Chapter 2, "The one who came looking" (outline for your approval)

The next evening. Same three spreads, about 6 minutes. The visitor is **Tansy, a small field mouse from the sewing basket upstairs, who loses everything she owns** (name and look are yours to change). Her things are what wash up in the Lost and Found, so every keepsake can be hers.

1. **The lamp, at dusk.** "Previously on…" (about 20 s, narrator, voiced lines picked by canon: how the lantern came back, how Pip crossed). Pip trims the new wick while Wick watches, and Wick calls him "keeper" again. Your keepsake from chapter 1 has drifted home overnight, the way lost things do, and is caught on the gallery railing. A small voice calls up the stairs: Tansy, who came looking for it. **Reach in, free it and hand it to her.** If nobody does, Moth tugs it loose. If you kept nothing, it's her odd sock that's caught. She's been losing things all week, and tonight she's lost too: she followed the light and can't find her way home. **Turn the page.**
2. **The shore, by night.** Pip leads Tansy home along the shore, braver than last night (lines change with whether he fetched the lantern himself). Tansy drops the key to her basket, and it rolls into the reeds. **Reach in for it** (anything that opens solves it; a wrong thing gets a funny failure). If nobody does, Moth goes for the shine. **Turn the page.**
3. **The gap.** The path home crosses the gap again. Pip remembers how he crossed last night ("Last time I flew!"). The drawer and your satchel open, and you help them across with anything that works, as in chapter 1. If nobody helps, Tansy uses the keepsake you gave back to her: the kite lifts her over, her ladder is laid across, her thread is carried by Moth. If it was something that can't cross (the sock), Wick's rope comes, as last night. At the lighthouse, Wick steps back and lets Pip light the lamp on his own for the first time (the arc: Wick learns to hand over the lamp; it's lines and acting, then the spark from Pip's lantern, as in chapter 1). The beam sweeps your room and shows Tansy her way home. "The end of chapter two", "Read it again", "Tonight's lost thing".

**What comes back.** Chapter 1's satchel can hold several things (the crossing object, plus anything else you gave). The one on the gallery railing is the object that crossed the gap; if nothing crossed, the first other thing you kept; if your satchel is empty, Tansy's own sock. It goes home with Tansy (canon: "Tansy has her kite back"); everything else stays in your satchel for the gap. "Give it back" on chapter 1's page removes a keepsake, and the choice above runs again.

The variants (which keepsake comes back, how the lantern came back) are assembled into a plain contract `Spine` when the chapter starts, so the scheduler and simulator run it like chapter 1. The assembled spine is saved with the chapter's start event, so a reload rebuilds the same one.

## How it's built

Engine code still knows no character names.

| Unit | Does | Where |
|---|---|---|
| **Splicing in the scheduler** | The scheduler gains one operation: `offer(beat)`, a validated director beat waiting for its moment. At the next action-group boundary of whatever is playing (between groups, or after an ask's spoken line while it waits; never inside a line or a crossing), it **suspends** the current execution, plays the director beat, then carries on with the **rest of the same beat from that group**. A suspension is not a gift's cut: nothing in the remainder is pulled forward (a character's entrance still happens when the remainder reaches it), and action keys stay those of the original beat, so once-only effects apply exactly once. If a gift preempts while a remainder is pending, the remainder is dropped, as a cut beat is today. An execution gains `fromIndex`, so the remainder is rebuilt exactly on resume; director beats live in the snapshot, whose version goes up (an older checkpoint is simply not resumed). An offer expires if its moment passes (8 s for a reaction, the end of the scene for a callback) | `client/src/show/scheduler.ts` |
| **Time-box** | The projected end is computed from real scheduled durations: the current beat's remainder, then the slowest path through what's left (the longest branch of every problem still open or to come, plus its unspent holding grace). Today, holding something through all three asks already reaches 7:11 in the simulator (three 12 s graces), so the holding grace also gets an episode-wide budget that keeps that path under 7:00 | `client/src/show/scheduler.ts` |
| **Director client** | Builds `planBeat` requests: the spine and cursor, a library narrowed to who and what is on this spread, the satchel with history, canon, the last 40 events, `usedLineIds`, and the trigger (`gift` for reactions; `lookahead` for callbacks, sent at the start of a quiet beat when something new has happened since the last one). One request in flight per trigger kind, through `aiOrAuthored`, with the 8 s deadline already in `backend.ts`. `planSpine` gets its own 60 s deadline | `client/src/director/` |
| **Validator** | On the client, for every director beat, at the offer and again when it's admitted: `checkBeat` against the narrowed library, talk and acting only, at most 4 lines and 15 s, stage directions like `*grumbles*` stripped, no line over 160 characters, and a small PG word check. **No repeats, by line id** (`lineIdOf`): not a line already used, not any line anywhere in this chapter's spine (so an AI line can't steal one still to come), and not one in another offer still waiting. Anything that fails is dropped and logged, never repaired. The simulator compares lines by id too | `client/src/director/validate.ts` |
| **The log records the story** | Today the log keeps beat starts and ends and the drawer only. It gains what memory and the director need: `episode.started` (with the spine, including an assembled or generated one, and the objects), `object.handed`, `object.used`, `problem.attempted`, `problem.resolved`, `entity.grabbed` for characters, `object.kept` with its history, `episode.ended`. Chapter-end canon is written once per finished chapter (idempotent by episode run), so a reload at the end page doesn't record it twice | `client/src/index.ts`, `client/src/show/log.ts` |
| **Backend director** | Real handlers for `planBeat` and `planSpine` with the Anthropic SDK, keys from the environment, caps through the existing guard. Structured output on a small schema (lines with speaker, text, mood and an acting each), which the backend turns into contract stage actions. Prompt caching on the stable part (cast, world, spine). Gift reactions on Haiku with thinking off; lookahead and stories on Sonnet with `between_tools`. A refusal, a timeout or a bad shape is an error the client turns into the authored path | `backend/src/director/` |
| **Story builder** | Turns the story format into a full contract `Spine` on the existing sets: page turns between spreads, entrances on the right marks, one ask per spread with rules, a fallback and an ignored beat (another character solves it), and the lamp and beam ending. Checked with `checkSpine` before it's sent | `backend/src/director/spine.ts` |
| **Memory** | A pure reducer from the event log to canon, satchel (with history), pages and progress, honouring `canon.reverted`. Chapter end appends `object.kept`, `canon.recorded` and `page.composed`. Mirrored with `memoryAppend`. **"Start the book over"** clears the IndexedDB log, progress and checkpoint at once, bumps a log generation so writes still in flight are dropped, drops any director work in flight, and calls `memoryDelete`; if the backend can't be reached, a pending delete is kept and sent before any later mirror upload | `client/src/memory/` |
| **Chapter 2** | `episode-2.json`: a spine plus canon variants, assembled at start. Its beats are checked by `checkSpine` and the simulator for every keepsake and every lantern ending | `client/public/show/` |
| **Contents page and composed pages** | The sage tab toggles a contents mode: pop-ups fold, lines are printed on the spread and pinched like any book control (64 mm, reaching 5 cm up). A chapter's page is that chapter's own set and cast at their end marks, with the keepsakes on it, and what lasts printed on the caption band | `client/src/book/` |
| **Several chapters in one runtime** | The runtime loads a spine per chapter (chapter 1, chapter 2, a lost-thing story) and resets onto it, the way "Read it again" resets today. Sets, cast and objects are already all loaded. **Reload:** progress records the active episode; the checkpoint carries its episode id and, for an assembled or generated chapter, the spine itself, so startup builds the runtime on the right spine before it reads the checkpoint. The log's episode id follows the switch | `client/src/show/runtime.ts`, `client/src/index.ts`, `client/src/show/checkpoint.ts`, `client/src/show/progress.ts` |
| **Simulator** | Gains a scripted director with chosen latency and failure (none, slow, failing, capped, offline, random), so hundreds of shows run in CI time | `client/src/show/simulate.ts` |

**Contracts.** I expect no change. `planBeat`, `planSpine`, `ReadyBeat`, `Beat.replaces`, the canon and page events and the memory routes already cover this. "Talk and acting only" and "next group boundary" are client decisions, written here. If a real contract change turns up, it goes as its own small PR first.

## Order of work

Each phase ends playable, and gets judged in the emulator before the headset.

### Phase 1: the director in chapter 1 (thinnest playable)
- [x] Splicing in the scheduler, offers, expiry, time-box admission, snapshot.
- [x] Backend `planBeat` on Claude, with caching and fallbacks; validator; director client; reactions and callbacks.
- [x] Simulator with an injected director: hundreds of runs, every failure mode (`node tools/director-sim.ts`).
- [x] The gap's night sky; the ladder's hand-over.

**Built and checked, Nov 14.**
- **The simulator found holes in chapter 1 that predate the director.** A quick reader could finish in 4:31 (helping before being asked cuts long beats), and one who stacked wrong tries could reach 7:09. Fixed in the scheduler: unused narrator bridges fill the walk home once the last problem is settled and the rest is known to run short (six new bridge lines, captions until the chapter 2 voice run); a wrong try that would run past 7:00 gets the wordless "can't do that"; and when a beat starts with the chapter projected to run long, its pauses play shorter. Holding grace has an episode budget of 20 s.
- **Time-box admission** is the chapter's end with nobody doing anything more, plus the slowest the open problem could still go. Stacking every future worst case refused most director beats; the pacing above protects 7:00 instead.
- **Placement.** Reactions splice at the next fresh boundary (a pause, or a change of speaker), never between a gift and its consequence, never before an ask. Callbacks only go in front of talk, so nothing physical is interrupted. A problem gift drops reactions still waiting for earlier gifts. Each played director beat is logged as `beat.queued`, so later requests know what was already said.
- **Simulator, 438 shows per seed across six director profiles** (off, instant, normal, slow, 30% failing, all failing): 0 failing; every path 5:00–6:55; about 75% of director beats offered get played.
- **Emulator:** the kite handed to Pip while he asks for the wick gets "A kite? Oh, look at its patches. Somebody loved this kite very much…" about 5 s later; after the lantern, Wick: "Somebody big had a hand in that."; after the ladder: "Five little rungs, and not one of them wobbled. Well, only my knees." With the backend stopped, the chapter plays on with no gap. The ladder is handed over on the first try when held by its top (hand-over now measured along the whole object).
- [ ] **Headset session 1:** hand odd things over and see what comes back; Wi-Fi off mid-chapter; the page turn by hand.

### Phase 1b: stop the show
- [ ] The wrist tag and its three tags, painted and printed like the book, with every hand state shown and heard. Pause, restart the chapter, put the book away (ends the session, landing offers Continue). Emulator, then the headset.

### Phase 2: memory and chapter 2
- [ ] Memory reducer, chapter-end canon, satchel across chapters, mirror, delete.
- [ ] Run 013: the visitor (plan, generate, cut out, rig, Mac look). Run 014: chapter 2's voices plus the shore line (plan, generate, check, close).
- [ ] Chapter 2 data with its variants; several chapters in one runtime; landing "Continue chapter 2".
- [ ] Contents page, composed pages, "Give it back", "Start the book over".
- [ ] **Headset session 2:** the returning evening, including closing the book mid-scene.

### Phase 3: Tonight's lost thing
- [ ] Backend `planSpine` and the story builder; moderation pass.
- [ ] The pick from the drawer, the wait, the checks, the plain failure message.
- [ ] **Headset session 3:** start three stories of your own. Iterate until you sign M3 off.

**Time.** About two days to M3, with the deadline on Nov 18: phase 1 by the end of Nov 14, phase 2 on Nov 15, phase 3 on the morning of Nov 16, the rest of Nov 16 for headset sessions and the sign-off. Rough budgets: splicing, the time-box and the log 3 h; backend director and validator 3 h; simulator runs 1 h; memory 2 h; runs 013 and 014 3 h; chapter 2 data 3 h; contents page and pages 3 h; lost thing 4 h.

If time runs short, nothing the ticket requires is cut; polish goes first, in this order: fewer callbacks (reactions stay), the visitor as a single painted card with simple motion rather than a jointed puppet, the composed page as the chapter's set and keepsakes without the cast at their end marks, and chapter 2's shore lines shared across lantern endings (the keepsake variants and the gap's variants stay, since they're what makes chapter 2 change).

## How it's checked

- **Existing suite green** (`pnpm test`), with the zero-input path and the authored chapter 1 unchanged when the director is off.
- **Simulator (P4), run from a script:** hundreds of shows per chapter with scripted readers and an injected director (instant, 2–9 s, 30% failing, all failing, capped, offline). Each asserts: 5–7 minutes, no stretch over 8 s quiet, no repeated line id, every gift gets `take` in its tick and a consequence within 6 s, every path resolves. Gifts that are asides or repeats are counted too: an aside's reaction is measured for when it actually lands (or that it expired cleanly), and a repeat gets its wordless "can't do that".
- **Story rubric (P2):** every library object handed to each character in each spread, through the real backend, scored on a short rubric (about this object, in character, fits the moment, PG). I read the worst and the best, and you play them.
- **Changes, not mentions:** chapter 2 simulated with each canon (each keepsake, each lantern ending, nothing kept) and after "Give it back": the beats played differ, not only the words.
- **Reload:** canon and satchel survive a reload and a crash mid-chapter 2.
- **Emulator:** the sage tab, contents, a chapter page, "Give it back", "Tonight's lost thing" through the drawer, the failure message with the backend off. Glasses field of view for the contents page.
- **Keys:** `pnpm check:bundle` still finds no key in the client.

## Risks

| Risk | If it happens |
|---|---|
| Director lines are bland or samey | Tighten the prompt with chapter-specific notes, and the rubric shows it before you play |
| Splicing makes the authored lines feel interrupted | Splice only before a line that starts a new thought (a `wait` or a speaker change), and fewer callbacks |
| Reactions arrive too late to feel connected | Haiku with thinking off, a shorter prompt, and the 6 s expiry |
| Generated stories don't pass the checks often | More of the structure in the builder, fewer free choices for the AI |
| Captions-only AI lines feel unfinished next to voiced ones | Expected until ticket 4; the murmur and mouth movement carry it |
| Chapter 2 runs long with every variant | The simulator's time-box per variant, and trimmed walks |

## Not in this ticket

Voices for AI lines, Talk and spoken premises, music (ticket 4). Story Circle (ticket 5, held). The web page and the journey around the book (ticket 6). Live-painted pages and finds (if there's time, later).

## Review log

Codex reviewed the plan once on Nov 14, read-only, against the code: no P0, eight P1 and three P2. I checked each one in the code. All eleven are real (number 9 only partly), and all are taken.

1. **P1. Story generation would hit the 8 s deadline** in `client/src/backend.ts`. *Taken:* `planSpine` has its own 60 s deadline, and a late answer is ignored.
2. **P1. The time-box isn't safe "by construction".** Holding something through all three asks already runs 7:11 in the simulator (three 12 s graces on a 6:35 path). *Taken:* admission uses real durations along the slowest remaining path, including the unspent grace, and the grace gets an episode-wide budget.
3. **P1. Memory has nothing to read.** The log keeps only beats and the drawer (`client/src/index.ts`). *Taken:* the log records the story's events, chapter starts with their spine, and chapter ends, with chapter-end canon written once.
4. **P1. A reload in chapter 2 or a generated story would come back on chapter 1,** since startup loads the manifest's episode and the checkpoint refuses another episode. *Taken:* progress records the active episode, the checkpoint carries its spine, and startup builds the runtime on it first.
5. **P1. "Start the book over" could leave or bring back memory:** the log store can't delete, and writes are asynchronous. *Taken:* a local clear, a log generation that drops writes in flight, and a pending server delete sent before any later upload.
6. **P1. Splicing isn't a gift's cut:** a cut brings later entrances forward. *Taken:* a suspension keeps the remainder's actions and keys as they are, and a gift drops a pending remainder.
7. **P1. A reaction can't land during a long ask,** and the simulator doesn't measure asides. *Taken:* a splice may follow an ask's spoken line while it waits, the expiry is 8 s, and the simulator measures asides and repeats.
8. **P1. Chapter 2's ladder had two homes:** chapter 1 puts it in the satchel, and the plan also left it across the gap. *Taken:* the gap is re-crossed in chapter 2, with what you kept as Tansy's way over if nobody helps; which keepsake comes back is defined for several kept things and for "Give it back". Wick letting Pip light the lamp is lines and acting, so no `give` handler is needed.
9. **P2. "Anything to anyone"** isn't how problems work: the branch plays whoever takes the gift. *Partly taken:* that's ticket 2's accepted behaviour (Wick passes the lantern on), so it stays; the plan now says reactions are for gifts nobody asked for or that don't answer the ask, and join the branch otherwise.
10. **P2. The repetition check was too narrow,** and the simulator compares raw text. *Taken:* no repeats by line id against used lines, every line of the chapter's spine and other waiting offers, checked again at admission; the simulator uses ids.
11. **P2. The cut order would cut required work** (composed pages, consequence variants). *Taken:* hour budgets per phase, and a cut order that thins polish only.
