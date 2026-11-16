# Finish sprint, lane A: the product overhaul

**Stage 2: the build plan.** Nov 16, 2026. Branch `finish-product-overhaul`. Stage 1 (the walk and the structure) was approved with changes by the sprint master on Nov 15 after one Codex review (4 P0, 8 P1). Every ruling is folded into the structure below; the review log at the end maps each finding to where it's answered. Stage 2 is section 6 onward.

**Read with:** `docs/plans/2026-11-15-finish-sprint.md` (the lanes and seams), ticket 7's "Foldtales as a complete product" in `docs/sprint-plan.md` (the brief and what to keep), `docs/design-language.md`, `docs/plans/2026-11-14-product-front-door.md` (today's page, approved Nov 14).

## The proposal in one paragraph

**The page is the front door, and the book is home.** You choose on the page the first time, because XR starts from a tap there and the microphone must be allowed there. Once you're inside, the book itself is the menu, the way Moss does it, with Beat Saber's structure: one way to pause that always looks the same, a small contents page that is home, an end page that works like a results screen, and two settings. **One control opens all of it: the ribbon.** Pinch the ribbon and the story stops, the pop-ups fold down flat, and the open spread becomes a printed page of choices, never more than two to a page so each one can be pinched alone even when the book is at its smallest. Shutting the cover still pauses, with no page. The way out is **"Put the book away"**. The wrist tag and the sage tab go. **Your book**, on the page, lists what you've kept by name. Lanes B and D don't build menus: they hand the book what to print, and they plug their chapter and Storyteller into one entry path and one controls API.

---

## 1. The walk: what's there today

I read every surface's code and ran today's `main` on the Mac in the IWSDK emulator (an emulated Quest 3 in its living room): the page as a new reader on a headset, then "Open the book" into the chapter. The page offered "Open the book", the Storyteller door's "Let them hear you" below the scroll, and the foot's Chapters, painted room, About and Privacy. Inside, the book found the coffee table, landed, dimmed the room and opened on the lamp spread with its caption, the satchel standing beside it. The controls inside the book aren't scene entities (they're hand-distance checks in `controls.ts`, `hands.ts` and `wrist.ts`), so their behaviour below comes from the code and the playtest notes, not from driving them in the emulator. "Load" is what each step asks of you: choices, words to read, reaches, waits.

### 1.1 The page (2D, every device)

| Surface | Where | What it does today | Problems |
|---|---|---|---|
| **Header** | top of the page | "Foldtales" wordmark. "Sign in" / "Pip's book" button when accounts are on (they're off). | Fine. |
| **Hero** | `landing/app.tsx` | Title *Tales from the Table's Edge*, the tagline, one rust button. Waits for its art, then fades up. | The owner's look check passed ("Yes, move on"). It never says what's yours: nothing changes for a returning reader except the button's words. In the emulator's window, the detail line under the button ran into the cover's art; to check at 1280 × 670 in stage 2. |
| **The one button** | `landing/actions.tsx` | Loading → "Getting the book ready" with a gold bar. Ready → "Open the book" / "Continue chapter 1" / "Start chapter 1 again" / "Read chapter 1 again". Opening → "Opening the book…". Refused (no session 12 s after a tap) → "Your browser didn't open the book. Tap to try again." Failed → "The book didn't load" and "Check your connection, then reload the page." | Two sources of truth for its words: `library.ts` and `index.ts`'s own `current()` (hard-coded "chapter 1"). After a chapter, the page shows `index.ts`'s words, not the library's. A start-over link appears only mid-chapter. Nothing is said about where you stopped ("You stopped partway through 'The lamp goes out'"). |
| **The scroll** | `landing/story.tsx`, `book-stage.tsx` | The pinned stage: the book opens, the lantern goes out and back, the page turns, the beam sweeps. Three short beats of words. | Keep as is. It's the baseline. |
| **The Storyteller section** | `landing/storyteller.tsx` | The night shore with the cast and two lines of film-style subtitles, then the door. The door is a sage button that says what's missing: "Sign in to start" (accounts on) → "Let them hear you" (asks for the microphone) → "Start the AI Storyteller". Denied mic: one line about site settings. | The door is below the fold, after the whole scroll: a returning Storyteller player scrolls past the chapter every time. Its label comes from two places (`index.ts`'s `storyDoorLabel()` and the door's own state), and `index.ts`'s long labels ("…(it will ask for your microphone)") are never shown. No "continue your story", no past stories, no offline check before you enter. |
| **The end section** | `app.tsx` | "Your table is ready." and the button again. | Fine. |
| **Foot** | `app.tsx` | Chapters (opens a sheet), "No table? Read in the painted room", About, Privacy, "Open it here anyway" (desktop only), the competition line. | "Chapters" is a list without actions: you can't start a chapter from it. The painted room is hidden in the foot. |
| **Chapters sheet** | `landing/sheets.tsx` | A paper sheet: the book's title, chapters with "started" or "read", "More chapters on the way", and one line about the AI Storyteller. | Read-only. Says chapter 1 is "The lamp goes out", while the chapter itself is titled "The night the light went out" (`episode-1.json`). Keepsakes and things painted for you appear nowhere. |
| **Bookplate** | `sheets.tsx` | Sign in (Google, phone code), signed-in state, sign out, delete. | Built, off. Two options, not the three now required (phone code, Google, Facebook). Its layout is lane A's; behaviour and words are lane D's. |
| **Phone sign-in, `/link/`** | `pages/link.tsx` | Steps: enter the code → sign in (Google or an email code) → "Let the headset in?" → done, or declined. | Expired code, wrong code, a provider that fails and a cancelled sign-in have no screen of their own. No Facebook. |
| **`/auth/return/`** | `pages/auth-return.tsx` | Finishes a Google sign-in and goes back to the page. | A failure lands on a plain line; it doesn't carry you back to the door you were opening. |
| **About, Privacy** | `pages/` | Plain pages in the same look. | Privacy names the Storyteller's data. Needs the keepsakes line (they stay on the headset) and settings' "forget" once that exists. |
| **Desktop and phone** | `actions.tsx` | Same page, "Send to your Quest", copy and share. No 3D download. | Fine. |
| **Settings** | — | None. | No place to mute or change the room's light. |

### 1.2 Inside the book (XR)

| Surface | Where | What it does today | Problems |
|---|---|---|---|
| **Arrival** | `stage/wash.ts`, `arrival.ts` | An ember flies to the table, a wash blooms, "Your theater will play here", the book drops and opens. In the painted room, a painted table. | Loved in the headset. Keep. |
| **Cover** | `stage/controls.ts` | Pinch the outer edge and swing: shut pauses, open resumes. | Fine. It's the most natural pause there is. |
| **Spine** | `controls.ts` | Drag to move the book. Two hands on the outer edges stretch it, 0.6× to 1.3×. | Stretch may be twitchy (open playtest item). There's no way back to the original size. |
| **Ribbon** | `controls.ts`, `book-view.ts` | Pinch to pause; it lifts and the house lights come part way up. Pinch again to carry on. | A pause with nowhere to go: nothing to choose while paused. It was hard to find twice before it moved to the near edge. |
| **Gold tab** | `objects/hands.ts` | Opens and shuts the satchel. | Fine, but it reads as a menu tab, not as the satchel's latch. |
| **Sage tab** | `book-view.ts` | Painted on the book. Does nothing. The design language says it opens the contents page, which was never built. | A control that doesn't work. |
| **Wrist tag** | `stage/wrist.ts` | A small gold tag on the back of the left wrist. "Pinch me: pause, start again, leave" until first used. Pinch it with the right hand and three paper tags fan out on a gold thread: Pause / Carry on, Start this chapter again, Put the book away. | The owner: "very absurd right now". It's the only control not on the book, it needs both hands and a wrist turn, its words are 7.5 mm tall (below the 11 mm rule), it says "chapter" in the Storyteller too, and it can't take you anywhere else (contents, the other mode, settings). |
| **Drawer pull** | `hands.ts` | Opens the Lost and Found. Slides open when a character asks. | Fine. |
| **Page edge** | `hands.ts`, `runtime.ts` | The corner lifts with "Turn the page" printed on the caption band. Hold and turn it. | Fine. Still to feel in the headset (open item). |
| **Caption band** | `runtime.ts` | Narration and lines, then hints in the same place: "Turn the page", the Storyteller's "Your turn: hold the button to talk to Pip.", "Listening…", "Didn't catch that…", "No internet connection…", "Sign in on the page outside the book…". | Story and system messages share one line, at the same size, with a slow pulse for system ones. A failure reads like narration. |
| **Hold to talk** | `stage/talk.ts` | The Storyteller's paper button on the table in front of the book. Press with a fingertip or pinch. | Works ("worked the first time"). It's the Storyteller's one in-story control; it stays. |
| **Satchel** | `book/satchel-view.ts`, `storyteller/keepsakes.ts` | Stands beside the book. Things you used fly in at the end. In the Storyteller, everything painted for you is kept (IndexedDB, 48 at most) and comes back each evening. | You can't browse it: you open the flap and see what peeks out. Chapter keepsakes and painted things are mixed, with no names or history shown. |
| **End page** | `book/text.ts` | Printed on the caption band: "The end of chapter one" (hard-coded) and "Read it again" with a gold rule. Close the book to stop. | Not a results screen: nothing about what you did or what you kept, nothing about what's next, no way to the Storyteller or to leave except shutting the cover (which only pauses). |
| **Storybook page** | `memory/memory.ts` | At a chapter's end the app records a page: title, lines, the sets' art, what you kept. | Recorded, never shown anywhere. |
| **Storyteller ending** | `storyteller/session.ts` | There is none. The story goes on until you leave by the wrist or the system menu. | No ending, no title, no "what you made tonight". |
| **Room effects** | `room-fx/`, `docs/room-effects.md` | Ten effects, played when a beat or the Storyteller calls them. | Nothing tells a reader they exist, can be asked for, or what their room has seen. |
| **Settings** | — | None inside. | No mute, no dim strength, no size reset. Captions are always on (good). |

### 1.3 Journeys today

| Journey | Today, step by step | Load and problems |
|---|---|---|
| **A judge, cold, on a Quest** | Link → hero → "Open the book" → XR → arrival → chapter 1. | One tap. Excellent. Keep exactly. |
| **First time inside** | The story teaches pinch and hand-over (the lantern at 0:50). "Turn the page" is printed when it's time. The wrist hint shows only if you happen to turn your left wrist. | Pausing and leaving are never taught. |
| **Choosing the Storyteller** | Scroll the whole page to the shore → "Let them hear you" (mic prompt) → tap again → XR. | 2 taps and a long scroll. Fine for a first visit, slow for a returning Storyteller player. |
| **Switching mode** | Leave XR (wrist or system menu) → scroll to the other door → tap → the page reloads (`index.ts`: one page load runs one mode) → tap again. | Three taps, a scroll and a reload, all outside the book. |
| **End of chapter** | "The end of chapter one" · "Read it again". To stop: shut the cover (that pauses), then the system menu. | No results, no next, no clean way out. |
| **Leaving mid-story** | Wrist → "Put the book away": the book closes, the place is saved, XR ends. Or the system menu. | Works, through the absurd wrist. |
| **Coming back** | Page: "Continue chapter 1", with "Start chapter 1 again". In XR, the book re-arrives shut and reopens where you were. | Good bones. No "where you were", no "Previously on…". Storyteller: always a new story. |
| **Mic refused** | Page: one line about site settings. Inside: "They can't hear you yet…" on the caption band. | Fine wording; it reads like narration inside. |
| **No internet** | Chapters play (the art is already loaded). Storyteller: "No internet connection. The AI Storyteller needs the internet." printed only when it's your turn. Cold start offline: "The book didn't load". | The page lets you into the Storyteller offline. Other AI failures (slow, capped, refused) say nothing. |
| **XR refused** | "Your browser didn't open the book. Tap to try again." after 12 s. No WebXR: the desktop page. No passthrough: the painted room. | Good. |

### 1.4 What the walk adds up to

1. **Inside the book there's no home.** You can pause, but there's nothing to do while paused. Contents, the other mode, settings and leaving are all outside the book or on your wrist.
2. **Three controls do one job badly** (ribbon, sage tab, wrist tag), and one of them is dead.
3. **Endings stop instead of landing.** No results, no next, no way out but the system menu. The Storyteller has no ending at all.
4. **What you gather is invisible.** Keepsakes, painted things and storybook pages exist in data but have no shelf.
5. **The page's words come from two places** and hard-code "chapter 1", which breaks the moment lane B adds chapter 2.
6. **System messages look like story.** Failures and hints share the caption line with narration.
7. **No settings**, not even mute.

---

## 2. What we borrow

| Beat Saber has | Moss has | Foldtales gets |
|---|---|---|
| A main menu you always return to | The book is the menu | **The contents**, printed in the book: home inside XR |
| Clear play modes | — | **Two ways in**, always named the same: *chapters* and *the AI Storyteller* |
| A library with packs | Chapters in a book | **The shelf**: the book's chapters with their state, and "More chapters on the way" |
| A pause menu that's always the same | — | **The pause page**: one ribbon, the same four choices |
| A results screen | — | **The end page**: what happened, what you kept, what's next |
| Settings | — | **Two settings** in the book: sound, and the room's light |
| A tutorial | Learn by doing | **No tutorial**: the story teaches by asking, and the ribbon carries a printed hint until you've used it |

The look stays ours: printed paper, ink, gold rules. No panels.

---

## 3. The structure

### 3.1 Decisions (sprint master, Nov 15)

| Decision | Ruling |
|---|---|
| Where you choose | On the page the first time; in the book after that. |
| The one control | **The ribbon replaces the sage tab** (`docs/design-language.md` is updated in phase 5). The gold tab stays as the satchel's latch. |
| Shutting the cover | **Pauses**, with no page, as today. |
| The printed way out | **"Put the book away"**. "Close the book" is no longer used as a label; shutting the cover is a pause. |
| Switching mode inside XR | **Cut.** Another chapter or the Storyteller is reached through a durable entry target and the page (section 3.6). Chapter to chapter may load in place if lane B's engine does it cleanly; nothing depends on it. |
| The collection that ships | **Small and honest:** on the page, Your book lists your keepsakes and things painted for you **by name**; in the book, the contents shows the satchel's **count**. No browsing inside the book, and nothing looks pinchable that isn't. |
| Room-effect discovery | **v2.** |
| Settings | **In the book:** sound on or off, and the room's light. **On the page:** none in v1. "Start this chapter again" is on the pause page. A global reset and "forget what's kept" are deferred. |
| The Storyteller | Lane D's model: **no continuing an unfinished story**. "Your stories" means finished stories. |

### 3.2 The surface map

```
FOLDTALES
│
├─ THE PAGE  (2D; every device)                              front door
│   ├─ Hero: the cover, the tagline, the one button          where you are, from libraryState()
│   │    └─ under it, once you've played: the Storyteller door, equal weight
│   ├─ The scroll (unchanged)
│   ├─ The AI Storyteller: the shore and its door             lane D's states and words, lane A's layout
│   ├─ Your book  (a paper sheet; replaces "Chapters")
│   │    ├─ The shelf: each chapter with Start / Continue / Read again
│   │    ├─ The AI Storyteller: Start a new story · Your stories (finished, by title)
│   │    └─ What you've kept: keepsakes and things painted for you, by name
│   ├─ Bookplate: phone code · Google · Facebook              lane A's layout, lane D's behaviour
│   ├─ /link/ and /auth/return/                               same split
│   └─ Foot: Your book · The painted room · About · Privacy
│
├─ THE BOOK  (XR; the only UI inside)                        home
│   ├─ Arrival (unchanged)
│   ├─ The story: a chapter or the Storyteller
│   │    ├─ Cover: shut to pause (no page), open to carry on
│   │    ├─ Ribbon: THE one control ──► the pause page       hint printed beside it until first use
│   │    ├─ Spine: move · outer edges: stretch
│   │    ├─ Drawer pull · page edge · gold tab (satchel) · Hold to talk (Storyteller)
│   │    └─ Caption band: story only · status line under it: system only
│   ├─ Pause page · Contents · Chapters · AI Storyteller · Your stories · Settings
│   └─ End page: a chapter's, or a story's
│
├─ ON YOU: nothing. The wrist tag goes.
│
└─ THE SYSTEM: Meta's menu and headset off pause; the place is kept
```

### 3.3 Shared vocabulary

| Say | Means | Don't say |
|---|---|---|
| **Foldtales** | the product | Tabletop Theater (repo only), the app |
| **the book** | the pop-up book in XR, and *Tales from the Table's Edge* | the scene, the stage |
| **chapter** | a written story, in order, about six minutes, hands only | episode, level |
| **the AI Storyteller** | the free mode | AI mode, playground |
| **a story** | one Storyteller story, with its own title | session, evening |
| **Your stories** | finished Storyteller stories | history, saves |
| **Open the book** | enter XR | launch, play |
| **Continue** · **Start again** · **Read again** | resume · restart · replay a finished chapter | resume, restart |
| **Carry on** | leave the pause page and play | resume, unpause |
| **Put the book away** | leave XR, place kept | quit, exit, close the book |
| **shut the book** | the cover, a pause | — |
| **the ribbon** · **the pause page** · **the contents** · **the end page** | the control and the printed pages | menu, HUD, results |
| **End the story here** · **Start a new story** · **Tell another** | the Storyteller's actions (lane D's words) | stop, new session |
| **your satchel** · **keepsakes** · **things painted for you** | what you keep | inventory, catalog, items |
| **Your book** | the page's sheet | library, dashboard |

Chapter titles come from the chapter's data everywhere. Chapter 1 is **"The night the light went out"**; `CHAPTERS` in `progress.ts` changes to match (lane B's file).

### 3.4 The printed pages: measured at the smallest book

The book stretches from 0.6× to 1.3× (`resize.ts`); auto-fit starts at 0.7× (`sizing.ts`). **Every printed page is laid out for 0.6×** and keeps the same arrangement at larger sizes (only spacing grows), so the pages are always the same.

| | 0.6× | 0.7× | 1.0× | 1.3× |
|---|---|---|---|---|
| One page (w × d) | 126 × 189 mm | 147 × 221 mm | 210 × 315 mm | 273 × 410 mm |
| The spread's width | 252 mm | 294 mm | 420 mm | 546 mm |
| Half-width seen from 0.6 m | ±12° | ±14° | ±19° | ±24° |

- **Two choices a page, four a spread.** Each choice is a row 64 mm deep (the hand target's diameter, `design-language.md`), so neighbours never share a target. A page with a heading band of 36 mm still fits two: 36 + 2 × 64 + 2 × 8 margin = 180 mm ≤ 189 mm.
- **Text at 1° or more at its real distance.** Each row's size is set when the page opens, from the head to that row (`minTextSizeM` in `sizing.ts`): 11.3 mm at 0.65 m, 13.1 mm at 0.75 m, 15.7 mm at 0.9 m. At 0.6× a line holds about 13 to 16 characters, so a label may wrap to two lines (38 mm at the largest size, inside its 64 mm row). Labels are kept to 18 characters.
- **In view.** The whole spread stays within ±24° across at 1.3× and 0.6 m, inside the ~70° × 66° view and the VR Glasses' 37° to each side. Nothing is printed outside the book.
- **The pop-ups lie flat** while a page shows: the hands' `Unfold` with `cover: 1` and every `layers` 0, through the existing `combineUnfold` (the same path that folds them when you shut the cover). The cover stays open, the set folds down front to back, and it stands back up on Carry on. If that can't restore cleanly by Nov 16 noon, the fallback is a printed paper card lying over the folded set.
- **Choices come first.** When the book is small and the eye far, printed lines that don't fit are cut from the end (the end page's lines, a description); choices never move or shrink.
- **Ink on page, gold rule under each choice.** A hand or gaze near a choice thickens its rule (feedback only). The choice fires on release of the pinch that started on it.

**The pages** (left | right; ▸ marks a choice):

```
PAUSE (chapter)                         PAUSE (Storyteller)
┌───────────────────┬───────────────────┐ ┌───────────────────┬───────────────────┐
│ Chapter 1         │ ▸ Carry on        │ │ A key for the     │ ▸ Carry on        │
│ The night the     │   ─────           │ │ cellar            │   ─────           │
│ light went out    │                   │ │                   │                   │
│ ▸ Start again     │ ▸ Put the book    │ │ ▸ End the story   │ ▸ Put the book    │
│ ▸ Contents        │   away            │ │   here            │   away            │
└───────────────────┴──────────ribbon───┘ │ ▸ Contents        │                   │
                                          └───────────────────┴───────────────────┘
CONTENTS (home)                         CHAPTERS
┌───────────────────┬───────────────────┐ ┌───────────────────┬───────────────────┐
│ Contents          │ Your satchel:     │ │ Chapters          │ ▸ 3 <title>       │
│ ▸ Chapters        │ 7 things          │ │ ▸ 1 The night the │   begin           │
│ ▸ The AI          │ ▸ Settings        │ │   light… · read   │ More chapters on  │
│   Storyteller     │ ▸ Back            │ │ ▸ 2 <title> · here│ the way.          │
└───────────────────┴───────────────────┘ │                   │ ▸ Back            │
                                          └───────────────────┴───────────────────┘
ONE CHAPTER (pinched from Chapters)     THE AI STORYTELLER
┌───────────────────┬───────────────────┐ ┌───────────────────┬───────────────────┐
│ Chapter 2         │ ▸ Continue        │ │ The AI            │ ▸ Start a new     │
│ <title>           │   (or Start /     │ │ Storyteller       │   story           │
│ Stopped on the    │   Read again)     │ │ Talk to Pip, Wick │ ▸ Your stories    │
│ shore.            │ ▸ Back            │ │ and Moth.         │ ▸ Back            │
└───────────────────┴───────────────────┘ └───────────────────┴───────────────────┘
SETTINGS                                END (chapter)
┌───────────────────┬───────────────────┐ ┌───────────────────┬───────────────────┐
│ Settings          │ ▸ Back            │ │ The end of        │ ▸ Continue to     │
│ ▸ Sound: on       │                   │ │ chapter 1         │   chapter 2       │
│ ▸ Room light:     │                   │ │ You gave Pip his  │   (or Read again) │
│   dimmer          │                   │ │ lantern. Kept:    │ ▸ Put the book    │
└───────────────────┴───────────────────┘ │ the kite.         │   away            │
                                          │ ▸ Read again      │                   │
END (Storyteller; lane D's words)        └───────────────────┴───────────────────┘
┌───────────────────┬───────────────────┐ YOUR STORIES (finished; paged, 3 a spread)
│ A key for the     │ ▸ Tell another    │ ┌───────────────────┬───────────────────┐
│ cellar            │                   │ │ Your stories      │ ▸ The teapot named│
│ Two or three      │ ▸ Put the book    │ │ ▸ A key for the   │   Shubham         │
│ lines…            │   away            │ │   cellar          │ ▸ Back            │
│ Things: dragon    │                   │ │ ▸ The dragon kite │   (▸ More, when   │
│ kite, teapot      │                   │ │                   │   there are more) │
│ ▸ Your stories    │                   │ └───────────────────┴───────────────────┘
└───────────────────┴───────────────────┘
```

- On the end pages, **Contents** is one pinch away on the ribbon (section 3.5), so the end page itself keeps to three choices.
- **Your satchel: 7 things** is printed, not pinchable, and has no gold rule.
- Pinching a finished story in Your stories shows its end page read-only, with Back.
- From a chapter, "Start a new story" and the Storyteller's choices say what happens: the left page adds "The book is put away, then the AI Storyteller opens from the page."

### 3.5 The state model

The menu is one state machine in `book-menu.ts`. It is the only code that changes what the book shows between the story and a printed page.

| State | What shows | Story clock | Story input (objects, drawer, page turn, talk) | Late work (replies, paintings, beats) | Ribbon does | Back goes to |
|---|---|---|---|---|---|---|
| **playing** | the story | runs | on | arrives and plays | opens **pause** | — |
| **pause** | pause page, set folded | held (reason `ribbon`) | off | held by the mode until play | **Carry on** → playing | — (Carry on) |
| **contents** | contents | held | off | held | returns to the **root** (below) | the root's page |
| **chapters**, **one chapter**, **storyteller**, **your stories**, **settings** | as named | held | off | held | returns to the root | contents (one chapter → chapters; a story → your stories) |
| **ending** | the end page, set folded | stopped; the mode has ended | off | none: the mode has stopped | opens **contents** | — |
| **leaving** | the cover swinging shut | held | off | dropped | nothing | — |
| **switching** | the cover swinging shut | held | off | dropped | nothing | — |

- **The root** is where the ribbon takes you back to: **playing** if you came from the story, the **end page** if you came from an ending. A finished story or chapter never shows **Carry on**.
- **Pause reasons stay independent** (`clock.ts`). A menu holds the clock with the existing `ribbon` reason (no contracts change). Leaving a menu clears only that reason: a shut cover, the headset off or lost hands still hold the story. Shutting the cover while a page shows keeps the page; opening the cover shows it again.
- **Entering any page from playing:**
  - an object in a hand settles where it was picked up from (its last home), never given, kept or dropped;
  - a page held mid-turn falls back, and its invitation stays;
  - a pinch that started before the page opened can't fire a choice;
  - Hold to talk hides and the microphone stops (today's rule: no talking while paused).
- **Returning to playing** unfolds the set and clears the reason. The story resumes at the same millisecond: nothing advanced while held.
- **Late work** is the mode's to hold (section 4.1, `suspend()` and `resume()`): a Storyteller reply or painting that lands during a page is kept and played after Carry on; a chapter's director offers wait like any beat.
- **Leaving** is not cancellable once chosen: the cover shuts, the mode's `stop()` saves its place, XR ends, the page shows where you are.
- **Headset off or the system menu** during a page: the page is kept; you return to it.

### 3.6 Navigation: the entry target

Choosing something you can't reach in place (the Storyteller from a chapter, a chapter from the Storyteller, or a chapter that lane B can't load in place) goes through one durable entry target. **Lane A owns this wiring in `client/src/index.ts`.**

1. **Kept.** The choice is written as an `EnterTarget` (today's type in `progress.ts`) to `sessionStorage` under `tt.enter`, with where you were (`back: EnterTarget`) and a time. It survives XR ending, a reload and a sign-in round trip in the same tab.
2. **Put away.** The book is put away (state **switching**): the current mode's `stop()` saves its place, XR ends.
3. **The page reads it.** On load, the page's one button becomes the target: "Open the AI Storyteller", "Open chapter 2". Under it: "Back to chapter 1" (or "Back to the AI Storyteller"), which clears the target.
4. **Prerequisites on the page.** If the target needs sign-in or the microphone, the button is that step first ("Sign in to start", "Let them hear you"). **One tap opens the book only once every prerequisite is met and the book is loaded.**
5. **Loaded.** `index.ts` reads the target on entry and calls the mode's entry: lane B's `loadChapter(n, from)` or lane D's `startStoryteller()`. **The target is consumed when that call resolves**, not before.
6. **Failed or cancelled.** If loading fails, the target is cleared and the page says so in one line ("Chapter 2 couldn't open.") with where you were as the button. If you never tap, the target expires after 30 minutes and the page shows where you were.

A **chapter you can reach in place** (lane B's `loadChapter` supports it) skips steps 2 to 4: the cover shuts, the chapter loads, the cover opens.

### 3.7 The first time

- **Reach in, pinch, hand over:** the story asks (Pip's lantern). Unchanged.
- **Turn the page:** printed when it's time. Unchanged.
- **The ribbon:** a quiet printed slip, **"Pinch the ribbon to pause"**, lies on the table at the book's near edge under the ribbon's tail (paper art from `Hold to talk`, ink at 70%, 1° text), **until the first time you use the ribbon**, then never again on this headset (`tt.ribbon-used`, like today's `tt.wrist-used`). In the Storyteller it sits beside Hold to talk, never under it.
- **Talk:** lane D teaches it in the cast's words, with Hold to talk's own label.
- **Checked:** a newcomer can pause, carry on and put the book away with either hand in the first five minutes, and the opening's payoff is untouched (section 7).

### 3.8 When things go wrong

**Story on the caption band; system on the status line** just under it (smaller, ink at 70%, no pulse). Every message says what to do, and unavailable actions are shown greyed with their reason, never removed silently. **The chapters are always offered.**

| Moment | Where | What happens |
|---|---|---|
| Cold start, art didn't load | page | "The book didn't load. Check your connection, then reload the page." (today) |
| XR refused | page | "Your browser didn't open the book. Tap to try again." (today) |
| No passthrough · no WebXR | page | The painted room · the desktop page. (today) |
| Offline, chapter | book | Plays as authored once the book has loaded. Whether a first visit can start offline is lane E's cache; the page promises only what lane E's check confirms. |
| The Storyteller door, any state but ready | page | Lane D's states (section 4.3), each with its one step or its reason, and "Open the book" for the chapters beside it. AI and account checks never sit on the chapter's path. |
| Offline or failing mid-story | status line, then the end page | Lane D's retry and its local ending: the story ends here without the network, on its own end page. What you gave stays on the page. |
| Tonight's limit reached | page door; in the book, lane D's ending | Its words are lane D's; the door is greyed with the reason, chapters beside it. |
| Mic refused | page door, status line | Page: how to allow it. Inside: "They can't hear you. Allow the microphone on the page outside the book." |
| Sign-in ended while inside | status line, then lane D's ending | "Your sign-in ended. Sign in again on the page." The story ends locally; chapters unaffected. |
| An entry target fails to load | page | "Chapter 2 couldn't open." and where you were (section 3.6). |
| Headset off, hands lost, system menu | book | Paused, place kept; any page stays. |

---

## 4. The seams

Exact shapes for lanes B, D and E go through the sprint master; these are lane A's proposals.

### 4.1 One controls API (lanes B and D call it)

`client/src/stage/book-menu.ts`, owned by lane A.

```ts
/** A running mode describes itself and owns its lifecycle. Chapters (lane B) and the Storyteller (lane D). */
export interface ModeSheet {
  kind: 'chapter' | 'storyteller';
  /** The pause page's left page: { over: 'Chapter 2', title: '<title>' }, or the story's title. */
  heading(): { over: string | null; title: string };
  /** "Stopped on the shore." or null. */
  where(): string | null;
  /** The pause page's second choice: "Start again" (chapter) or "End the story here" (Storyteller). */
  again: { label: string; run(): void };
  /** A page opened: hold late work (replies, paintings, director offers). */
  suspend(): void;
  /** Back to playing: release what was held, in order. */
  resume(): void;
  /** Leaving or switching: save the place, drop late work, release the microphone. */
  stop(): Promise<void>;
}

/** What an ending prints. Lane B's chapter ending comes through lane A's adapter of the recorded page. */
export interface EndSheet {
  heading: string;                 // "The end of chapter 1" / the story's title
  lines: string[];                 // at most 3
  things: string[];                // names: kept, or painted tonight
  primary: { label: string; run(): void };     // "Continue to chapter 2" / "Read again" / "Tell another"
  secondary?: { label: string; run(): void };  // "Read again" / "Your stories"
}

export interface BookMenu {
  setMode(sheet: ModeSheet): void;
  /** The mode has ended: show its end page. "Put the book away" is added by the menu. */
  showEnd(end: EndSheet): void;
  /** System words on the status line (null clears). Never narration. */
  status(text: string | null): void;
  /** Open a destination: in place if the mode can load it, otherwise through the entry target. */
  open(target: EnterTarget): void;
  /** For code that must stop the story for the reader (a lost connection): the pause page. */
  pause(): void;
  readonly state: MenuState;
}
```

- `pause.set('ribbon', …)`, `controls.setRibbon` and the end page's "Read it again" target are called only from `book-menu.ts`. `runtime.setHint()` stays for story hints ("Turn the page", "Your turn: …"); system words move to `status()`.
- **The Storyteller's place in the controls:** its `ModeSheet` (title, "End the story here"), the contents' **AI Storyteller** page (Start a new story, Your stories), its `EndSheet` (Tell another, Your stories), `status()`, and Hold to talk on the table, hidden on every page.

### 4.2 One selection path (gaze and pinch)

Every printed choice, the ribbon, Back and Put the book away go through **one dispatcher in `controls.ts`**:

- **Hands:** each choice is an `ExtraTarget` with its 64 mm proxy, either hand. It fires on **release**, and only if the same pinch started on it. One choice per pinch.
- **Gaze and pinch (VR Glasses):** `onGazeSelect` first tests the printed choices and the ribbon (7° cone, nearest wins), then falls back to `hands.gazeSelect` for objects and characters. On Quest 3, `onHeadSelect` does the same for the printed choices only while a page shows.
- **Hover** (a hand within reach, or the gaze on a choice) only thickens the gold rule. Nothing fires from hover or gaze alone.

### 4.3 The AI Storyteller (lane D)

- **Data:** lane D owns a Storyteller data provider in `client/src/storyteller/`. Lane B's `libraryState()` calls it; lane A reads only `libraryState()`. The shape is agreed through the sprint master. Lane A's proposal for `LibraryState['storyteller']`:

```ts
storyteller: {
  door:
    | { kind: 'signed-out' } | { kind: 'auth-loading' } | { kind: 'auth-failed'; retry: true }
    | { kind: 'session-expired' } | { kind: 'mic-not-asked' } | { kind: 'mic-refused' }
    | { kind: 'unavailable'; why: 'offline' | 'service' } | { kind: 'limit-reached'; until?: string }
    | { kind: 'ready' };
  finished: Array<{ id: string; title: string; endedAt: string; lines: string[]; things: string[] }>;
}
```

  `door` is ordered as the door checks it; "has finished stories" is `ready` with a non-empty `finished`. Lane A draws one door per state with lane D's words from `page-content.json`'s `storyteller` block, and greys it with "Open the book" beside it for every state but `ready`.
- **Entry:** lane D supplies `startStoryteller(): Promise<void>` for `index.ts` (section 3.6).
- **In the book:** its `ModeSheet`, `EndSheet` and `status()` (section 4.1). Its `suspend()` holds replies and paintings; its `stop()` ends the story locally. Lane D's local ending without the network uses `showEnd`.
- **Sign-in surfaces:** lane A owns the layouts of the bookplate (three options: phone code, Google, Facebook), `/link/` (enter code, sign in, approve, approved, declined, expired, wrong code, provider failed, cancelled) and `/auth/return/` (finishing, signed in → back to the page with any entry target, failed → a line and "Try again"). Lane D supplies behaviour and words. The chapters never ask for an account.

### 4.4 Chapters (lane B)

- **Navigation:** `libraryState()` stays the authority for chapters: the hero, Your book's shelf and the in-book Chapters page all read it. The page stops reading `index.ts`'s own labels. Requested, optional: `where?: string` per chapter.
- **Entry:** lane B supplies `loadChapter(n: number, from: 'resume' | 'start'): Promise<void>` and says whether it works in place inside XR.
- **In the book:** lane B calls `setMode()` when a chapter starts and `showEnd()` when it ends, with `primary` "Continue to chapter N+1" when there is one, else "Read again".
- **The ending's words:** lane A owns `client/src/book/end-sheet.ts`, which turns the recorded `page.composed` (title, text, keepsakes) into an `EndSheet`. Lane B owns what the page records.

### 4.5 Lane E

- **Sound:** lane A adds `setMuted(on: boolean)` to `sound/engine.ts`, which ramps both buses' masters (show and UI) to silence and back; lane E's music bed joins the show bus, so it follows. Agreed through the sprint master.
- **Offline:** the page asks lane E's cache whether the book is stored before promising an offline chapter.
- **Accessibility:** printed pages and the status line meet 1° and 4.5:1, for lane E's pass.

### 4.6 What you've kept (the read adapter)

`client/src/landing/collection.ts`, owned by lane A, read-only:
- **Keepsakes from the chapters:** from the event log in IndexedDB (`show/log.ts`), through `memory.ts`'s `memoryOf()` satchel, names from the object library.
- **Things painted for you:** from lane D's keepsake store (`storyteller/keepsakes.ts`), through a `listKeepsakes()` read lane D exports (names only).
- **States:** loading ("Looking in your satchel…"), empty ("Nothing kept yet. Things you use in a story are kept here."), a list of names with "Kept on this headset.", and storage failure ("Couldn't read what's kept on this headset.").

### 4.7 Contracts

**None.** The menu uses the existing `ribbon` pause reason; every other shape lives in the client.

---

## 5. What ships, and what's later

| By | What |
|---|---|
| **Nov 16, by the end** | The complete thin path: the ribbon and the pause page; a small contents (chapters, the AI Storyteller page, settings); choosing a chapter; both end-page slots; Put the book away and coming back through the entry target; the Storyteller door's states; sound on or off. The wrist tag and the sage tab removed after the layout proof. |
| **Nov 17** | Integration with lanes B and D (their `ModeSheet`, `EndSheet`, `loadChapter`, `startStoryteller`, door data, `listKeepsakes`); the room's light; Your book with names; the bookplate's three options and the sign-in pages' states; the ribbon slip; the glasses-view check; the owner's headset session and its fixes. **Freeze at the end of Nov 17.** |
| **Later** (to `docs/v2-ideas.md`) | Room effects your room has seen, and asking for one. Browsing the satchel in the book, and each thing's history. A chapter's storybook page shown from the contents. A global reset and "forget what's kept". In-place mode switching. Book size reset. |

**Art:** none paid. Runs 025 and 026 stay unspent unless the headset shows a printed page needs a painted ornament, with a plan and estimate first.

---

## 6. The build plan

Seams and the thin path first. Each phase ends green (`pnpm check`: typecheck, tests, bundle) with a commit and a push, and is shown in the emulator or on the Mac as listed. Times are Nov 16 unless marked.

### Phase 0: the layout and the fold (morning, before anything is removed)

| | |
|---|---|
| **Build** | `client/src/book/printed.ts`: a pure layout. Given a sheet (heading, lines, up to two choices a page), the book's scale and the head's position, it returns each row's place, text size and target. `tests/printed.test.ts`. The menu fold: an `Unfold` with the cover open and the set flat, combined into the hands' fold in `index.ts`'s frame. |
| **Prove** | Tests across scales 0.6, 0.7, 1.0, 1.3 and eye distances 0.5 to 0.9 m: every line ≥ 1°, every target 64 mm from its neighbour and on its page, every choice within ±35° across and the glasses' 37°. In the emulator: a review flag `?menu=pause` opens the pause page at 0.6× and 1.0×; the set folds flat and stands back up with every layer at its old angle (read from the scene); one screenshot each. |
| **Gate** | If the set doesn't restore exactly by noon, use the paper card (a printed sheet lying over the folded set) and note it here. |

### Phase 1: the menu, the ribbon, one selection path (Nov 16)

| | |
|---|---|
| **Build** | `client/src/stage/book-menu.ts`: the state machine of section 3.5 as a pure reducer (`tests/book-menu.test.ts`: every state's Back, root and ribbon; a finished story never offers Carry on; clearing a menu leaves `book_closed` and `hands_lost` held), plus `BookMenu` and `ModeSheet`. `client/src/book/printed-view.ts`: troika text and gold rules on the spread from `printed.ts`. The dispatcher in `controls.ts` (section 4.2). A chapter `ModeSheet` for today's chapter 1, so it works before lane B. The status line. Entering a page settles held objects and drops a held page (`hands.ts`, `runtime.releasePage`). |
| **Remove** | The wrist tag (`stage/wrist.ts` and its wiring in `index.ts`), the sage tab's mesh. Only after phase 0 passes. |
| **Show** | Emulator, hands only: right hand and then left hand pinch the ribbon → pause page → Carry on; the story clock reads the same before and after. Pinch the ribbon while holding the lantern → the lantern settles home. Shut the cover on the pause page → open it → the page is back. Glasses device (`iwsdk-glasses-test`): look at the ribbon and pinch → pause → look at Carry on and pinch. |

### Phase 2: the entry target and putting the book away (Nov 16)

| | |
|---|---|
| **Build** | `client/src/landing/entry.ts`: `tt.enter` with `back` and expiry; read, consume, clear (`tests/entry.test.ts`: survives a reload, consumed only on a resolved load, cleared on failure and on "Back to…", expires). `index.ts`: entry reads the target and calls `loadChapter` or `startStoryteller` (today's chapter 1 and Storyteller starts, wrapped, until lanes B and D supply theirs); Put the book away and switching run `stop()`, then end XR. The page reads only `libraryState()` and the entry target for its button; `index.ts`'s `current()` and `storyDoorLabel()` go. |
| **Show** | Emulator: pause → Put the book away → the page says "Continue chapter 1" → tap → the book re-arrives shut and opens at the same moment. Contents → The AI Storyteller → Start a new story → the page shows "Let them hear you" then "Open the AI Storyteller" with "Back to chapter 1"; Back clears it. Mac screenshots of each page state at 1280 × 670. |

### Phase 3: contents, chapters, endings, sound (Nov 16)

| | |
|---|---|
| **Build** | The contents, Chapters, one chapter, AI Storyteller, Your stories and Settings pages from section 3.4 on `printed.ts`. `client/src/book/end-sheet.ts` (`tests/end-sheet.test.ts`: a recorded page to at most three lines and names). The chapter end page replaces `endPageText`; the Storyteller's `showEnd` slot works with a stand-in `EndSheet` until lane D's. `sound.setMuted()` and the Sound setting, kept in `localStorage` under `tt.settings`. |
| **Show** | Emulator with `?speed=16`: chapter 1 to its end page → Read again → the chapter restarts; the ribbon at the end opens the contents, and Back returns to the end page, never to Carry on. Contents → Chapters → chapter 1 → Start. Sound off → no sound plays (the engine's master reads 0) → on. |

### Phase 4: the page (Nov 16 evening)

| | |
|---|---|
| **Build** | The hero for a returning reader with the Storyteller door under it. The door's states from `libraryState().storyteller.door` (a stand-in reading today's flags until lane D's provider). Your book replaces Chapters: the shelf with actions (each one sets the entry target and opens the book in one tap when ready), Your stories, and what you've kept through `collection.ts` (`tests/collection.test.ts`: the four states). The hero's detail line clear of the cover at 1280 × 670. |
| **Show** | Mac screenshots at 1280 × 670, 1440 × 900 and 390 × 844 for: new, mid-chapter, finished, an entry target waiting, each door state (forced by a review flag), Your book empty and full. |

### Phase 5: integration and the headset (Nov 17)

| | |
|---|---|
| **Build** | Lane B's `loadChapter`, chapter `ModeSheet`, `where`; lane D's door data, `startStoryteller`, Storyteller `ModeSheet` and `EndSheet`, `listKeepsakes`, sign-in behaviour. The bookplate's three options, `/link/` and `/auth/return/` states. Room light (three levels of `MAX_DIM`). The ribbon slip. Docs: `docs/design-language.md` (the ribbon replaces the sage tab, the wrist tag goes, the printed pages, "Put the book away"), the PRD's vocabulary lines, `docs/v2-ideas.md` (section 5's later list), a dated section in `docs/playtest-notes.md`. |
| **Show** | The glasses-view check (section 7). Then the owner in the headset, in this workspace: a first-time run with either hand (pause, carry on, put away), a chapter's ending, the contents, the Storyteller door to a story and its ending. Fixes the same day. Then the PR. |

---

## 7. Checks

- **Every phase:** `pnpm check` green; no test visuals (review flags only in review builds); keys stay out (`check:bundle`).
- **Layout:** `tests/printed.test.ts` at four scales and five distances.
- **Hands only, either hand:** ribbon → pause → contents → Chapters → chapter → start; an ending → Read again; pause → Put the book away; in the emulator with each hand on its own.
- **Gaze and pinch:** the same path on the `metaVRGlasses` device with `iwsdk-glasses-test`, every printed choice inside the glasses' view.
- **State:** the story clock, held objects and page-turn invitation are the same before and after any page.
- **The page:** Mac screenshots of every state at the three sizes; a judge's path unchanged (one tap to the chapter, no account, no microphone).
- **The headset (owner):** section 6, phase 5.

## 8. Risks

- **The fold doesn't restore.** Proved first, with the paper card as the noon fallback.
- **Troika text cost.** A spread is at most about ten text meshes, built when the page opens and disposed when it closes; telemetry's frame rate is watched in the emulator and in the owner's session.
- **Lanes B and D land late.** Every slot works with today's chapter 1 and today's Storyteller through stand-ins, so phase 5 swaps them in without layout work.
- **Removing the wrist tag.** The ribbon and cover are within reach by design; the system menu and taking the headset off still pause.
- **Shared `index.ts`.** Lane A owns the entry block and the menu wiring; lanes B and D hand in functions, not edits to that block. Conflicts are settled through the sprint master.

---

## Stage 3: build log

Stage 2 was approved with changes on Nov 16 (Codex: 1 P0, 9 P1, 1 P2). The big change: **the menus are a paper card that pops up from the spread**, standing and turned to face the reader, not type printed flat on the pages (flat type measured about 0.39° at 0.9 m). The API shapes and ownership are in `docs/plans/2026-11-16-finish-api-shapes.md` (approved, with amendment 1). Lanes B and D's stub types are copied verbatim into `client/src/stage/seams.ts`, which becomes re-exports when their PRs land (approved).

| Phase | What | Shown |
|---|---|---|
| 0 (00db10b) | `book/card-layout.ts` (pure layout, type at 1.2° of the eyes' distance, two choices to a row in 64 mm cells, More and Back paging) and `book/card-view.ts` (the paper card, troika type, gold rules, the pop-up fold, a measuring report). Review flags `?card=pause|busiest&bookscale=` | Emulator, measured from the head at book scales 0.6, 1.0 and 1.3: smallest type 1.04–1.10°, targets 64 mm apart, the card within ±10.2° across and +12.4/−13.8° of its centre (the glasses' view: 37°, +25°, −43°), at most 24.5° above the book's centre |
| 1 (42d37de) | `stage/book-menu.ts` (the menu's state machine: pause, contents, chapters, a chapter, the Storyteller, your stories, settings, the end card; Back; the ribbon's return to the root; a generation), the host wiring in `index.ts`, input cancellation (`hands.cancelAll`, `controls.cancelAll`, `gestures.drop`), the card's look-and-pinch captured at the pinch's start. The wrist tag and the sage tab removed | Emulator, emulated hands: right hand ribbon → left Contents → right Settings → left Sound → Back, Back → left Carry on; the story clock held at 16 915 ms throughout and ran on after |
| 2 | `landing/entry.ts` (the entry target), the page's button from `libraryState()` or the entry, Back to…, the reload for the other mode, the menu answering again after a return. On a Quest 3 the card answers hands only (a pinch in the air no longer chooses the line the head faces) | Emulator: Put the book away → the page offers Continue chapter 1 → Continue → the book re-arrives and carries on; Contents → the AI Storyteller → Start a new story → the book is put away, the page reloads set to the Storyteller ("Let them hear you", "Back to chapter 1"); Back → Continue chapter 1 |
| 4 (a2f85aa, 865d1f8) | The Storyteller door from the provider's state (lane D's revised table: mic-refused leads with Start a new story by hand; mic-not-asked offers "or play by hand"; offline and limit greyed with Open the book beside), re-checked on focus and the connection changing. Your book replaces Chapters: the shelf with actions, your finished stories with their lines, what you've kept by name (`landing/collection.ts`, tagged reads) | Every door state read back from the page (`?door=<state>`); Your book read back from the page |
| 5, part (e48c88a) | The room's light (dark or lighter, through the hands' fold), the ribbon's first-time hint (a standing card under the ribbon, until the first use), lane E's manifest and icon links | Emulator: the hint at 1.19°, gone for good after the first ribbon use |

### First-round user testing in the emulator (Nov 16, before the owner's headset)

A real dev build from this workspace, the IWSDK emulator with emulated hands only (no controllers), the backend on its mocks (no paid calls; `MOCK_PROFILE` normal and fail). Screenshots in `client/.proof/` in this workspace.

| Path | What happened | Result |
|---|---|---|
| First visit, end to end, touching nothing | Storage wiped; the page: "Open the book", "Chapter 1 takes about six minutes…", the Storyteller door ("Let them hear you", "or play by hand"). Into the book; the ribbon's hint standing (type 1.19°); chapter 1 played through with zero input and ended on its end card at 6:56 of show time ("The end of chapter 1", Read again, Put the book away); the hint folded away | Clean console. `pass-1-opening.png`, `pass-1-end-card.png` |
| Read again | Left hand on Read again: the chapter restarted from 0 | Clean |
| Pause mid-moment, ribbon | Either hand: ribbon → pause card → Contents → Settings → Sound, Room light → Back → Back → Carry on; the clock held throughout and ran on after | Clean. `pass-4-pause.png` |
| Holding something when a card opens | Right hand holding the lantern, left hand on the ribbon: nothing given, kept or dropped (no `object.handed` in the log); the right hand's later release chose nothing | Clean |
| The cover | Pause card up, then the cover shut by hand: the card folded away, the story stayed held; the cover reopened: the card came back; Carry on | Clean |
| Leaving and coming back | Put the book away → the page: "Continue chapter 1" → Continue → the book re-arrived and carried on. A reload mid-chapter → "Continue chapter 1" → resumed at the saved place (62 s). An XR exit (as the system menu does) → the page: "Continue chapter 1" | Clean |
| The AI Storyteller, by hand | "or play by hand" → the Storyteller started (review finding 1 fixed) with Hold to talk; ribbon → "End the story here" → its end card, the session let go, Hold to talk off, the clock frozen; Your stories listed it; Back; Tell another started a new story; Contents → Chapters → chapter 1 → Continue put the book away and the page reloaded set to chapter 1 with "Back to the AI Storyteller"; Back made the Storyteller the destination | Clean. `pass-2-story-end.png` |
| Failure: offline | The page offline: the door greyed ("No internet connection") with Open the book beside it; the chapter button unaffected; back online, the door returned | Clean |
| Failure: the AI failing | `MOCK_PROFILE=fail`: every story turn failed and the story went back to listening without a stall; "End the story here" ended it locally on its end card; Put the book away returned to the page | Only a telemetry 401 from restarting the backend mid-run (device tokens are per backend run) |
| Failure: microphone refused | The door's mic-refused state: "Start a new story" (by hand) with "Try the microphone again" | Clean |
| VR Glasses (gaze and pinch) | `metaVRGlasses` profile, gaze granted: look at the ribbon and pinch (right) → pause; look at Contents and pinch (left) → contents; Back; a pinch that started on Contents and ended looking at Put the book away chose Contents; a pinch looking past the card at the story did nothing. The card inside the glasses' view | Clean. `pass-3-glasses-contents.png` (before the fix below), `pass-3-glasses-pause.png` |

**Found and fixed in the pass:** the card drew under the pop-up set (each nested Group needed the card's render order); a long title left one word alone on its last line (titles now wrap to even lines); a waiting choice with nowhere to go back to showed "Back to chapter 1"; choosing the other mode from the page after a chapter ran forgot the choice across its reload; a stale Vite error overlay (from a mid-edit save) blocked the page until the dev runtime restarted (dev only). Sign-in cancelled isn't testable in this build (accounts are off until lane D turns them on).

**Waiting on:** lanes B and D's PRs (then `stage/seams.ts` becomes re-exports and the host takes `loadChapter`, the Storyteller session's `suspend`, `resume`, `end` and `title`, and the provider), lane D's sign-in behaviour for the bookplate, `/link/` and `/auth/return/`, and the owner's headset session.

**Found on the way:** the card's pop step went back down every other frame once it stood (fixed); the emulator's "grasp" anchor sits several centimetres from the closed pinch, so the checks aim by the measured pinch point.

**Known flake under load:** `tests/handover.test.ts` "during shore-walk" can pass its 5 s timeout in the full run while five lanes build on this machine (load average above 30); it passes on its own.

---

## The owner's headset script (live site)

One session, for feel, look and sound; every path below already passed in the emulator (see the progress section). About 25 minutes, seated at a table, hands only.

**Open it:** on the Quest, open **https://www.foldtales.xyz** in Quest Browser. First check it's the latest build: scroll to the AI Storyteller's shore; under its door there should be a quiet line, "The cast's voices … are made by AI, not people. Powered by Runway". If it isn't there, the latest deploy hasn't gone live yet: wait, and reload.

| # | Do | Look and listen for |
|---|---|---|
| 1 | On the page, look at the hero, then scroll to the Storyteller and the foot; open **Your book** | The one button says where you are ("Open the book", or "Continue chapter N"). The door says exactly what it needs (the microphone, or sign-in). Your book: each chapter with Start, Continue or Read again; your stories; what you've kept, by name. Nothing feels like a website about the product |
| 2 | **Open the book** and let it start | A small standing card by the ribbon: "Pinch the ribbon to pause". Easy to read, quiet enough not to steal the opening? |
| 3 | Pinch the **ribbon** (either hand) | A paper card pops up from the spread, turned to face you, and the story stops. The pop and its sound, the card's size, the type (easy to read without leaning in?), the gold rules. Not floating UI: it should feel like part of the book |
| 4 | **Contents → Settings**: Sound off, then on; Room: lighter, then dark. **Back, Back, Carry on** | Sound goes silent and comes back. The room's dim is lighter, then theatre-dark again. Carry on picks up on the same word, with nothing missed |
| 5 | Pick up something (the lantern, or a drawer object) and, holding it, pinch the ribbon with the other hand. Then shut the cover with the card up, and open it again | What you held goes back where it came from (not given, not dropped). The card folds away with the cover and stands up again when it opens |
| 6 | **Put the book away**, then tap **Continue** on the page | The book closes, the page shows "Continue chapter N" with where you stopped; one tap and the book arrives back at your place |
| 7 | Play to the end of the chapter | The end card: "The end of chapter N", what lasts, what you kept, then Continue to the next chapter (one tap on the page opens it) or Read again. Does it feel like an ending, not a stop? |
| 8 | Ribbon → **Contents → The AI Storyteller → Start a new story**; on the page, "Let them hear you" (or "or play by hand"); in the story, ribbon → **End the story here** → **Your stories** → **Tell another** | The book is put away and the page is ready for the Storyteller in one tap. Its pause card says "End the story here"; its end card has the story's title and what was painted; Hold to talk disappears while any card is up |

**Afterwards:** say what felt off in plain words; it goes in `docs/playtest-notes.md` under a dated lane A section.

---

## Review log

**Codex, stage 1 (Nov 15), with the sprint master's rulings:**

| # | Finding | Where it's answered |
|---|---|---|
| P0 1 | The layouts don't fit their own rules | 3.4: two choices a page, measured at 0.6×; phase 0 proves it before removals |
| P0 2 | No state model | 3.5 |
| P0 3 | Lane D's seam incomplete | 3.3, 3.4, 4.1, 4.3 with lane D's revised model |
| P0 4 | No durable navigation | 3.6; in-place mode switching cut |
| P1 5 | Gaze and pinch path | 4.2; checks in 7 |
| P1 6 | Freeze too broad | 5 and 6: the thin path on Nov 16, integration on Nov 17 |
| P1 7 | Collection and ending data seams | 3.1, 4.4, 4.6 |
| P1 8 | Sign-in surfaces missing | 1.1, 4.3 |
| P1 9 | Failure recovery undefined | 3.8, using lane D's retry and local ending |
| P1 10 | Settings scope | 3.1, 4.5 |
| P1 11 | First-time ribbon lesson too late | 3.7 |
| P1 12 | Decisions not covered | 3.1 |
