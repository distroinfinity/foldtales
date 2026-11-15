# Finish sprint, lane A: the product overhaul

**Stage 1: the walk and the structure.** Nov 15, 2026. Branch `finish-product-overhaul`. For the sprint master's Codex review and approval. No code yet.

**Read with:** `docs/plans/2026-11-15-finish-sprint.md` (the lanes and seams), ticket 7's "Foldtales as a complete product" in `docs/sprint-plan.md` (the brief and what to keep), `docs/design-language.md`, `docs/plans/2026-11-14-product-front-door.md` (today's page, approved Nov 14).

## The proposal in one paragraph

**The page is the front door, and the book is home.** You choose on the page the first time, because XR starts from a tap there and the microphone must be allowed there. Once you're inside, the book itself is the menu, the way Moss does it, with Beat Saber's structure: one way to pause that always looks the same, a contents page that is home, an end page that works like a results screen, and a small settings page. **One control opens all of it: the ribbon.** Pinch the ribbon and the story stops, the pop-ups fold down flat, and the open spread becomes a printed page of choices. Shutting the cover still pauses, as it does today. The wrist tag and the sage tab go. Everything you've gathered (keepsakes, things painted for you, each chapter's storybook page) lives in **your satchel** inside the book and in **Your book** on the page. Lanes B and D don't build menus: they hand the book what to print (a chapter's title, where you are, the end page's lines, the Storyteller's items) through one small controls API.

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
| **Bookplate** | `sheets.tsx` | Sign in (Google, phone code), signed-in state, sign out, delete. | Built, off. Lane D turns it on. Fine as a surface. |
| **About, Privacy** | `pages/` | Plain pages in the same look. | Privacy names the Storyteller's data. Needs the keepsakes line (they stay on the headset) and settings' "forget" once that exists. |
| **Desktop and phone** | `actions.tsx` | Same page, "Send to your Quest", copy and share. No 3D download. | Fine. |
| **Settings** | — | None. | No place to mute, change the dim, start the book over, or forget keepsakes without an account. |

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
| A main menu you always return to | The book is the menu | **The contents page**, printed in the book: home inside XR |
| Clear play modes (Solo, Campaign, Party) | — | **Two ways in**, always named the same: *Chapters* and *the AI Storyteller* |
| A library with packs | Chapters in a book | **The shelf**: books, then chapters, with "More chapters on the way" |
| A pause menu that's always the same | — | **The pause page**: one ribbon, the same four choices everywhere |
| A results screen | The page turns to the next chapter | **The end page**: what you did, what you kept, what's next |
| Settings | — | **A small settings page** in the book, and its twin on the page |
| A tutorial | Learn by doing | **No tutorial**: the story teaches by asking, and each control teaches itself once |

The look stays ours: printed paper, ink, gold rules. No panels.

---

## 3. The structure

### 3.1 The one decision: where you choose

**On the page the first time, and in the book after that.**

- **The page** chooses for the first entry, because XR only starts from a tap on the page, and the microphone must be allowed there (a first prompt inside XR ended the session twice). A judge still gets one tap.
- **The book** is home once you're inside. Its contents page lists every chapter and the AI Storyteller, so you never leave XR to choose.
- **Switching from a chapter to the Storyteller from inside the book** needs the microphone and today a fresh page load. So the book does it honestly: "The book closes, then opens the AI Storyteller." XR ends, the page comes back already set to the Storyteller with one tap to go ("Open the AI Storyteller"). If stage 2 finds the switch can happen in place (lane B's chapter loading may make the stage reusable), it skips the page. Chapter to chapter switches in place once lane B's engine loads chapters by number.

### 3.2 The surface map

```
FOLDTALES
│
├─ THE PAGE  (2D; every device)                         front door
│   ├─ Hero: the cover, the tagline, the one button     "Open the book" / "Continue chapter 2" / …
│   │    └─ under it: your second door                  "Or make up a story with the AI Storyteller"
│   ├─ The scroll (unchanged)
│   ├─ The AI Storyteller (the shore and its door)       lane D's words, lane A's door
│   ├─ Your book  (a paper sheet; replaces "Chapters")
│   │    ├─ The shelf: Tales from the Table's Edge, each chapter with Start / Continue / Read again
│   │    ├─ The AI Storyteller: Start a new story · your stories (lane D)
│   │    ├─ Your satchel: keepsakes and things painted for you, with names
│   │    └─ Settings: sound, the room's light, start the book over, forget what's kept
│   ├─ Bookplate (sign-in; lane D switches it on)
│   └─ Foot: Your book · The painted room · About · Privacy
│
├─ THE BOOK  (XR; the only UI inside)                   home
│   ├─ Arrival (unchanged)
│   ├─ The story: chapter or Storyteller
│   │    ├─ Cover: shut to pause, open to carry on
│   │    ├─ Ribbon: THE one control  ──►  the pause page
│   │    ├─ Spine: move · outer edges: stretch
│   │    ├─ Drawer pull · page edge · Hold to talk (Storyteller only)
│   │    └─ Caption band: story only · a quieter status line under it for the system
│   ├─ The pause page   Carry on · Start again · Contents · Settings · Close the book
│   ├─ The contents page (home)
│   │    ├─ Chapters, each with its state, and its storybook page once finished
│   │    ├─ The AI Storyteller
│   │    └─ Your satchel
│   ├─ The settings page  sound · room light · book size
│   └─ The end page (chapter or story)  what happened · what you kept · what's next
│
├─ ON YOU  nothing. The wrist tag goes.
│
└─ THE SYSTEM  Meta's menu (palm pinch, reserved) and headset off: always a pause, never lost
```

### 3.3 Shared vocabulary

Every lane uses these words, on the page and printed in the book.

| Say | Means | Don't say |
|---|---|---|
| **Foldtales** | the product | Tabletop Theater (repo only), the app |
| **the book** | the pop-up book in XR, and *Tales from the Table's Edge* | the scene, the stage, the experience |
| **chapter** | a written story, in order, about six minutes, hands only | episode, level |
| **the AI Storyteller** | the free mode | AI mode, playground, sandbox |
| **a story** | one Storyteller sitting, with its own title | session, evening, run |
| **Open the book** | enter XR | launch, start VR, play |
| **Continue** · **Start again** · **Read again** | resume · restart · replay a finished chapter | resume, restart, replay |
| **Carry on** | leave the pause page | resume, unpause |
| **the ribbon** | the one control | menu button |
| **the pause page** · **the contents** · **the end page** | the three printed pages | menu, HUD, results |
| **Close the book** | leave XR, with your place kept | quit, exit, put the book away |
| **your satchel** | everything you keep | inventory, catalog, collection |
| **keepsakes** · **things painted for you** · **storybook pages** | what's in it | items, assets, generations |
| **Your book** | the page's sheet: shelf, satchel, settings, and your account | library, dashboard, profile |
| **the painted room** | no-passthrough mode | VR mode |

Chapter titles come from the chapter's own data, everywhere. Chapter 1 is **"The night the light went out"** (from `episode-1.json`); `CHAPTERS` in `progress.ts` changes to match (lane B owns that file).

### 3.4 The flows

```
                      ┌──────────── desktop / phone ───────────► Send to your Quest
   link ──► THE PAGE ─┤
                      └── headset ── one tap ──┐
                         (mic asked here       │
                          for the Storyteller) ▼
                                         ARRIVAL ──► THE STORY ◄───────────────┐
                                                       │  │  │                 │
                               shut the cover ◄────────┘  │  └──► END PAGE ────┤ Read again /
                               (pause, nothing else)      │        │  │        │ Continue to chapter 2 /
                                                          ▼        │  │        │ New story
                                                    PAUSE PAGE ────┼──┼────────┘ Carry on / Start again
                                                     │     │       │  │
                                                     ▼     ▼       │  │
                                               SETTINGS  CONTENTS ◄┘  │
                                                           │          │
                       chapter ◄──── in place ─────────────┤          │
                       Storyteller ◄─ page, one tap ───────┘          │
                                                                      ▼
                                              CLOSE THE BOOK ──► THE PAGE, set to where you are
   system menu / headset off ──► paused, place kept ─────────────────► next evening: "Continue …"
```

- **Every page in the book has "Carry on" or a way back** in the same place (the top right line), and the ribbon always closes what's open.
- **Close the book** is on the pause page, the contents and the end page, always the last line.
- **Nothing autoplays the next chapter.** The end page offers it; you choose it.

### 3.5 Mockups

All pages inside the book are printed on the open spread while the pop-ups lie folded flat, in ink on page with gold rules for what you can pinch, at least 11 mm tall at reading distance. Sizes and the fold are proved in stage 2.

**The pause page** (pinch the ribbon; the pop-ups fold down, the lights come part way up):

```
 ┌──────────────────────────────┬──────────────────────────────┐
 │                              │                              │
 │  Tales from the Table's Edge │   Carry on                   │
 │  ─────────────────────────── │   ────────                   │
 │                              │   Start this chapter again   │
 │  Chapter 1                   │                              │
 │  The night the light         │   Contents                   │
 │  went out                    │                              │
 │                              │   Settings                   │
 │  Paused on the shore.        │                              │
 │                              │   Close the book             │
 │                              │                          ribbon▼
 └──────────────────────────────┴──────────────────────────────┘
```

In the Storyteller the left page names the story ("A key for the cellar", lane D) and the right page reads Carry on · **End this story** · Contents · Settings · Close the book. "Start again" becomes "End this story", which goes to its end page.

**The contents page** (home):

```
 ┌──────────────────────────────┬──────────────────────────────┐
 │  Contents                    │                   ◄ Back      │
 │  ─────────                   │                              │
 │  Tales from the Table's Edge │  The AI Storyteller          │
 │                              │  Talk to Pip, Wick and Moth, │
 │  1  The night the light      │  and make up a story.        │
 │     went out ·········· read │  Start a new story           │
 │  2  <title> ··· you're here  │  Continue "A key for the     │
 │  3  <title> ········· begin  │  cellar"                     │
 │  More chapters on the way.   │                              │
 │                              │  Your satchel ······ 7 things │
 │                              │  Close the book              │
 └──────────────────────────────┴──────────────────────────────┘
```

Pinch a finished chapter and its **storybook page** shows on the left page (the painted page composed from its sets, with what lasts), with "Read again" under it.

**The end page of a chapter** (the results screen; no score):

```
 ┌──────────────────────────────┬──────────────────────────────┐
 │  The end of chapter 1        │                              │
 │  ─────────────────────       │  Continue to chapter 2       │
 │  [the storybook page:        │  ─────────────────────       │
 │   painted from the sets]     │  Read it again               │
 │                              │                              │
 │  You gave Pip his lantern.   │  Contents                    │
 │  The kite carried him over   │                              │
 │  the gap.                    │  Close the book              │
 │  Wick handed over the lamp.  │                              │
 │                              │                              │
 │  Kept: the kite ⟶ satchel    │                              │
 └──────────────────────────────┴──────────────────────────────┘
```

The lines come from the chapter's recorded page (`page.composed`, lane B). In this build "Continue to chapter 2" appears once lane B ships it; until then the right page starts with "Read it again", and under the lines: "More chapters on the way."

**The end page of a story** (the Storyteller; lane D fills the words):

```
 ┌──────────────────────────────┬──────────────────────────────┐
 │  A key for the cellar        │                              │
 │  ─────────────────────       │  Start a new story           │
 │  Pip, Wick and Moth found    │  ─────────────────           │
 │  the old cellar door …       │  Contents                    │
 │                              │                              │
 │  Painted for you tonight:    │  Close the book              │
 │  the dragon kite, a teapot   │                              │
 │  called Shubham Mishra       │                              │
 │  ⟶ in your satchel           │                              │
 └──────────────────────────────┴──────────────────────────────┘
```

**Settings** (in the book: only what you'd change with the headset on):

```
 ┌──────────────────────────────┬──────────────────────────────┐
 │  Settings                    │                   ◄ Back      │
 │  ─────────                   │                              │
 │  Sound          on · off     │  The room's light            │
 │  ──                          │  dim · dimmer · darkest      │
 │  Book size      as it was    │                     ───────  │
 │                              │                              │
 └──────────────────────────────┴──────────────────────────────┘
```

Captions stay on: the story is printed, and captions are the accessibility promise. The page's settings (in **Your book**) add: start the book over, forget what's kept in your satchel, the microphone's state with how to change it, and (signed in) sign out and delete.

**The page, a returning reader** (the hero's button is where you are; your second door sits under it, not after the scroll):

```
                     Tales from the Table's Edge
     A living storybook on your table. Reach in and help the characters …

                   ┌──────────────────────────────┐
                   │     Continue chapter 2        │   rust
                   └──────────────────────────────┘
               You stopped on the shore · Start chapter 2 again
       Or make up a story with the AI Storyteller  ·  Your book
```

A first visit is unchanged: "Open the book", the detail line, and the Storyteller below the scroll as today. Once you've finished a chapter or played the Storyteller, the second door joins the hero at equal weight, as the PRD asks.

**Your book** (the paper sheet from the foot and the hero; replaces "Chapters"):

```
 ┌────────────────────────────────────────────┐
 │  Your book                              ×   │
 │  Tales from the Table's Edge                │
 │  1  The night the light went out    Read again
 │  2  <title>                         Continue │
 │  More chapters on the way.                  │
 │  ───────────────────────────────────────    │
 │  The AI Storyteller        Start a new story │
 │  A key for the cellar · Nov 15     Continue  │
 │  ───────────────────────────────────────    │
 │  Your satchel                               │
 │  [kite] [spool] [dragon kite] [teapot] …    │
 │  Kept on this headset.                      │
 │  ───────────────────────────────────────    │
 │  Settings   Sound · Room light · Start the book over · Forget what's kept
 └────────────────────────────────────────────┘
```

Every line with an action opens the book there in one tap (it's a tap on the page, so XR starts inside it). On a desktop or phone the sheet shows the shelf and the satchel read-only, with "Send to your Quest".

### 3.6 The first time

No instructions screen. Each thing teaches itself once, then never again (kept per headset, like the wrist hint today).

- **Reach in, pinch, hand over:** the story asks (Pip's lantern at about 0:50). Unchanged.
- **Turn the page:** printed when it's time. Unchanged.
- **The ribbon:** the first time the book opens, the ribbon lifts and settles once with a soft felt sound and a gold edge, as the arrival's words fade. The first pause page ever adds one line: "Pinch the ribbon any time to stop here."
- **Talk:** the Storyteller teaches it in the cast's own words (lane D), with "Hold to talk" on its button.
- **Leaving:** "Close the book" is on every printed page; the end page is the first place most people see it.

### 3.7 When things go wrong

Two rules: **story on the caption band, system on a quieter status line just under it** (smaller, ink at 70%, no pulse, never over the story's words), and **never a dead end**: every message says what to do.

| Moment | Where | What it says |
|---|---|---|
| Cold start, art didn't load | page button | "The book didn't load. Check your connection, then reload the page." (today) |
| XR refused | page | "Your browser didn't open the book. Tap to try again." (today) |
| No passthrough | page | Opens the painted room. (today) |
| No WebXR | page | The desktop page, "Send to your Quest". (today) |
| Offline, chapter | book | Plays as authored. Nothing to say. |
| Offline, the Storyteller door | page | The door checks before XR: "The AI Storyteller needs the internet. The chapters don't." with "Open the book" beside it. |
| Offline mid-story | status line | "The connection dropped. They'll wait for you." Then the pause page offers Carry on (retry) · Contents · Close the book. |
| AI slow | the story | The cast covers it (lane D). If a turn takes over 12 s, the status line: "Still thinking…". |
| AI failing, or at the evening's cap | status line, then end page | "The Storyteller needs a rest tonight." The story goes to its end page; chapters stay open. Lane D sets the words and the caps. |
| Mic refused | page door, status line | Page: the door says how to allow it (today). Inside: "They can't hear you. Allow the microphone on the page outside the book." |
| Not signed in (accounts on) | page door | "Sign in to start", before XR. Never in XR. |
| Headset off, hands lost, system menu | book | Paused, place kept, the ribbon lifted. On return the pause page shows. |

---

## 4. The seams

### 4.1 One controls API (for lanes B and D)

A new module, `client/src/stage/book-menu.ts`, owned by lane A. It draws every printed page, handles the ribbon, and runs the shared actions. Modes describe themselves; they never draw a menu or add a control.

```ts
/** What a mode tells the book about itself. Chapters (lane B) and the Storyteller (lane D) each supply one. */
export interface ModeSheet {
  kind: 'chapter' | 'storyteller';
  /** Left page of the pause page: "Chapter 2" + "<title>", or the story's title. */
  heading(): { over: string | null; title: string };
  /** "Paused on the shore." or null. */
  where(): string | null;
  /** The pause page's second line: "Start this chapter again", or "End this story". */
  again: { label: string; run(): void };
}

/** What an ending prints. Lane B for chapters, lane D for stories. */
export interface EndSheet {
  heading: string;                       // "The end of chapter 1" / the story's title
  lines: string[];                       // at most 4, from the recorded page
  kept: string[];                        // object ids that went into the satchel
  art?: string[];                        // the storybook page's pictures
  next: Array<{ label: string; run(): void }>;  // primary first: "Continue to chapter 2", "Read it again" / "Start a new story"
}

export interface BookMenu {
  /** The running mode registers itself once. */
  setMode(sheet: ModeSheet): void;
  /** Show the end page. Contents and Close the book are added by the menu. */
  showEnd(end: EndSheet): void;
  /** System words on the status line (null clears it). Never narration. */
  status(text: string | null): void;
  /** For code that must stop the story: the same pause as the ribbon, with or without its page. */
  pause(withPage: boolean): void;
  carryOn(): void;
  /** Close the book: the cover shuts, the place is saved, XR ends, the page lands where you are. */
  closeTheBook(): void;
  /** Go to a chapter or the Storyteller. In place when the stage allows it, otherwise through the page with one tap. */
  open(target: EnterTarget): void;
  readonly paused: boolean;
}
```

- `EnterTarget` is today's type from `progress.ts`. No new shapes cross the seam.
- The **Storyteller's place in the controls** is: its `ModeSheet`, its `EndSheet`, the status line, and "Hold to talk", which stays on the table in front of the book and hides on any pause (today's behaviour).
- `pause.set('ribbon', …)`, `controls.setRibbon` and the wrist's `choose()` stop being called from anywhere but `book-menu.ts`.

### 4.2 Chapters (lane B)

- **Where chapters show:** the page's hero button, its detail line, **Your book**'s shelf, the in-book contents, and the end page. All of them read `libraryState()` and nothing else. The page stops reading `index.ts`'s own labels.
- **What I ask of `libraryState()`** (through the sprint master, additive and optional, so nothing breaks): per chapter, `where?: string` ("on the shore"), for "You stopped on the shore" and "Paused on the shore". If lane B doesn't add it, the line is left out.
- **What lane B calls:** `menu.setMode()` when a chapter starts, `menu.showEnd()` when it ends, with lines from the recorded page and "Continue to chapter N+1" as the first `next` when it exists. `menu.open({ kind: 'chapter', n, from })` for "Continue to chapter 2" if lane B prefers the menu to run it.
- **What lane B owns that lane A reads:** `CHAPTERS` titles (and the chapter 1 title fix), loading chapter `n` from `EnterTarget`, the saved place per chapter.

### 4.3 The AI Storyteller (lane D)

- **The door on the page:** lane A's component with fixed states, in this order: *needs sign-in* → *offline* → *needs the microphone* → *ready* → *continue a story* (when `libraryState().storyteller.sessions` has one). Lane D supplies the words for each state in `page-content.json`'s `storyteller` block, and fills `sessions` (it's empty today).
- **Its place in the hero:** a returning reader sees it under the one button, as in the mockup.
- **Inside the book:** its `ModeSheet` (the story's title; "End this story"), its `EndSheet` (title, a few lines, what was painted), and `menu.status()` for listening, offline, slow and failed. Lane D stops writing system words through `runtime.setHint()`.
- **The contents page's Storyteller block:** "Start a new story", and "Continue <title>" for the last story if lane D can resume one.

### 4.4 Lane E

- The status line and every printed page follow the 11 mm and 4.5:1 rules, for lane E's accessibility pass.
- "Sound off" in settings is one switch on the sound engine's master gain, for lane E's music bed too.

### 4.5 Contracts

**None needed for this lane.** Everything above is client-side. `LibraryState`'s optional `where` lives in `client/src/show/progress.ts`, not in `contracts`.

---

## 5. What ships by the Nov 17 freeze, and what's later

| By | What | Why |
|---|---|---|
| **Nov 16, first** | The `book-menu.ts` API with the ribbon driving it, the pause page (Carry on, Start again, Close the book), the status line, the page reading only `libraryState()`. The wrist tag and the sage tab removed. | The seams lanes B and D build into. |
| **Nov 16** | The end page for chapters, from the recorded page, with "Read it again", "Close the book" and the slot for "Continue to chapter 2". The page's hero for returning readers, with the second door. The Storyteller door's states including offline. | The results screen and the front door are what a judge sees. |
| **Nov 17** | The contents page (chapters, Storyteller, satchel count). **Your book** sheet (shelf with actions, satchel pictures, page settings). In-book settings (sound, room light, book size). The ribbon's first-time lift. The Storyteller's end page with lane D's words. The failure lines. | Completes the structure. |
| **Nov 17, if time** | Each finished chapter's storybook page shown from the contents. Chapter-to-Storyteller switching in place. | Nice, not needed for a judge. |
| **Later** (to `docs/v2-ideas.md`) | Room effects your room has seen, and asking for one from the contents. Browsing the satchel inside the book page by page, with each thing's history. Bringing a keepsake back from the contents into a story. The satchel following your account. Per-thing delete. | Each needs content or backend work that doesn't fit by Nov 17. |

**Art:** no paid art planned. The pages are printed in type on the book's existing page art, with the gold rules the end page already uses. Runs 025 and 026 stay unspent unless the headset shows the printed pages need a painted ornament; any run gets a plan and an estimate first.

---

## 6. Open questions, each with my recommendation

| Question | Recommendation |
|---|---|
| Do the pop-ups fold flat for the pause page, or does the page print on a paper card over the set? | **Fold flat.** It's the book's own motion, so it reads as the book and leaves the whole spread for type. Proved in the emulator first in stage 2; the card is the fallback. |
| Does the ribbon also pause without the page, as today? | **No.** The ribbon always opens the pause page; shutting the cover is the pause without a page. One meaning per control. |
| The gold tab: keep it? | **Keep it as the satchel's latch.** It opens a thing, not a menu, like the drawer pull. |
| Chapter to Storyteller from inside the book: through the page? | **Yes, through the page with one tap**, for Nov 17. In place only if stage 2 shows it's safe. |
| Does the Storyteller get an ending? | **Yes: "End this story"** on its pause page, and its end page. Lane D decides whether the cast can also end a story on its own. |

## 7. Risks

- **Printed text on the spread at book scale.** 11 mm type fits about 8 lines a page at full size, fewer at 0.6×. The pages are laid out for the smallest size, and the book's stretch is clamped while a printed page shows.
- **Pinch targets on paper.** Today's 64 mm rule fits five lines a page. The pause page has five; contents has the most and is laid out first.
- **Removing the wrist tag removes the only pause that works with the book out of reach.** The cover and ribbon are within 0.6 m by design, and the system menu and headset-off still pause.
- **Lane B and D timing.** The menu works with today's single chapter and today's Storyteller from the first day, so nobody waits on anyone.
