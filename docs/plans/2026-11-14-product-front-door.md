# The product around the book: front door, library, sign-in and journeys

**Status:** Approved by the owner on Nov 14, after two Codex reviews (24 findings, all taken; see the review log). Every decision below was made with the owner on question cards. Building Phase 0 and Phase 1.

**Goal.** In the owner's words: "Currently I land on the page. It's one random book with a start story. This is not a finished product." There's "no information flow and there's a lot of cognitive load on me when I'm landing … it doesn't give or convey a planned product." This work gives Tabletop Theater a clear identity, a library a newcomer understands at a glance, sign-in that remembers you, and one calm path from the first link to coming back night after night. It covers the Quest, a desktop or phone, and a judge opening the link cold.

**Read with:** `docs/prd.md`, `docs/design-language.md`, `docs/technical-design.md` (Backend and hosting), `docs/sprint-plan.md` (the new ticket 7), ticket 3's plan on its branch.

## Decisions made with the owner (Nov 14)

| Question | Decision |
|---|---|
| What is it? | **An interactive storybook**, with the AI Storyteller blended in. Not a game: no score, no losing. |
| Tagline (form and page, ≤140) | "A living storybook on your table. Reach in and help the characters through each chapter, or make up a new story with the AI Storyteller." (136) |
| The book's name | **Tales from the Table's Edge**. It replaces "The Lighthouse at the Edge of the Table", which read like a chapter. Tabletop Theater stays the product. |
| The two ways in | **Chapters** (written, theatrical, in order) and the **AI Storyteller** (free play: talk to the cast, hand them anything, and the AI makes up the story live, voiced). This matches ticket 3's change after its first headset session: the AI no longer goes into the written chapters. |
| How the two sit on the landing | **The chapters lead, the AI Storyteller sits beside them.** On a first visit, "Open the book" is the one big action. The AI Storyteller is a clear second door below it. After chapter 1, both carry equal weight. |
| Chapters that aren't written yet | **Only what exists**, plus one line: "More chapters on the way." |
| Sign-up | **Real accounts.** Asked on the first visit as one quiet line under the button ("No account needed. Sign in to keep your book."), which opens the bookplate, so skipping costs nothing: you just open the book. |
| The landing page | **Small and crisp, and it demonstrates the product as you scroll, the way Apple's product pages do** (owner, Nov 14). One page for every device: the hero gives the one action, and the scroll opens the real pop-up book. |
| How you sign in from a headset | **A code on the page, finished on your phone**, or **Continue with Google** right in the headset. On the phone you can use Google or an email code. |
| Does the AI Storyteller need sign-in? | **Always.** The chapters never do. |
| UI libraries | **Both:** React, Tailwind and Magic UI (MIT) for the 2D pages, restyled to the painted look. The lighthouse effects (the beam, the lantern pool, dust and stars) are hand-built in CSS and canvas, inspired by Aceternity's Lamp and Spotlight, so there's no licence question. |
| Setup | **All of it, starting today:** hosting unheld, a domain, a Google sign-in client, and Resend for email codes. Your checklist is below. |
| Business model | **All free for now**, since it's a competition entry. The PRD's open question becomes "free during the competition; decided after". |

## What we learned from other products

The full research is in this session's notes. The points that shaped this plan:

- **Moss:** the book is the menu and the loading screen, and you're "the Reader". The web page should feel like the same book, not a website about it.
- **Meta's own sign-in, YouTube on Quest, Supernatural:** never ask for typing in the headset. The headset shows a short code, and the phone finishes. Nobody signs up before they've played.
- **Calm Sleep Stories:** a "tonight" slot that changes, over a stable library. No streaks: guilt doesn't fit an unwinding ritual.
- **Netflix, and the UChicago autoplay study:** resume is the first thing you see. No autoplay into the next chapter; the chapter ends, and you close the book.
- **Hidden Door and Calm:** name the doorway and the ritual, not the model. The AI is said once, plainly.
- **Meta's Web Launch link** (`oculus.com/open_url/?url=…`): a desktop or phone visitor gets a real "Send to your Quest" button.
- **Apple's product pages (AirPods, Vision Pro):** the hero gives the name, one line and one action, with the product as the picture. Then a pinned stage that scrolling scrubs, one short headline per moment, the action repeated at the end, and stills where motion doesn't fit. We take the shape, and scrub real paper layers instead of video frames.
- **Quest Browser:** its default window is 1280 × 670, landscape and short. Gaze doesn't fire hover. Targets need at least 48 px, and ours are 64 px as in the book.

## The shape of the product

```
Tabletop Theater                     the product, and the brand on every page
├─ Tales from the Table's Edge       the book: Pip, Wick and Moth, the Lost and Found
│   ├─ Chapter 1  The lamp goes out          written, ~6 min, hands only
│   ├─ more chapters as the owner writes them (only chapter 1 is in this build)
│   └─ "More chapters on the way."
└─ AI Storyteller                    free play with the same cast and sets, voiced live
    └─ your stories                  sessions you've played, kept with your account
```

- **"Chapter"** means a written story, always in order, always hands-only, no account.
- **"AI Storyteller"** is always introduced with one line: "Talk to Pip, Wick and Moth, hand them anything, and the AI makes up the story as you go."
- **"Your book"** is what an account keeps: where you are and what you've finished, on any headset, plus your key to the AI Storyteller. Keepsakes from the chapters stay on the headset they were found on for now: with one chapter in the build, nothing needs them elsewhere yet (see the review log, round 2).
- More books later get their own cover on the same page. There are no empty shelf slots in v1.

## The screens

All 2D pages share one look (see "The look"). Sketches are approximate. They're laid out for the Quest's 1280 × 670 window first, with the phone and desktop shown where they differ.

### 1. The page: one short scroll that shows the product (owner, Nov 14)

The owner's direction: "small, crisp, and actually demonstrate or give you a feel for the product as you scroll … like Apple does." So there's **one page for every device**. A short hero gives the one action, and below it a pinned stage that your scrolling scrubs, as on Apple's AirPods and Vision Pro pages. Apple scrubs pre-rendered frames. Our product is already layers of painted card, so the scroll **opens the real pop-up book with the real art**: cover, set layers, Pip's pieces, the lamp. That's honest, cheap (no credits, no footage needed), and it's what you'll see in the headset.

**Five beats, about four screens of scrolling in all:**

```
 ┌ 0. Hero (one screen) ─────────────────────────────────────────────────────┐
 │ Tabletop Theater                                               Sign in    │
 │                                                                           │
 │   (closed cover, lying in the lamp's pool)    Tales from the Table's Edge │
 │                                               A living storybook on your  │
 │                                               table. Reach in and help …  │
 │                                               [   Open the book   ]       │
 │                                               Chapter 1 · about 6 min ·   │
 │                                               hands only                  │
 │                                               No account needed. Sign in  │
 │                                               to keep your book.          │
 │                          ˅  scroll                                        │
 └───────────────────────────────────────────────────────────────────────────┘
 ┌ 1. "It opens on your table." (pinned while you scroll) ───────────────────┐
 │  The cover swings open toward you, and the shore's layers stand up one by │
 │  one, sky, headland, dunes, foreground, each with its own parallax. The   │
 │  edges of the page dim, as your room does.                                │
 └───────────────────────────────────────────────────────────────────────────┘
 ┌ 2. "Reach in." ───────────────────────────────────────────────────────────┐
 │  Pip stands on the page with the lantern. A gust: the flame goes out. As  │
 │  you scroll, the lantern drifts in from your side of the page into his    │
 │  paws, and the glow comes back.  "Hand them what they need."              │
 └───────────────────────────────────────────────────────────────────────────┘
 ┌ 3. "The lighthouse lights your room." ────────────────────────────────────┐
 │  The page turns to the lamp at dusk. The lamp relights, and its beam      │
 │  sweeps across the whole page, past the edges of the book. The one big,   │
 │  bold moment of the page.                                                 │
 └───────────────────────────────────────────────────────────────────────────┘
 ┌ 4. "Or make up a new story, out loud." ───────────────────────────────────┐
 │  Pip, Wick and Moth on the shore. A caption types itself: "The Giant's    │
 │  cup!" Lost things drift onto the page (kite, spool, key). "The AI        │
 │  Storyteller: talk to the cast, hand them anything, and the AI makes up   │
 │  the story as you go."  [ Sign in to start ] / [ Start ]                  │
 └───────────────────────────────────────────────────────────────────────────┘
 ┌ 5. End ───────────────────────────────────────────────────────────────────┐
 │  [ Open the book ]  (or Send to your Quest)                               │
 │  What you need: a Meta Quest 3 or 3S · a table, or the painted room ·     │
 │  about 6 minutes · just your hands                                        │
 │  Chapters      No table? Read in the painted room      About   Privacy    │
 └───────────────────────────────────────────────────────────────────────────┘
```

- **The one action is the first thing you see,** in the hero. On a headset it's "Open the book", and a judge is still one tap from the story. Scrolling is for the curious; nobody has to.
- **Sign-in is one quiet line under the button** ("No account needed. Sign in to keep your book."). Tapping it opens the bookplate (screen 5). This keeps the hero crisp; the owner's earlier pick put the full panel there, so it's on the approval card.
- **Each beat has one headline of a few words,** arriving as the picture reaches it, and at most one line under it. No feature lists.
- **The stage is pinned while its beat plays,** and the scroll position drives every layer (cover angle, layer rise, lantern glow, beam angle). It runs both ways, so scrolling back closes the book again.
- **On the Quest's 1280 × 670 window** the stage sits left and the headline right. On a phone they stack, with the stage on top.
- **Reduced motion, or a very small screen:** each beat shows one still painted moment instead of a scrubbed one.
- **The beam is the one moment of spectacle** (Aceternity's Lamp, rebuilt). Everything else moves only because you scroll.
- **The trailer** (ticket 6) later goes behind a small "Watch the film" link in the hero (Magic UI's Hero Video Dialog), not in place of the scroll.

### 2. Back mid-chapter

```
         [   Continue chapter 1   ]
         You left Pip on the shore.          ← if ticket 3 exposes where; otherwise omitted
         Start chapter 1 again
```

The saved place lasts 30 days. If there's none (older, or cleared) but you'd started, the button reads "Start chapter 1 again", never "Open the book" as if you were new. Ticket 3 builds this into `libraryState()`.

### 3. Back after finishing a chapter

```
         [   Continue to chapter 2   ]       (or, while chapter 2 isn't in the build:)
         Chapter 2 · about 6 minutes          [ Read chapter 1 again ]
                                              More chapters on the way.
         ┌ AI Storyteller ───────────────┐  ← now at equal weight with the button
         │ … [ Start the AI Storyteller ] │
```

There's no autoplay into the next chapter, and no "come back tomorrow" gate. A judge can go straight on.

### 4. The AI Storyteller's door

It has three states. Each one says exactly what's missing, and nothing is ever a dead button.

```
 Guest:        AI Storyteller                         Signed in, mic not yet asked:
               …makes up the story as you go.         AI Storyteller
               [ Sign in to start ] → opens the       ✓ Signed in as Sam
                 bookplate                            [ Let them hear you ]  (mic prompt)
                                                      You talk to the characters out loud.
                                                      Your voice goes to a cloud service
                                                      to be understood, and isn't kept.

 Ready:        AI Storyteller
               ✓ Signed in as Sam   ✓ They can hear you
               [ Start the AI Storyteller ]   (enters XR in this tap)
               Your stories: The spool's story · Moth and the brass key   ← only if ticket 3
                                                            saves stories (not promised)
```

The microphone is asked on this page, before XR, because a first prompt inside XR ended the session (measured twice). If you say no, the door reads: "The AI Storyteller needs your voice. Allow the microphone in the browser's settings, then try again."

### 5. Signing in (the bookplate)

```
 Use your phone:                              On the phone (tabletop.…/link), three steps:
 ╭ Put your name in the book ─────────╮        1. Enter the code from your headset
 │ On your phone, go to               │           [ K X T R - 4 9 Q M ]  (prefilled from ?code=)
 │      tabletop…/link                │        2. Sign in:  [ G  Continue with Google ]
 │ and enter                          │                     [ Email me a code ]
 │      KXTR-49QM                     │           (the code is kept through sign-in)
 │ Waiting for your phone…            │        3. Sign in your headset as sam@…?
 │ Cancel                             │           [ Yes, sign it in ]   No, that's not mine
 ╰────────────────────────────────────╯        → "Your headset is signed in. You can put
                                                  your phone away."

 Signed in:  ╭ This book belongs to Sam ╮   Sign out · Delete my book
```

- **Continue with Google** in the headset is a full-page trip that starts and ends on the API's own address, so Google's security cookie stays on one site: the button navigates to `api…/v1/auth/google/start`, Google comes back to the API, and the API then sends you to the landing's `auth/return/` page with a one-time code. That page trades the code for the session token, removes it from the address, and reloads the landing. No cross-site request ever needs cookies. Whether Google allows sign-in in Quest Browser is the one thing to check in the headset.
- **The code** lasts 10 minutes. The headset asks every 5 seconds, and slows down if the server says so. Each outcome has its own line on the bookplate:
  - approved: the panel turns into the signed-in bookplate, with no reload;
  - "No" on the phone: "That sign-in was declined on your phone", and a new code;
  - expired: "That code expired, so here's a new one";
  - Cancel: the bookplate goes back to its two buttons.
- **Signing in keeps what you've already done.** This headset's guest book is merged into your account's book, and nothing finished is ever lost (merge rules under "How it's built"). Then the page reloads: it's the simplest way to be sure nothing of the previous reader is still running.
- **Sign out** saves your book to your account first, then leaves this headset with a fresh guest book and reloads, so the next person doesn't inherit yours. Offline, it asks: "You're offline, so your last few minutes aren't saved to your account. Sign out anyway?" [Sign out anyway] [Stay signed in]. Signing out anyway drops that unsaved work, and it's never uploaded later.
- **Delete my book** asks once. If your sign-in is more than a day old, it first asks you to sign in again (the same code or Google), then deletes. It removes the account, its book and its device links on the server, clears this headset, and reloads.

### 6. Chapters (from the foot)

A paper sheet rises over the page: the book's contents, printed.

```
 Tales from the Table's Edge
 ─────────────────────────────
 Chapters
   1  The lamp goes out ............ read       [Read again]
   More chapters on the way.          (later chapters appear here as they're written)

 AI Storyteller
   Your stories ..................... 2
```

Numbers are used here because the chapters really are a sequence.

### 7. A desktop or phone visitor

The same page, with the same scroll demo. Only the actions change, and the 3D book is never downloaded:

- the hero's and the end's button becomes **"Send to your Quest"** (Meta's Web Launch link), with "Copy the link" beside it, and "Share the link" on phones that support it;
- under it: "Opens in your Meta Quest's browser. Just your hands, about 6 minutes.";
- the AI Storyteller beat's button becomes "Send to your Quest" too;
- the foot gains "Open it here anyway", for a wrong guess.

If someone isn't signed in to Meta in that browser, Meta's own page handles it; we never show a dead end.

### 8. About and credits, and privacy

- **About:** what Tabletop Theater is (the tagline plus four plain lines), who made it, the competition, and the credits from `CREDITS.md` (fonts, libraries, sound, how the art was made with AI).
- **Privacy:** what's kept and where: your book on this headset and, if you sign in, on our server, with your email and name from Google or the email code. In the AI Storyteller: your voice goes to a speech service and isn't kept; the shapes of your room (table, couch, walls, from Space Setup) are described to the AI; and, only if ticket 3 ships the camera, one picture of the thing you hold up goes to the AI after you agree. The page is written last, from what actually ships. How to delete your book.
- Both are reached from the foot of every page.

### 9. When things go wrong

| Moment | What the page says |
|---|---|
| The art didn't load | "The book didn't load. Check your connection, then reload." [Reload] |
| No internet, AI Storyteller | "The AI Storyteller needs the internet. Check your connection, then try again." (Opening a chapter offline from a cold start depends on ticket 6's offline cache, so the page doesn't promise it.) |
| Sign-in failed | "Couldn't sign you in. Try again, or use your phone instead." |
| Code expired | A new code appears on its own: "That code expired, so here's a new one." |
| XR refused to start | After a tap, the page stays on "Opening the book…". If the browser's request has settled and no session came (IWSDK swallows the error, so the landing watches for that), it says: "Your browser didn't open the book. Tap to try again." The retry is a fresh tap, so XR still starts inside it. |

## The journeys

**A first visit on a Quest.** The link opens on the hero: the closed cover in the lamp's pool, the title, one line, and the one rust button, "Open the book", with chapter 1, about 6 minutes, hands only under it. A curious reader scrolls and watches the book open, Pip's lantern come back, the beam sweep, and the AI Storyteller, then finds the same button at the end. Either way, one tap puts the book on your table (ticket 1's opening). No sign-in, no choices.

**A visitor on a desktop or phone.** The same hero and the same scroll, so they see what it is and how it feels. The button says "Send to your Quest", with the link to copy or share beside it. Nothing pretends to start.

**Back mid-chapter.** "Continue chapter 1" is the button, with "You left Pip on the shore" if ticket 3 can tell us where. "Start chapter 1 again" sits quietly under it. If they signed in last time, the bookplate says whose book it is.

**Back after a finished chapter.** "Read chapter 1 again" with "More chapters on the way." in this build ("Continue to chapter 2" once the owner's next chapter is in), and the AI Storyteller beside it at equal weight. Chapters in the foot shows what's read.

**What the AI Storyteller is** (ticket 3's concept, approved by the owner, `docs/plans/2026-11-14-ai-storyteller.md` on their branch): the cast is voiced live and also stages the world (moves, pages, light, the beam); your real room is in the story (couch, table, walls); show them a real object and a painted version appears (camera, still to be proven on the Quest); imagine anything and it appears. The front page's "An evening with the book" uses its hero moment: you hold up your real mug, and Pip gasps "The Giant's cup!" The door's line stays as approved, and follows what's actually built when it ships.

**Into the AI Storyteller.** Sign in (bookplate), let them hear you (one tap, the browser asks), then "Start the AI Storyteller", which enters XR straight into it (a request to ticket 3).

**Your book on a second headset.** Open the link on the new headset, sign in with the same Google account or the phone code, and the landing shows where you were: the chapters you've finished, and your place in one you started. The keepsakes from a chapter stay on the headset they were found on, and the bookplate says so.

**A judge opening the submitted link cold.** On the Quest, this is the first visit above: one tap to the story, and nothing to fill in. If they open it on a laptop first (from Devpost), they get the front page and "Send to your Quest". To try the AI Storyteller they sign in, and Google in the headset is the fastest path. The submission form's instructions should say so in one line.

## The look

The 2D pages are the cover of the same book, at night. They follow `docs/design-language.md`.

- **Colour:** night navy `#1F2A44` and the table's deep night `#151C2E` as the ground, page `#F6EFE2` for paper (the bookplate, the contents sheet), ink `#2B2420` on paper, lamp gold `#D4A23E` for light and links, fox rust `#B5502E` for the one button, sea sage `#76917D` for the AI Storyteller's door (the book's sage tab).
- **Type:** Fraunces for titles, set large and soft. Atkinson Hyperlegible Next for everything else, at 18 px or more on the Quest. Sentence case, no all-caps labels.
- **Layout:** the book left and the words right on wide windows, stacked on narrow ones. Words are left-aligned beside the book, and the hero stacks centred on a phone.
- **Spend the boldness in one place:** the beam's sweep in beat 3. The hero is still and calm. The other beats move only because you scroll, and the bookplate and contents sheet move only when you open them.
- **From the libraries:** Magic UI's Blur Fade and Text Animate for the title and tagline arriving after the beam, its Shimmer Button's gleam on the one button (once, slowly), and Particles as a few drifting motes in the lamp's light. The hand-built pieces are the beam (a conic gradient, like Aceternity's Lamp) and the lamp pool (a radial light following the cover, like its Spotlight). Hero Video Dialog holds the trailer once it exists.
- **Reduced motion:** the beam doesn't sweep; the page opens lit.
- **The look bar applies:** no placeholder art, no test text, and every frame fit for the video.

## How it's built

| Unit | Does | Where |
|---|---|---|
| **A light first entry** | `index.html` loads a small `main.ts`, not today's `index.ts`. It runs the device check and mounts the 2D app. Only a headset then `import()`s `index.ts`, which brings IWSDK, the stage and the art, so a phone never downloads the 3D code. Until that module is ready, the button shows "Getting the book ready", as today. | `client/src/main.ts`, `client/index.html` |
| **Device check** | Decided in this order. (1) `?page=front` or `?page=landing` forces one. (2) A headset browser's name in the user agent (`OculusBrowser`, `Quest`, `Pico`, `Wolvic`) means headset, even in its mobile mode. (3) A phone or tablet (Android, iPhone, iPad) means the front page, even if it supports AR. (4) Otherwise, `navigator.xr` supporting `immersive-vr` means a headset, which covers PC VR and the IWSDK emulator in dev. (5) No answer within 1.5 s, or an error, means the front page. The front page always has "Open it here anyway" in its foot, so a wrong guess is never a dead end. | `client/src/landing/device.ts` |
| **The scroll stage** | One pinned stage per beat. A small scroll handler (motion's `useScroll`, not CSS scroll timelines, which Firefox lacks) sets one progress value per beat, and CSS 3D transforms read it: cover angle, each layer's rise, Pip's lantern glow, the beam's angle. Built from the real art, resized to web WebP at build time with `sharp` (about 1000 px wide, a few hundred KB in all). Rebuilt in the product's own code, not imported from `art/m1-proof.html`, which stays a reference. | `client/src/landing/stage/`, `tools/web-art.ts` |
| **2D app** | React, Tailwind v4 and Magic UI components, mounted into `#landing`. `setLandingState()` keeps its exact API (index.ts keeps calling it) and now feeds a small store the React tree reads. Added beside it: `setLibrary(state)`, `setEnter(fn)`, and a watcher on the XR request, so "Opening the book…" can turn into "Tap to try again" when no session comes. | `client/src/landing/` |
| **Pages** | Extra Vite entries with no IWSDK: `link/` (phone approval), `about/`, `privacy/`, `auth/return/` (finishes Google sign-in). | `client/<page>/index.html`, `client/vite.config.ts` (inputs only) |
| **Library shim** | `libraryState()` with the shape agreed with ticket 3 (below), built from today's `progress.ts` until theirs lands | `client/src/landing/library.ts` |
| **Who's calling** | One rule in the guard. The device token stays exactly as today, in `Authorization`, on every call. A signed-in client also sends `x-tabletop-session: <token>`, allowed in CORS. The guard hands Better Auth that token as a bearer and gets back `userId`. **Only a valid session means an account**: the owner is `user:<id>` with a valid session, otherwise `device:<id>`, and a device link never grants account access on its own. An expired or revoked session makes you a guest again; the landing then says "Sign in again to keep your book in sync". AI routes (including ticket 3's `storyTurn`, `paintProp`, `paintResult` and `soundEffect`) need a `userId` and are capped per user. | `backend/src/guard.ts`, `client/src/backend.ts` (a session getter beside the device token) |
| **Accounts** | Better Auth inside the Hono backend, with its own tables in the same `node:sqlite` file, migrated at start-up. Plugins: device authorization (the code), email OTP (on the phone), Google, bearer, one-time token. No anonymous plugin: today's device token already is the guest. User deletion switched on, with a one-day freshness window. | `backend/src/auth/` (new) |
| **Middleware order** | Today every `/v1/*` call must carry the contract header, which a browser's trip back from Google can't. The app becomes: CORS first; then the auth routes at `/v1/auth/*` (credentialed CORS only for the exact client origin, and Better Auth's trusted origins set to match); then the contract and device checks for the app's own routes. So this is a change to `app.ts`'s order, not one line. | `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/web.ts` |
| **Linking a headset** | `POST /v1/me/devices`, with a valid session and the device token: records which headsets signed in, so delete can clear them all. It's a record, never a key. | `backend/src/auth/` |
| **Your book on the server** | `GET /v1/me/book` and `PUT /v1/me/book` with a revision number. The book holds each chapter's state and the resume point (with its time). Merging never loses anything finished: per chapter the furthest state wins (finished, then started, then unread), and the newer resume point wins, except that an active resume point beats an old finish when you're replaying. A `PUT` with an old revision is refused, and the client fetches, merges and retries. Importing a guest book into an existing account uses the same merge. **Not in it:** ticket 3's event log (canon, satchel), which stays per headset (see round 2 of the review log). | contracts (own PR, after ticket 3's), `backend/src/auth/book.ts`, `client/src/landing/account.ts` |
| **Changing reader** | Sign-in, sign-out and delete each finish by rewriting the local book and reloading the page. A running show, its checkpoint writers and any queued upload belong to the old page and die with it. A generation number on the local book stops a write that was already in flight from landing after the switch. | `client/src/landing/account.ts` |
| **Contracts** | The account, device-link and book shapes, plus the session header, as its own small PR. Ticket 3's PR #10 goes first (version 2), and mine rebases and bumps to 3 | `contracts/src/account.ts` |
| **Send to Quest** | `https://www.oculus.com/open_url/?url=<this page>`, plus copy and share fallbacks that are feature-detected | `client/src/landing/` |
| **Docs** | PRD: one-liner, positioning, the two ways in, journeys, business model. Design language: the landing rows, the bookplate, the front page. Sprint plan: ticket 7. Credits file. | `docs/`, `CREDITS.md` |

**Bundle.** React, Tailwind and motion add about 110 KB gzipped to the first page. A headset still loads the 3D after it, as today. A phone loads less than today, because it never fetches the 3D. Keys stay out: `pnpm check:bundle` still runs.

## The seam with ticket 3

Ticket 3 (branch `ticket-3-story-bends-remembers`) owns `client/src/show/`, the backend's AI routes and memory, the in-book contents page, and the episodes. Sent to them on Nov 14:

```ts
type LibraryState = {
  chapters: Array<{ n: number; title: string; state: 'unread' | 'started' | 'finished'; canResume: boolean }>;
  next: { kind: 'chapter'; n: number; resume: boolean };
  storyteller: { available: boolean; sessions: Array<{ id: string; title: string; updatedAt: string }> };
};
function libraryState(store, now): LibraryState   // pure, read-only, in or beside progress.ts

type EnterTarget = { kind: 'chapter'; n: number; from: 'resume' | 'start' } | { kind: 'storyteller'; sessionId?: string };
```

**My changes outside my folders, all small and told to ticket 3 first:**
- none to `progress.ts`;
- `index.ts` gets imported by `main.ts` instead of loaded by the page, and its landing block calls `setLibrary`, `setEnter` and the existing `setLandingState`;
- the guard's identity rule;
- CORS in `web.ts`;
- the auth mount, one line in `backend/src/server.ts` (ticket 3 agreed, and rebases around it).

**AI routes in the guard:** ticket 3's new routes (`storyTurn`, `paintProp`, `soundEffect`) join `AI_ROUTES` in `guard.ts`, so they count against the AI caps and need a signed-in user. Whichever of us merges second adds the line. Per-evening limits (turns, voices, paintings, listening minutes) live in ticket 3's handlers.

**Contracts order:** ticket 3 also needs a contracts PR (the AI Storyteller's routes). Both bump `CONTRACT_VERSION`, so they go one after the other: whoever opens second rebases and bumps once more.

**Ticket 3's answer (Nov 14):** yes to the seam, the names and the owner rule. They'll implement `libraryState()` in `progress.ts` with this exact shape and accept `EnterTarget` in `index.ts`. Chapter 2 is no longer theirs: the owner is writing chapters in parallel, so only chapter 1 is in this build. The in-book contents page isn't built yet; the owner chose a wrist tag for pause, start again and putting the book away.

**Requests to ticket 3 (theirs to build):**
1. **No saved place, but started:** `libraryState()` says "Start chapter 1 again", not "Open the book". (Ticket 3 confirmed the saved place already lasts 30 days; my first read of a stale comment in `progress.ts` said 30 minutes.)
2. **Start straight into the AI Storyteller** from the landing (`EnterTarget` kind `storyteller`).
3. **The in-book wording:** "Tales from the Table's Edge", "Chapters", "AI Storyteller". A signed-out reader sees "Sign in on the page outside the book" there. Sign-in never happens in XR.
4. **Memory stays per headset for now** (changed after round 2 of the review: moving ticket 3's event log between owners needs event import and a server-assigned order, which doesn't fit by Nov 18 and isn't needed with one chapter). Ticket 3's AI routes need the signed-in `userId`, which the guard provides. If ticket 3 saves AI Storyteller sessions, `LibraryState.storyteller.sessions` lists them; if not, the door shows no list.
5. **Optionally,** "where you left off" (the spread's name) in `LibraryState`, for "You left Pip on the shore".

## Your setup checklist

In this order, since DNS and Google can take hours:

- [ ] **A domain**, about $10 (Cloudflare Registrar is easiest). `tabletoptheater.com` and `tabletoptheatre.com` are taken. Try `tabletoptheater.app` or `tabletop.theater`. The client goes on the root, and the API on `api.` under it.
- [ ] **Unhold hosting** (ticket 0's Task 7; workflow and config are already committed): a Cloudflare Pages project for the client, a Railway service for the backend, and `BACKEND_URL` set. I'll walk you through it.
- [ ] **Google sign-in client** (Google Cloud console → APIs & Services → Credentials → OAuth client, web). Consent screen in Production, scopes openid, email and profile. Redirect URIs: I'll give you the exact ones. Put the ID and secret in Railway's variables and the main checkout's `.env.local`.
- [ ] **Resend** (free, 3,000 emails a month): add the domain, add its DNS records in Cloudflare, and put the API key in Railway and `.env.local`.
- [ ] **A secret for sign-in sessions:** I'll generate it. It goes in Railway and `.env.local`, never in the repo.

Everything runs against local servers until these are live, so building doesn't wait on them.

## Order of work

The riskiest part is proved first: real sign-in on the real link, reaching a guarded AI call. Each phase ends with something you can look at.

### Phase 0: prove sign-in end to end (Nov 14–15 morning)
- [ ] Your setup checklist, started tonight (DNS and Google take hours).
- [ ] Contracts PR (account, device link, book, session header), after ticket 3's PR #10, bumping to version 3.
- [ ] Better Auth in the backend, the guard's identity rule, CORS. The device code from the bookplate, approved on the phone, reaching a guarded AI route that's refused to a guest. Then Google in the headset.
- [ ] **Cutoff, Nov 16 at noon:** if signing in on the real link isn't working by then, I bring you one card: hold the AI Storyteller to signed-in readers (as decided) or open it to guests with a nightly limit per headset, so judges can reach it.

### Phase 1: the pages (Nov 15)
- [ ] The light first entry and device check; the React and Tailwind setup; the scroll stage with its five beats from the real art; the landing in all its states (first visit, mid-chapter, finished, loading, failed, XR refused); the AI Storyteller's door; the chapters sheet; the front page; About; privacy.
- [ ] Mac screenshots at the Quest's 1280 × 670, at desktop and at phone widths. **Your look check on the Mac.**
- [ ] Emulator: the landing → the book, with every button still entering XR in its own tap.

### Phase 2: your book on any headset (Nov 15–16)
- [ ] The book on the server with merge and revisions; the guest-to-account import; reload on reader change; sign out, including offline; delete with a fresh sign-in; the phone's link page with approve and decline.
- [ ] The AI Storyteller's door gated on sign-in and microphone.

### Phase 3: the headset (Nov 16)
- [ ] Review build over USB: the landing in Quest Browser → the book. Google sign-in in the headset. The phone code from your phone. Returning mid-chapter and after a chapter. A second sign-in after sign-out.
- [ ] From the real link once hosting is live, and "Send to your Quest" from the Mac.

### Phase 4: docs, review, sign-off (Nov 16–17)
- [ ] PRD, design language, sprint plan, credits. Codex reviews the PR once. **Your sign-off**, then merge.

**If time runs short,** cut in this order: the share button, "where you left off", the motes. Never cut: the one-button landing, the front page with "Send to your Quest", sign-in with the phone code, and sign-out leaving a clean headset.

## How it's checked

- `pnpm test`, `pnpm typecheck` and `pnpm check:bundle` stay green. No new tests, per the owner.
- **Mac:** screenshots of every page and state at 1280 × 670, 1440 × 900 and 390 × 844, keyboard focus visible, reduced motion respected, contrast 4.5:1.
- **Emulator** (`npx @iwsdk/cli dev up --allow-browser-automation`, with the probes `landing.mjs`, `open.mjs` and `goto.mjs`): each landing state's button enters XR, and leaving XR comes back to the right state.
- **Headset:** only for what only it can answer. The landing → book handoff, Google in Quest Browser, the phone code, and reading size on the 1280 × 670 window.

## Risks

| Risk | If it happens |
|---|---|
| Google sign-in is blocked in Quest Browser | The phone code is the headset's main path, and the Google button moves to the phone's page only |
| Hosting or DNS isn't live by Nov 16 | Phase 0's cutoff card (above). The chapters never need an account, so judges always get the book |
| Judges won't sign in to try the AI Storyteller | The submission text says "Sign in with Google to try the AI Storyteller". This is the owner's chosen trade |
| Better Auth's `node:sqlite` support is experimental | Fall back to its Kysely adapter on the same file, or a second small SQLite file through `better-sqlite3` |
| Ticket 3 changes `index.ts`'s landing block, the guard or memory at the same time | Each shared change is told to them before it's made. I keep to `landing.ts`'s API, and whoever merges second does the reconcile |
| A reader expects keepsakes on a second headset | The bookplate says "Your keepsakes stay on the headset they were found on." Syncing them is a v2 idea, with event import by id and a server-assigned order |
| React plus effects slow the first paint on the Quest | Effects load after the button is usable; the beam is CSS only |

## Not in this work

The in-book contents page, the AI Storyteller itself, chapter 2 and voices (tickets 3 and 4). Story Circle invites (later; accounts make them possible). Payments. The trailer (ticket 6 films it; the front page has its slot).

## Business model

**All free for now** (owner, Nov 14): it's a competition entry. The PRD's open question is answered "free during the competition; decided after".

## Review log

### Round 1

Codex reviewed the plan once on Nov 14, read-only, against the code: no P0, eleven P1 and two P2. I checked each one in the code. All thirteen are real, and all are taken.

1. **P1. An account token would be refused by the guard,** which only accepts the device token (`backend/src/guard.ts:84`). *Taken:* the device token stays on every call. A session header adds `userId`, and AI routes need it and are capped per user.
2. **P1. CORS allows only POST under `/v1`,** with no exposed token header (`backend/src/web.ts:23`). *Taken:* GET, PUT and DELETE, `set-auth-token` exposed, the auth routes under `/v1/auth`.
3. **P1. A Google redirect can't hand the client its bearer token.** *Taken:* the return carries a one-time code, which the landing trades for the session token.
4. **P1. The phone flow skipped the approval step.** *Taken:* the code is kept through sign-in, there's an explicit "Sign in your headset as …?" step, and approve, decline, slow-down, expiry and cancel each have an outcome.
5. **P1. The anonymous plugin doesn't migrate today's guest.** *Taken:* no anonymous plugin. The device token is the guest, and an explicit, authenticated device-to-user link plus a merge handles an account that already has a book.
6. **P1. Progress alone can't restore the book.** *Taken:* the book holds the resume point, and ticket 3's memory moves to the owner rule (request 4), with a stated fallback if it doesn't land.
7. **P1. Last-write-wins loses progress.** *Taken:* a merge where finished never goes back, plus revisions with a refused stale `PUT`.
8. **P1. Sign-out and delete didn't isolate or erase.** *Taken:* sign-out uploads, cancels anything queued, clears local state and unlinks. Delete erases the account, book, links and owned events.
9. **P1. The headset check was underspecified.** *Taken:* a fixed order (override, headset browser name, phone, XR support, timeout), and an "Open it here anyway" escape on the front page.
10. **P1. A refused XR request is invisible** (`launchXR` swallows errors in `@iwsdk/core/dist/init/xr.js`). *Taken:* the landing watches for a settled request with no session, and offers a fresh tap.
11. **P1. The real-link sign-in proof came too late.** *Taken:* Phase 0 proves it first, with a cutoff and a card on Nov 16 at noon.
12. **P2. Gating `World.create` still downloads the 3D code.** *Taken:* a light `main.ts` imports `index.ts` only on a headset.
13. **P2. "The chapters work without internet" overpromised** a cold start, which depends on ticket 6's cache. *Taken:* the copy says only what's true.

### Round 2 (the owner asked for a second Codex review, run in its own Superset terminal)

Codex re-read the plan, the code and ticket 3's branch at `90f9c2a`, with small in-memory probes of Hono and SQLite: no P0, ten P1, one P2. Fixes 4 and 7 (book snapshots) and 9 to 13 from round 1 hold; the rest were partial. I checked each finding in the code. All eleven are real and all are taken, several by cutting scope rather than adding machinery.

1. **P1. The session header had no complete path:** CORS doesn't allow it (`backend/src/web.ts:28`), the client only sends the device token (`client/src/backend.ts:33`), and Better Auth's bearer reads `Authorization`. *Taken:* `x-tabletop-session` allowed in CORS, a session getter in the client, and the guard hands it to Better Auth as a bearer.
2. **P1. The auth mount can't sit behind the contract header check** (`backend/src/app.ts:47`), and the `extend` hook runs before CORS (probe: 409, then no CORS header). *Taken:* the app's order changes: CORS, auth routes, then the contract and device checks.
3. **P1. Cookie-free CORS breaks Google's state cookie.** *Taken:* Google starts and ends on the API's own address by top-level navigation, then a one-time code hands the session to the landing. No cross-site call needs cookies.
4. **P1. A device link plus a different session gave two identities.** *Taken:* only a valid session means an account; a link is a record, never a key; an expired session is a guest again.
5. **P1. Guest events weren't migrated** when memory switched owner. *Taken by cutting:* memory stays per headset. Only the book snapshot (progress and resume point) follows the account.
6. **P1. Two headsets sharing an event bucket miss events** (`seq` is per device, reads use `seq > afterSeq`; reproduced). *Taken by cutting:* no shared event bucket in v1. Logged for v2.
7. **P1. Clearing storage doesn't stop the running reader** (`client/src/index.ts:499–512` holds the first checkpoint and runtime). *Taken:* every reader change reloads the page, plus a generation number on the local book.
8. **P1. Sign-out offline had no way out.** *Taken:* an explicit "Sign out anyway" that drops unsaved work, which is never uploaded later.
9. **P2. Deleting needs a fresh session.** *Taken:* deletion switched on, with a sign-in-again step when the session is over a day old.
10. **P1. Saved AI stories were promised here but optional in ticket 3.** *Taken:* not promised. The door lists stories only if ticket 3 saves them.
11. **P1. "No camera" contradicted the mug moment and ticket 3's room data.** *Taken:* the privacy page and the front page's copy follow what actually ships: room shapes described to the AI, the camera only with consent if it ships, and otherwise the voice-described mug.


### PR review (Codex, once, read-only, in its own Superset terminal, Nov 14)

On PR #11 at `7c37528`, with in-memory probes: no P0, six P1, five P2. I checked each one. All are real. Nine are fixed; finding 3 is resolved by changing what we promise, and finding 10 is half fixed.

1. **P1. The old show's pagehide writer re-creates the saved place after a sign-out or delete.** *Fixed:* the reload carries a one-time flag, and `main.ts` clears the saved place again before the book reads it.
2. **P1. The Storyteller door never opened,** because the shim always said "not available". *Fixed:* the door opens whenever ticket 3 supplies the launcher.
3. **P1. The exact place in a chapter can't move to another headset:** the server's resume point has no show position. *Resolved by scope:* your finished chapters, and the fact you started one, follow you; the exact place stays on its headset. The bookplate says so.
4. **P1. Reading progress was uploaded only at sign-in and sign-out.** *Fixed:* the page uploads whenever you come back from the book while signed in.
5. **P1. Cancelling at the moment of approval left a session with no reader change.** *Fixed:* a stored session always reports `approved`, which reloads.
6. **P1. A sync result could land after the reader changed.** *Fixed:* the generation is checked after every wait, and before the local write.
7. **P2. The pull guard was set once and never cleared.** *Fixed:* it's keyed to the imported book and cleared once settled.
8. **P2. An expired code on the phone's approve step was a dead end.** *Fixed:* the phone goes back to code entry.
9. **P2. The hero waited for all 28 pictures.** *Fixed:* it waits only for its own five; the rest load straight after.
10. **P2. A full re-render and a geometry read on every scroll frame.** *Half fixed:* the lamp is measured only once it's on the page. The re-render stays for now; the headset frame rate decides whether it needs motion values.
11. **P2. Small text on paper and in the footer was under 4.5:1.** *Fixed:* raised to at least 75% ink and 60% paper.

## Sign-in switched off for now (owner, Nov 14)

"Build sign up flows and everything but add a config flag to keep it disabled for now. I don't want to slow down dev progress." Sign-in is fully built, and **off by default**:
- **Client: `TT_PUBLIC_ACCOUNTS=on`** shows the Sign in button, the bookplate, the line under the main button and the phone's page, syncs the book, and gates the AI Storyteller on sign-in. When it's off: none of that appears, the Storyteller door goes straight to the microphone, and `/link/` says sign-in isn't switched on.
- **Backend: `TT_ACCOUNTS=on`** makes AI routes require a signed-in reader. When it's off, guests use them, capped per device as before accounts. The auth routes stay mounted either way.
- Turn both on together, at deploy time, once Google and Resend are set up.
