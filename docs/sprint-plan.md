# Tabletop Theater: sprint plan

**Frozen v1.** Comes out of `technical-design.md` and `design-language.md`. Later ideas go in `v2-ideas.md`, not in these tickets. Submission deadline: **Nov 18, 2026**. Work is split so many Claude Code and Codex sessions, each in its own Superset workspace, can own a ticket with little coordination. Spike code in `spikes/` is reference only, and nothing gets copied in without being rewritten for the product.

## Progress

*Last updated Nov 15, 2026. A workstream is ticked when it's merged to main, and a milestone when the owner signs it off in the headset. ⏸ means held by the owner's choice. **Now: M3 signed off (the AI Storyteller, PR #9). The owner writes more chapters; "Your room comes alive" builds room effects for both the chapters and the Storyteller.***

**The product is two ways (owner, Nov 14, after ticket 3's first headset session):**
1. **Defined stories:** authored chapters and books, theatrical experiences. Chapter 1 is the first. The owner writes more, in parallel.
2. **AI mode, the AI playground:** free-roam, impromptu, any AI experiment. It reuses the cast, sets and props, and can bring new ones. Voiced live. Ticket 3 builds it.

Why: AI lines spliced into the written chapter didn't land ("If a story is already written and we try to interfere with it, it's not that fun"; "I like the version of the story that we have currently"), and unvoiced lines broke immersion. The research is in `docs/plans/2026-11-14-ai-mode-research.md`. The product workspace (positioning, landing, journeys) takes the split into its plan.

### Milestones

- [x] **M0, Pip on your table.** Signed off on the Quest 3 on Nov 12, from a local build over USB (hosting is held).
- [x] **M1, the first 30 seconds.** Signed off on the Quest 3 on Nov 13, from a local review build over USB (PR #6).
- [x] **M2, first five minutes.** Signed off by the owner on the Quest 3 on Nov 14, from a local review build over USB (PR #7). Someone new played it on Nov 14 and was amazed by the wow; the web page and journey around the book need polish later (ticket 6).
- [x] **M3, the AI mode.** Signed off by the owner on the Quest 3 on Nov 15, from a local review build over USB (PR #9): "I actually felt immersion. They were like they were following my commands … we are in the right direction." Re-cut on Nov 14 from "a story that bends and remembers": the AI gets its own mode instead of being layered on the written chapters.
- [ ] **M4, voices and Talk.**
- [ ] **M5, Story Circle.**
- [ ] **M6, ready to submit.**

### Tickets

- [x] **0. Foundations** (PR #3). Plan: `docs/plans/2026-11-11-ticket-0-foundations.md`
  - [x] Repo and contracts. Plan: `docs/superpowers/plans/2026-11-09-repo-and-contracts.md`
  - [x] Pip on the table
  - [x] Deploy and backend: CI, device tokens, caps, memory, telemetry and the report
  - [x] Hosting: live since Nov 15 (ticket 7). Cloudflare Pages and Railway build main from GitHub; no per-branch previews, by the owner's choice
- [x] **1. First 30 seconds** (PR #6). Plan: `docs/plans/2026-11-12-ticket-1-first-30-seconds.md`
  - [x] Painted Stage Kit
  - [x] Stage and room
  - [x] Found-surface moment, from M0 playtest notes ("ember and wash")
  - [x] Room dim, from M0 playtest notes
- [x] **2. First five minutes** (PR #7). Plan: `docs/plans/2026-11-13-ticket-2-first-five-minutes.md`
  - [x] Hands and objects
  - [x] Show and flagship
  - [x] First-session journey (added by the owner, Nov 13)
- [x] **3. AI mode: the AI Storyteller** (PR #9). Re-cut Nov 14. Plan: `docs/plans/2026-11-14-ticket-3-story-bends-remembers.md`; research: `docs/plans/2026-11-14-ai-mode-research.md`
  - [x] Director (built: AI lines spliced into chapter 1; off since session 1, kept behind `?director=on`)
  - [x] The AI Storyteller: a free, improvised, voiced mode on the same stage, its own door on the landing
  - [x] Live voices and speech in (ElevenLabs), pulled forward from ticket 4: hold to talk, by fingertip or pinch
  - [x] Anything you ask for appears: painted live (Runway, about 2 credits each, 6 an evening)
  - [x] Memory and satchel: chapter-end memory recorded; the Storyteller keeps everything painted for you in your satchel, per device (carrying into later chapters follows the owner's new chapters)
  - [x] Stop the show: the wrist tag (pause, start again, put the book away)
  - Moved on: "your room" to **Your room comes alive** below; "show them something real" (the camera) and "you're in the cast" (voice cloning) to `docs/v2-ideas.md`
- [ ] **Your room comes alive** ← next (Superset workspace "Ticket 4: Your room comes alive", branch `ticket-4-room-comes-alive`, started Nov 15). Effects that act on the real room, for the chapters and the Storyteller: weather in the room, shadow play on the wall, a treasure hunt with the beam, the night sky on the ceiling, the sea on the floor, things that leave the page, the window as the story's window. Plan first, owner approval before code
- [ ] **Defined stories: more chapters** (the owner, in parallel, Nov 14)
- [ ] **4. Voices and Talk**
  - [x] Voice audition (run 005): full cast chosen from measurements, since the owner delegated it. Not yet compared by ear. Plan: `docs/superpowers/plans/2026-11-09-voice-audition.md`
  - [ ] Rest of voice and music: voice chain in the product, line pre-render, foley, music
  - [ ] Talk
- [ ] ⏸ **5. Story Circle.** Held by the owner (Nov 13) until the single-player product is done or at a good standard, then picked up if time is left.
  - [ ] Two-headset proof (can start once ticket 1 places a stage)
  - [ ] Shared show
- [ ] **6. Ship**
- [ ] **7. The product around the book** (added by the owner, Nov 14). Plan: `docs/plans/2026-11-14-product-front-door.md`
  - [ ] Sign-in proved end to end (accounts, the phone code, Google)
  - [ ] The page: the hero and the scroll that opens the book, on every device
  - [ ] Your book on any headset
  - [ ] **Later, once the product is nearly done: turn sign-in on and test it.** Built and tested on the Mac, switched off for now (owner, Nov 14). Set up Resend (needs a domain and its DNS records), a Google sign-in client, and the server's sign-in secrets (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TT_CLIENT_HOST`). Then turn on `TT_ACCOUNTS=on` (server) and `TT_PUBLIC_ACCOUNTS=on` (site) together. Test on the Quest: Google in Quest Browser, the phone code, and a second headset.
  - [x] **Host it on foldtales.xyz** (owner, Nov 15). Live at https://www.foldtales.xyz with the API at api.foldtales.xyz; each platform deploys main from GitHub: the site on Cloudflare Pages through the existing CI, and the backend on Railway at api.foldtales.xyz. The AI stays off in production for now. Steps in the plan's "Hosting on foldtales.xyz"; this also releases ticket 0's held hosting task.
- **Art library** (runs throughout)
  - [x] Book and first set for M1 (run 004, PR #1). Approved on the Mac
  - [x] Drawer objects for M2 (run 006, PR #2). Approved on the Mac and in Quest Browser
  - [x] Gap set, drawer, satchel and Wick's rope for M2 (run 007, PR #4). Approved on the Mac
  - [x] Painted reading room (run 008) and M1 sound (run 009), PR #6. Approved in the headset at the M1 sign-off
  - [ ] Headset approval of the above, once tickets 1 and 2 can show them
  - [x] M2 sound (run 010) and chapter 1's re-cut voices (run 012), PR #7. Heard in the headset at the M2 sign-off
  - [x] The lamp spread, the shore's night sky and the lamp wick (run 011), PR #7. Approved in the headset at the M2 sign-off
  - [ ] Prepared visitors, remaining cast actions, rest of the object library

## Where to start

Ticket 0 comes first. The Art library and the voice audition don't need it, so they can start in their own workspaces at the same time. When ticket 0 scaffolds IWSDK, keep the skills already in `.claude/skills/` and `.agents/skills/`, and don't let the scaffold duplicate them inside `client`.

## How to run it

- **One ticket, one milestone.** Ticket 3 ends when you can play M3. You track tickets, and agents own the workstreams inside them.
- **Thinnest playable first.** Each ticket's first merge is the smallest version you can play, even if it's rough in places. Workstreams then deepen it.
- **Real use sets the priority.** After each headset session, tell an agent what you noticed in plain words, and it goes in `docs/playtest-notes.md`. Those notes come before new features, and telemetry backs them up.
- **Someone else plays from M2.** Hand the headset to a person who's never seen it at each milestone from then on. Watch without helping.
- **Contracts are the one shared gate.** Ticket 0 freezes them, then everyone builds against mocks. A contract change is its own small PR, so nobody edits it inside a feature branch.
- **Look comes first.** Art and motion always meet the look bar. A temporary voice or a thin feature is fine, but test visuals never are.
- **Art doesn't wait for code.** The Art library runs from `art/` from the start, under the rules in `art/README.md`.
- **You spend your time in the headset.** Every merge to main deploys, and every branch gets a preview URL. Open it on the Quest with no USB needed.
- **Every workspace sets itself up.** `.superset/setup.sh` links the shared `.env.local`, gives the workspace its own ports in `.env.ports`, and installs dependencies. Change a key once, in the main checkout's `.env.local`.
- **Each workstream's agent reports:** what it verified, what you need to check, and a link to try.

## Milestones

| # | You can play | The test only you can pass |
|---|---|---|
| **M0** | **Pip on your table.** A link opens on your Quest, and Pip stands on your real table, breathing, with the lantern glowing | Does Pip feel alive in your real room? |
| **M1** | **The first 30 seconds.** Tap "Open the book", your room dims, the book unfolds, Pip's lantern blows out, and Pip looks up at you | Would you put this in the video? |
| **M2** | **First five minutes.** Hand back the lantern, the drawer slides open at the gap, hand over anything, and play a complete authored episode that ends with the beam sweeping your room | Does handing things over feel good, with no instructions? |
| **M3** | **A story that bends and remembers.** Whatever you hand over, the story bends around it, and next episode the kite is tangled on the lighthouse. Turn off Wi-Fi and it still finishes. Pick a lost object to start a new story | Does your object matter, does it never stall, and does the next episode really change? |
| **M4** | **Voices and Talk.** Cozy cast and music. Ask Wick something and the scene changes | Does it sound cozy, and is talking worth doing? |
| **M5** | **Story Circle.** Two headsets in one room, then remote | Do you both feel you changed the story? |
| **M6** | **Ready to submit.** Cold start, final polish, video | Would you hand this to a judge? |

## Dependencies

```
Art library: runs throughout, on its own

0 Foundations
 └─ 1 First 30 seconds
     ├─ 2 First five minutes
     │   ├─ 3 A story that bends and remembers ─┐
     │   └─ 4 Voices and Talk ──────────────────┤
     └─ 5 Story Circle (two-headset proof) ─────┴─ 5 full show ── 6 Ship
```

Tickets 3 and 4 run side by side. Workstreams can start before their ticket is playable: the show simulator and the voice audition need only contracts or nothing, and the backend is live from ticket 0.

## Tickets

### 0. Foundations

The one real bottleneck, so it's kept small. Ends at **M0**.

| Workstream | What it does |
|---|---|
| **Repo and contracts** | Monorepo with `client`, `backend` and `contracts`. Contracts for stage actions, the acting list, beats, objects, tags, rigs, events and telemetry, with mocks for every backend call. Dev servers read their ports from each workspace's `.env.ports`, since the IWSDK dev server fails if its port is taken |
| **Deploy and backend** | CI, CDN previews for every branch, and the Railway service with server-only keys, device tokens, quotas, caps and persistence mirror. Telemetry beacon and report script |
| **Pip on the table** | The thinnest path from `art/cast/pip/` to one puppet on your real surface, with hit-test placement and its breathing motion |

- **Blocked by:** nothing. **Blocks:** all other code.
- **Agent verifies:** two workspaces run side by side, Pip boots in the emulator, keys are absent from the client bundle, and a hit cap falls back to authored.
- **You verify:** create the accounts and keys, and approve each paid estimate. **M0 sign-off** gives the first answer to P0: does a painted puppet hold up on your table?

### 1. First 30 seconds

Ends at **M1**.

| Workstream | What it does |
|---|---|
| **Painted Stage Kit** | The `design-language.md` system as code: card material with `alphaToCoverage` and depth compatibility, the full puppet system reading `rig.json`, head swaps, all acting from `art/cast/prototype.html`, card yaw, pop-up layers, contact shadows, mood tint, lantern glow, room dim and beam sector, sound hookups. KTX2 and atlas build |
| **Stage and room** | Landing page, mic request before XR, tray to desk sizing, spine move, no-passthrough room, pause and resume through the book, ribbon, crash recovery, scene preloading |

- **Blocked by:** 0. **Blocks:** 2, and 5's proof.
- **Agent verifies:** review scene screenshots against the look bar, frame budget with all three characters on device builds, resume from a saved log, frame guard survives an injected error.
- **You verify:** P0 and P5. Do puppets hold up from the side, and does the beam look like your room is being lit? Placement on your desk, a tray and another table. Resume after taking the headset off. Tune the joints here.

### 2. First five minutes

Ends at **M2**, the first complete product, and the first time someone else plays it.

| Workstream | What it does |
|---|---|
| **Hands and objects** | **P1 first:** grab a small object and hand it to Pip, with snap distances tuned. Then pick up, move, shelter, place, the drawer and pull, the satchel, keeping, and every feedback state with sound. Characters look at your real head and reach for objects |
| **Show and flagship** | Scheduler, event log, beat format, authored beats and branches, scene problems with tag rules, narrator bridges, reactions. The complete first episode with no AI, plus the doing-nothing path, ending on the beam. A headless simulator, which can start from contracts alone |
| **First-session journey** | The landing page knows you: "Open the book" the first time, "Continue chapter 1" with "Start from the beginning" under it when you come back mid-chapter, and "Read chapter 1 again" once it's finished. Progress survives closing the browser, not only a crash. The end-of-chapter page: "The end of chapter one" and "Read it again" printed on the page, pinched like any book control. Closing the book there leaves a finished chapter, so the landing reflects it |

- **Blocked by:** 1. **Blocks:** 3, 4, and 5's full show.
- **Agent verifies:** emulator hand-pose flows, `iwsdk-glasses-test` for gaze and FOV, no controller paths. Offline simulator: both paths and every tag branch finish in 5–7 minutes, with no stalls. Landing states for a first visit, mid-chapter return and finished chapter, checked on the Mac.
- **You verify:** P1, with you and at least one other person. Is the zero-input episode satisfying? Payoff by minute 1? Does the beam land? Does someone new know how to start, and what to do at the end?

### 3. AI mode (re-cut Nov 14; was "A story that bends and remembers")

**Re-cut after headset session 1.** The product is two ways: defined stories, and an AI mode. The owner writes more chapters in parallel, and this ticket builds the AI mode, voiced live, with speech in. The table below is the original scope, kept for the record; the plan file has the current one.

The AI layer. Director and memory are clubbed because you can only judge them together, by playing one episode and then the next. Ends at **M3**.

| Workstream | What it does |
|---|---|
| **Director** | Beat planner, object reactions, validator with pacing guardrails, library-only staging, lookahead queue, repetition ledger, spine use, resolution logic. Story rubric |
| **Memory and satchel** | Canon from the event log, satchel persistence, object history, "Previously on…", undo, returning objects, deletion, the page composed from episode art. The contents page behind the sage tab: every chapter's page, to reread or play again, and the landing's "Continue chapter 2" |
| **Tonight's lost thing** | Pick a lost object to start a new story, a generated spine with fallback beats, moderation of spoken premises. Offered on the end-of-chapter page and the contents page |

- **Blocked by:** 2. **Blocks:** 5's full show, 6.
- **Agent verifies:** P4: hundreds of simulated shows with injected slowness and failure, no stall, no repeat, time-box met, and every gift acknowledged. P2's rubric across the library. Next episode differs with and without each consequence, undo reverses it, and data survives reload.
- **You verify:** hand over odd things. Does what you gave change the ending? Turn off Wi-Fi mid-episode. Play the returning evening, including closing the book mid-scene. Start three stories of your own.

### 4. Voices and Talk

Ends at **M4**. Runs alongside ticket 3.

| Workstream | What it does |
|---|---|
| **Voice and music** | Voice audition through Runway's `eleven_v4`, voice chain, casting, line pre-render, foley mix. Latency test of Runway's text to speech for live replies. One planned `seed_audio` test for music, otherwise a licensed library, with stems and crossfades. The audition can start right now |
| **Talk** | Select, paper ear, fresh mic per listen, a blind test of speech to text, in-character replies, speaker choice, mouth swaps from loudness, scene changes from speech, in-story redirects, mute, disclosure. Measures the first second of capture |

- **Blocked by:** 2 for Talk's selection. Nothing for the audition. **Blocks:** Talk in 5, 6.
- **Agent verifies:** all lines present and cached, loudness targets, no missing audio offline, recorded clips through speech to text, conversation rubric, red-team set, completing silently still works.
- **You verify:** the audition is yours to judge, by ear, on the headset's speakers. Approve the cast, then the music. Talk to Wick for real.

### 5. Story Circle

Stays its own ticket, because it needs two headsets and can fail independently. Ends at **M5**.

| Workstream | What it does |
|---|---|
| **Two-headset proof** | **P3:** thin relay, shared stage on a bare scene, and book alignment, on two real headsets. Starts as soon as ticket 1 places a stage |
| **Shared show** | Ownership, speaker lock, shared satchels, fairness, invites, avatars, remote voice, host handoff, bot Reader, the page in both books |

- **Blocked by:** 1 for the proof, then 3 and 4 for the full show. **Blocks:** 6.
- **Agent verifies:** multi-client simulation with bots, dropped host, reconnect from log, fairness across simulated episodes.
- **You verify:** P3 with two headsets, then a real remote session with a friend.

### 6. Ship

Ends at **M6**. Cold start budget, PWA and offline cache, final device pass, accessibility (captions, one-handed), VR Glasses view pass, the open items in playtest notes, licenses and credits including Runway's terms, privacy text, demo video, submission form. The no-headset page, About and credits moved to ticket 7 (Nov 14).

- **Blocked by:** everything else. **Blocks:** submission.
- **Agent verifies:** cold start on a throttled network, the Must-pass list against automated checks, form copy lengths, license list complete.
- **You verify:** film the video from real Quest recordings, and retest audio capture first. Play it as a judge, from the submitted link, with the controllers in a drawer.

### 7. The product around the book

Added by the owner on Nov 14, after the first new player: "Currently I land on the page. It's one random book with a start story. This is not a finished product." v1's freeze doesn't stop the owner's own request. It pulls forward ticket 6's no-headset page, About and credits, and owns the whole journey around the book.

| Workstream | What it does |
|---|---|
| **Positioning and library** | Tabletop Theater, an interactive storybook. The book is *Tales from the Table's Edge*, with chapters, and beside it is the AI Storyteller. Written into the PRD |
| **The page** | One page for every device: a hero with the one action, then a short scroll that opens the real pop-up book (Apple-style). "Open the book" on a headset, "Send to your Quest" elsewhere. Chapters, About, Privacy |
| **Accounts** | Sign-in that remembers you: a code on the page finished on your phone, or Google. Better Auth in the backend. Your place and finished chapters on any headset. The AI Storyteller needs sign-in |

- **Blocked by:** nothing; reads ticket 3's `libraryState()`. **Blocks:** 6.
- **Agent verifies:** Mac screenshots and a scroll recording at the Quest's 1280 × 670, desktop and phone widths; the emulator handoff from each landing state into the book; sign-in on the real link.
- **You verify:** the look on the Mac; in the headset, the handoff into the book, Google sign-in in Quest Browser, and the phone code.

### Art library

Runs throughout, and feeds every ticket. Sets for the flagship in painted layers, the book, drawer and satchel, the object library with descriptions and tags, a few prepared visitors, remaining cast actions. Planned runs only, each closed with results. Starts with what M1 needs: the book and the first set.

- **Blocked by:** nothing. Object data format comes from ticket 0.
- **Agent verifies:** every piece cuts out cleanly, naming and rig checks, credit use against each plan's cap.
- **You verify:** approve sets and key objects in the headset, not on the Mac.

### If there's time: live art

Moth's live-painted finds, live-painted pages and visitor cards, with the backend cutout and its rejection check. Moved out of the main path, because composed pages and the prepared library already keep the promise. Pick it up only if play shows it would add something.

## If a proof fails

Don't push on. Pull in the fallback from the risk table in `technical-design.md`, then replan what it touches. If the deadline forces cuts, thin these first, because each keeps its promise at a smaller size: remote avatar detail, number of library objects, number of flagship episodes past the first two. Never cut the first 30 seconds, the feel of handing things over, the beam, the no-stall behavior, or the take-it-away path.

## What you need to set up

**Already done:** `adb`, Meta VR CLI with skills and MCP, Runway key in `.env.local`, Runway MCP added (run `/mcp` to sign in, though the art tools don't need it), and the [private GitHub repo](https://github.com/distroinfinity/tabletop-theatre). `.env.local` is never committed, and every new workspace links to the main checkout's copy.

**Before ticket 0 starts**
- [x] Confirm the reset Quest is signed in with your developer account, and Developer Mode is on in the Horizon phone app. *(M0 ran on it over USB.)*
- [ ] Next time the USB prompt appears, tick **Always allow from this computer**. *(Not confirmed.)*
- [ ] ⏸ Create or connect: Railway project (backend), Cloudflare account (static client, free tier). *(Held with hosting.)*
- [ ] Anthropic API key for the backend only, with a spending limit set in the console. *(Not needed until ticket 3.)*

**When the product is nearly done (ticket 7)**
- [x] A domain: **`foldtales.xyz`**, bought by the owner on Nov 15. The product is named **Foldtales**. Point it at the deployed site, and use it as Resend's sending domain.
- [ ] Resend and a Google sign-in client, then sign-in switched on (ticket 7's to-do above).

**When tickets ask, with an estimate first**
- [ ] Speech to text and possibly fast live voice: ElevenLabs or your OpenAI key (ticket 4).
- [ ] Music library, if the Runway test fails (ticket 4).
- [ ] Second Quest, ideally on your own account (ticket 5's proof).

**Worth knowing, since this is your first VR project**
- **Try two things first:** Moss for how a tiny character bonds with you, and any polished mixed reality title for how grounding looks. Notice shadows, sound and hand feedback.
- **Comfort:** read Meta's [hands design principles](https://developers.meta.com/horizon/design/hands-plain-language-principles/). Feel for strain after 10 minutes, and raise anything that tires you.
- **Headset habits:** avoid long-pressing unless truly stuck, since that's what started the USB problem. Good lighting makes hand tracking far more reliable. Keep the OS current, and re-test after updates.
- **Getting stuck on USB:** replug, then **Settings → System → Developer options → Revoke USB debugging authorizations**, then the wireless debugging pairing code, and a factory reset only as a last resort.
- **Making recordings:** Meta button, camera icon, Record video. Agents can pull files from `/sdcard/Oculus/VideoShots` over USB. Your room appears in these clips, and frames an agent views get sent to the model provider.

## Headset testing rhythm

Open the latest preview, test what the ticket asked, then tell the agent in plain words. Telemetry reaches the agent automatically, so you don't need to read numbers. Note where you were and what the lighting was like, because rooms are part of the test. Test at least once at a real table, once on a tray or lap, and once in a dim room.
