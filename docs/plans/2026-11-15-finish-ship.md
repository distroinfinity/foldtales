# Lane E: ship and submission

**Status:** Stage 1, for review (Nov 15, night). Branch `finish-ship`. Read with `docs/plans/2026-11-15-finish-sprint.md` (the lanes and seams), `docs/hackathon.md`, and ticket 6 in `docs/sprint-plan.md`.

This lane makes what the other lanes build submittable and production-ready. It doesn't build features. Its code is the build, caching, performance and telemetry. Its docs are credits, privacy, the form and the video.

## 1. The deadline

**Wednesday, Nov 18, 2026, at 12:00:00 PM PT (Pacific Standard Time, UTC−8).** That's 20:00 UTC, and **Thursday, Nov 19, at 1:30 AM in India**.

- **Source:** the Official Rules on Devpost (`start-developer-competition-26.devpost.com/rules`), read on Nov 15 in a browser pane, since Devpost refuses scripted fetches: "Entry period: September 24, 2026 at 10:00:00 AM PT – November 18, 2026 at 12:00:00 PM PT". The Devpost header, shown in the owner's time zone, says "Deadline: 19 Nov 2026 @ 1:30am GMT+5:30". Meta's forum post agrees ("12:00 p.m. PST").
- **Judging:** from about Nov 18 to about Dec 9. Winners are announced around Dec 11.
- **What this means for us:**
  - The sprint's "Nov 18" is a full working day in India, plus the evening. **I propose submitting by Nov 18 at 20:00 IST** (6:30 AM PT). That leaves 5½ hours of buffer for a failed upload or a broken live link.
  - Start a **Devpost draft on Nov 17**, with placeholders. Devpost keeps a draft editable until the deadline, so the last day only swaps in the video and the final copy.

### Rules that change our plan

These come from the Official Rules (section 4) and are stricter than `docs/hackathon.md`:

1. **The live link must not change after the deadline.** "Once the Entry Period has ended, you may not make changes or alterations to your submission. The judging process will be based on the state of the Entry at the time of submission deadline." Cloudflare Pages builds every push to main. **After we submit, main is frozen until Dec 11**, or the owner pauses automatic deploys in the Pages dashboard. Railway too.
2. **It must stay up until the winners are announced** (about Dec 11), "free of charge and with sufficient access", and "capable of successful and consistent operation". Railway's bill and the AI caps (lane D) must cover about three weeks of judges.
3. **The video:** under 3 minutes, **public on YouTube or Vimeo**, footage "as viewed on a Meta Quest device or via XR Simulator". Judges needn't watch past 3:00.
4. **The text description** must cover the **inspiration, how we built it, future plans, and a target launch date** (we aren't on the Store). The form also asks for the track (**Entertainment**) and the division. **The division is New Experience:** the repo's first commit is Oct 30 and the window opened Sep 24.
5. **The link:** for IWSDK, "a link … to your GitHub page", or "your preferred hosting solution". `https://www.foldtales.xyz` qualifies. The repo is private, and nothing says it must be public.
6. **Nobody identifiable but us, and no brands.** "Projects may not mention or depict any identifiable person other than Entrants" and must not contain "recognizable branded products". This binds the video: the real room in passthrough shows no other people, no logos, no branded packaging and no screens showing other content. A satchel keepsake named after a real person (the "Shubham Mishra" teapot from Nov 15) must not appear.
7. **Third-party assets must be licensed for this use,** and Meta may ask for proof. That's why the Runway, ElevenLabs and music terms below are read now, not after.
8. **English throughout,** including the video, and with captions if anyone speaks.

## 2. Where things stand tonight

Measured where I could. Marked *measured*, *from the docs* (headset numbers recorded in `docs/playtest-notes.md` and `docs/room-effects.md`), or *by reading the code*.

### The must-pass list (`docs/hackathon.md`)

| Must pass | State tonight | Evidence | Gap |
|---|---|---|---|
| **Hands only:** finished end to end without pairing a controller | **Passes for chapter 1, by design and in every session.** No controller code paths, and the sessions in the playtest notes were played by hand (pinch and fingertip). | From the docs | Never yet played **from the live link with the controllers in a drawer**, start to finish (ticket 6's "You verify"). The new controls (lane A), chapters 2 and 3, and sign-in in Quest Browser (lane D) are unplayed. |
| **Airplane seat:** every interaction within 2 ft, seated | **Passes for chapter 1.** The book, drawer and satchel sit within 0.6 m (placement rule, tested at tray size). | From the docs, and the code | The **treasure hunt** asks you to walk. Its seated path (look at it and pinch to call it back) is built but **not yet tried in the headset**. The **two-handed stretch** is optional and fine. |
| **Bus stop:** fast cold start, clean pause and resume, satisfying in ≤10 min | **Partly.** Chapter 1 runs 5:59 to 6:55 with no stall. Pause by closing the book, and taking the headset off and on, both hold. | From the docs, and *measured* (the cold start, below) | **A first visit is slow:** the page shows in under 1 s, but **the book takes 16–23 s and 66 MB** before "Open the book" (*measured*), because `loadStageAssets` loads every set, the painted room and every effect's art up front. Chapters 2 and 3 will add to that. There's **no offline cache and no PWA** today: no manifest, no service worker. |
| **Take it away:** remove the third-party service and there's still a project | **Passes by design.** Chapters are authored, with prepared voices, and the director is off. Only the AI Storyteller needs the backend. | By reading the code | Not re-run since the re-cut **with the backend down and Wi-Fi off**. The Storyteller's door must say "not tonight" gracefully when the AI is out (lane D). |
| **≥60 fps on Quest, in rooms we never tested** (the look bar asks 72) | **Chapter 1 passes:** median 85–90, low 78–80. **Rain is marginal:** median 80–82, **low 60–65**, about 146 draw calls, measured before the rain was made finer. | From the docs (telemetry from local USB sessions) | **No device numbers** for shadows, fireflies, window, night sky, snow, sea and boat, gulls, the bottle or the hunt. **None** for two big effects at once, or for chapters 2 and 3. Lows of 49–67 were seen while closing, stretching and lifting the ribbon with all three characters. Hitches of 200–320 ms at session start and warm-up. |

**Telemetry:** production (`api.foldtales.xyz`) has **no rows** (*measured*: the admin route answers an empty list since Nov 10). Every headset session so far ran from a local build over USB, and those local databases went with their worktrees. So the per-effect numbers come from a new headset session (section 4, task 3). The events needed already exist: `frame_summary` every 10 s, `hitch`, and `room_fx` each time the effects change. No contracts change is needed.

### Ticket 6's list

| Item | State tonight | Owner |
|---|---|---|
| Cold start budget | *Measured* on the live site: the page in 0.3–0.7 s, the book in 16–23 s on a first visit, 1.6 s on a return. No budget written. | E |
| PWA and offline cache | Not started. No manifest, no service worker, a blank `data:` icon. | E |
| Final device pass | Not started. | E, then the owner |
| Captions | **Every chapter line is printed on the book's caption band** (`show/runtime.ts`), in Atkinson Hyperlegible on page paper. The AI Storyteller's lines: to check. No caption setting yet. | E checks. The setting is lane A's (settings). |
| One-handed play | **Mostly.** Grab, hand over, turn the page, the drawer and the cover all take one hand. **The wrist tag doesn't:** it's on the back of the left wrist, so it needs the other hand. Lane A is replacing it. The new controls must work one-handed, with either hand. | Lane A builds. E checks. |
| VR Glasses view | Not checked since ticket 1. The comfort rule is 37° left and right, 25° up and 43° down. The judging rules now score "FoV-aware design" in two criteria. | E |
| Open items in the playtest notes | (a) The two-handed stretch may be twitchy. (b) The page turn by hand has never been felt in the headset. (c) "Stop the show from inside" goes to lane A's controls. (d) The hosted link is done (ticket 7). (e) "The AI layer on the chapter doesn't land" was resolved by the re-cut. I'll mark (d) and (e) closed in my section of the notes. | (a) and (b) in the final device pass. (c) is lane A's. |
| Licences and credits, with Runway's terms | `CREDITS.md` exists, and is incomplete. **Missing:** the Basis transcoder (Apache-2.0, shipped in `basis/`), `@elevenlabs/client` and LiveKit (MIT and Apache-2.0), Cormorant Garamond (OFL), and five `@pmndrs/uikit` packages through IWSDK whose licence pnpm reports as "Unknown". Runway's, ElevenLabs' and Seedream's terms aren't re-read yet. | E |
| Privacy text | **A page exists** (`client/src/pages/privacy.tsx`). It says nothing about the voices being spoken by ElevenLabs, or Runway painting what you ask for. It says your voice "isn't kept" (unchecked against ElevenLabs' terms). It says we collect "load time", which telemetry doesn't send. Its contact is "the competition page". | E writes. Lane A owns the page. |
| Demo video | Not started. **Risk:** Quest recordings sometimes held only passthrough, without the app layer (Nov 15), and the recorder's audio was "too faint to judge" (Nov 11). | The owner films. E writes the shot list. |
| Submission form | Not started. | E drafts. The owner submits. |
| Music | **None in the product.** A `music` stage action exists in contracts, with moods, and the client ignores it. | E, if it fits |

### The build (*measured* tonight, Mac, cold cache)

- **The build:** `pnpm --filter @tabletop/client build` with an empty art cache took **10 min 57 s**. Encoding 75 textures to KTX2 took almost all of it, **on one core of ten**. Cloudflare took 14 minutes for the same work, against its 20-minute limit. Chapters 2 and 3 add about as much set art again each, so at today's speed Pages would need about 25–35 minutes. **It will fail on Nov 16 or 17 unless we act.**
- **The cache:** `client/.art-cache` is **59 MB** for chapter 1's art. It can be committed: the repo already tracks 471 MB under `art/`.
- **The output:** `client/dist` is 179 MB in 459 files. That's 59 MB of KTX2, 6.6 MB of sound, 5.2 MB of code, and **about 100 MB of PNG sources** the headset only uses if KTX2 fails. Pages' limits (20,000 files, 25 MiB a file) are far off. The largest file is the 7.9 MB cover PNG.

### The cold start (*measured* tonight, on the live site)

Measured from the Mac in a browser pane, on `https://www.foldtales.xyz/?page=landing` (the page in headset mode, so it loads the book). Network throttled through the browser's DevTools protocol, with the cache cleared for a first visit. "Book ready" is when "Getting the book ready" turns into "Open the book".

| Visit | Network | Page shown | Book ready | Downloaded |
|---|---|---|---|---|
| First | Unthrottled (home fibre) | 0.7 s | **16.2 s** | **66 MB**, 262 requests |
| First | 25 Mbps, 40 ms | 0.3 s | **23.4 s** | 66 MB |
| Return (browser cache) | Unthrottled | 0.3 s | 1.6 s | 0.2 MB (every file asked again, answered "not modified") |
| Return (browser cache) | 25 Mbps, 40 ms | 0.3 s | 1.7 s | 0.2 MB |

At 10 Mbps, a first visit would take about 55 s. **What the 66 MB is:** chapter 1's three sets are 29 MB, the book 7 MB, **the painted reading room 12 MB** (needed only without passthrough, and loaded anyway), the room effects' art 6 MB, the cast 3 MB, and about 5 MB of code. The page itself is quick. The wait is the book, all at once. The Quest's own number is to measure (task 4). Its Wi-Fi and its decoding differ from the Mac's.

## 3. Risks

| # | Risk | Likelihood | What we do |
|---|---|---|---|
| R1 | **The Cloudflare build passes 20 minutes** once chapters 2 and 3 add their sets, so main stops deploying on Nov 17 or 18. | High | Commit the art cache (task 1). |
| R2 | **The video can't be captured well:** no app layer, or faint sound. | Medium | Test-record 30 s on Nov 16, with sound, and pull it with `adb`. Fall back to `scrcpy`, or the IWSDK emulator for one shot (allowed: "or via XR Simulator"). |
| R3 | **A room effect, or a new chapter's scene, drops below 60 fps** on the Quest. | Medium (rain's low was 60–65) | Measure each one on Nov 16 (task 3). Fix by draw calls first (batch the rain and snow), then fill rate. |
| R4 | **The cold start is long** on a judge's Wi-Fi: 66 MB and 23 s at 25 Mbps today (*measured*), because every set and effect loads up front, and chapters 2 and 3 add more. | High | Load less before the book appears, and cache it (tasks 2 and 4). Lane B loads only the chapter being opened. |
| R5 | **A deploy lands after the deadline** and changes what judges see. | Medium | Freeze main from submission to Dec 11, or pause Pages' automatic deploys (owner). |
| R6 | **A stale service worker** serves an old book against new data. | Low, if built right | One cache per build. Data and art are versioned together. A new build replaces the old cache whole. |
| R7 | **A licence gap,** for example generated art's terms, or a music track with a Content ID claim on YouTube. | Low–medium | Read the terms now, record them in `CREDITS.md`, and use no music with a Content ID claim. |
| R8 | **The live AI fails or runs dry** during three weeks of judging. | Lane D's | Lane D sets the caps. I check that the chapters never depend on it. |
| R9 | **The owner's time zone.** The deadline falls at 1:30 AM in India, at the end of a long day. | — | Aim to submit by 20:00 IST on Nov 18, with a draft ready on Nov 17. |

## 4. The plan

In order. Each task names its files, and how it's checked. Shared files are marked; I coordinate those through the sprint master before editing.

### Task 1. The Cloudflare build (R1). Nov 16, first.

- **Commit the compressed art cache.** Move it from `client/.art-cache/` (ignored) to a tracked folder, `client/art-cache/`. Track the `.ktx2` files and their content-hash markers. Leave out the generated `ktx2.json`, which the build writes each time. The cache is keyed by each source's hash, so Pages finds every texture already encoded, and the build should drop from 14 minutes to two or three (an estimate: the rest of tonight's build was under a minute on the Mac). A lane that adds art commits its new textures with it. If one forgets, Pages encodes just those, so it's slower but never wrong.
- **Encode in parallel** on the cores the machine has (`worker_threads` in `tools/art-build.ts`), so a lane adding a chapter's art waits minutes, not a quarter-hour. Same encoder settings, so the output is identical.
- **Fix one build wrinkle:** `book` and `book/drawer` are both listed, so the drawer is emitted twice. The live site ships no source maps (*measured*: no `sourceMappingURL`, and the `.map` URL answers with the page's fallback).
- **Why not GitHub Actions:** it needs a Cloudflare API token from the dashboard, Pages' Git build switched off, and a new deploy path, two days before the deadline. Committing the cache keeps today's working pipeline. If the cache turns out too big for the repo (section 2's numbers), Actions with `actions/cache` is the fallback, and the owner makes the token.
- **Files:** `tools/art-build.ts`, `client/vite.config.ts` (shared: one line, the cache path), `.gitignore`, `tests/art-build.test.ts`.
- **Checks:** `pnpm check`. A cold build and a warm build, timed. The KTX2 bytes are identical before and after the parallel encode.

### Task 2. Offline cache and an installable page (PWA). Nov 16.

- **A manifest and painted icons:** `manifest.webmanifest` (Foldtales, night-navy background, `display: standalone`), with icons cut from the cover art we already have. No new paint. Lane A owns `client/index.html`, so I ask through the sprint master to add two `<link>` lines.
- **A small service worker** that I write, rather than a plugin. A Vite plugin lists every file the build emitted, with its content hash, and the worker caches them under one name per build:
  - **The page and its code** (hashed `assets/`): cached on install, so a second visit opens with no network.
  - **What a chapter needs** (KTX2 art, set and rig JSON, voices and sound, the Basis transcoder): cached the first time they're fetched, then served from the cache. The PNG sources the build also ships, as a fallback for KTX2, aren't pre-cached.
  - **Never cached:** `api.foldtales.xyz`, sign-in, `/auth/`, and anything that isn't a GET.
  - **A new build** installs its own cache and deletes the old one when it takes over, on the next launch. Nothing is mixed between builds.
- **Cache headers:** today every file, art included, is served with `max-age=0, must-revalidate` (*measured* on the live site), so a return visit asks again for each one. A `client/public/_headers` file gives the hashed `assets/` a year's `immutable` cache. Art paths aren't hashed, so the worker handles them.
- **No APK.** The rules accept a hosted link for IWSDK. A Quest APK (Bubblewrap) would skip the page, and with it the microphone permission the Storyteller asks for before XR (a first prompt inside XR ended the session, twice). It's in `docs/v2-ideas.md` as the Store path, for the target launch date.
- **Files:** `client/vite/sw-plugin.ts` (new), `client/src/sw.ts` (new), `client/public/manifest.webmanifest` and icons (new), and registration in `client/src/main.ts` (shared with lane A: three lines).
- **Checks:** a unit test on the file list. On the Mac, with `vite preview`: load once, go offline, reload, and the page and the book's files come from the cache (DevTools, Application). Lighthouse's installability check. On the Quest: open the live link, put the headset in airplane mode, reopen, and chapter 1 plays.

### Task 3. ≥60 fps for every scene and room effect (R3). Nov 16 build, Nov 16–17 headset.

- **A per-effect report:** `scripts/telemetry-report.ts` slices `frame_summary` by the `room_fx` that was on at the time, and by beat when the session started from `?jump=`. It prints median, low, draw calls and the worst hitch per effect and per scene.
- **One review build and a link list:** chapter 1's three spreads by `?jump=` (opening, `the-shore`, `to-the-edge`, `the-beam`); every effect alone by `?room=`; the two heaviest pairs (rain with night sky, and sea with window); then chapters 2 and 3's scenes once lane B's engine lands. About 60 s each, seated, about 20 minutes for the owner in all. Telemetry reaches the agent, so the owner only plays.
- **Fix anything under 72**, the look bar's number, which gives 60 some margin. Draw calls first (the rain's 146), then fill rate (the dim sphere and full-screen effects), then the warm-up hitches (compile shaders before the book appears).
- **Results** go in `docs/room-effects.md`'s cost table (the catalogue's own place for them), with each scene in this plan.
- **Files:** `scripts/telemetry-report.ts`, `tests/telemetry-report.test.ts`. Any performance fix to an effect's code is small and named in the PR.

### Task 4. The cold start (R4). Nov 16–17.

- **The budget I propose:** on 25 Mbps with 40 ms latency, the page shows in under 1 s (met today). On a first visit, "Open the book" is ready in **under 12 s** (today 23.4 s), which means **under about 30 MB** before the first spread. On a return visit, and offline, it's ready in under 3 s (today 1.6 s, but not offline).
- **How we get there, smallest change first:**
  1. **The painted room loads only without passthrough,** or after the book opens: −12 MB. It's optional in `loadStageAssets` already.
  2. **The room effects' art loads after the book opens:** −6 MB. Chapter 1 calls no effect, and the Storyteller is offered only effects "whose art has loaded", so that rule still holds. Chapters 2 and 3 may call effects, so I check how early their first one comes against how long the art takes to arrive.
  3. **Only the chapter you open loads, and spreads after the first load behind it:** chapter 1's shore and gap are −19 MB off the wait. This touches how lane B loads a chapter by number, so it's lane B's call. I give them these numbers and test what they build.
  4. **The service worker** (task 2) makes every visit after the first a return visit, offline too.
- **I build steps 1 and 2** in `client/src/paint/assets.ts`. It's stage code that lanes B and D also read, so it goes through the sprint master. Nothing shown changes: the same art, loaded later.
- **Measure** with the same script after each step, and on the Quest with a review-build console mark read over USB. The bytes and times go in the table above.

### Task 5. Accessibility, and the VR Glasses view. Nov 17.

- **Captions:** check that every spoken line has a caption, including the Storyteller's, chapters 2 and 3, and the narrator. Check at least 1° tall at reading distance, and 4.5:1 contrast. Measured from emulator screenshots.
- **One-handed:** in the emulator, play chapter 1 with one hand only, then the other. Every control in lane A's new set, including pause, leave and contents, must work with either hand alone. I report gaps to lanes A and D; I don't fix their code.
- **The VR Glasses view,** with the `iwsdk-glasses-test` skill: the `metaVRGlasses` emulator device, `fieldOfViewMask`, and gaze-and-pinch. The book, the caption band, the drawer and every control in lane A's set fit 37° left and right, 25° up and 43° down at seated distance. Nothing fires on hover. Screenshots go in this plan, for the form's FoV paragraph.
- **The 2D page:** a Lighthouse accessibility pass (contrast, labels, keyboard), with findings sent to lane A.

### Task 6. One quiet music bed, if it fits. Nov 17, art run 027.

- **What:** one bed, a minute or two that loops cleanly. Felt piano and plucked strings, as `docs/design-language.md` asks, under the chapters at a low level. It ducks under speech, pauses with the book, and has a mute in lane A's settings.
- **Where it comes from, in order:**
  1. **A CC0 track** (Freesound filtered to CC0): free, and no Content ID claims.
  2. **Generated,** if nothing CC0 fits: Runway first, on lane E's 30 credits, if its model list has music by then. Otherwise ElevenLabs Music on our key, which is paid. Either one gets a written estimate and the sprint master's approval first.
- **Never:** Pixabay or YouTube-library music. Their tracks often draw Content ID claims on YouTube, which would land on the video.
- **The test:** the owner hears it in the headset, under a spoken scene. If it competes with the voices, or the owner shrugs, there's no music in v1. "Silence counts as polish too."
- **Files:** `art/runs/027-music-bed/` (plan, results), `art/sound/music/` and a small player in the sound engine. The sound engine is shared with lanes B, C and D, so I take it through the sprint master.

### Task 7. Licences, credits and privacy. Nov 16–17.

- **Credits:** run `pnpm licenses list --prod` for the client and backend, and resolve the five "Unknown" licences from their own repos. Add what's missing to `CREDITS.md`: Basis Universal, LiveKit, `@elevenlabs/client`, Cormorant Garamond, and every package whose licence asks for a notice. If music ships, its source and licence.
- **Re-read the terms that matter,** and quote the lines in `CREDITS.md`:
  - **Runway:** read tonight (Terms of Use, last updated Oct 23, 2026). §4.4: "The Company does not claim ownership of any of your Inputs or Outputs", and "the Company does not restrict your commercial use of your Outputs". Runway may train on inputs and outputs. §10.1: outputs "may not be unique". Still to read: Runway's API terms, which our key runs under, and any pass-through terms for Seedream and ElevenLabs.
  - **ElevenLabs:** voices made through Runway, and the live voices and speech to text called directly. Commercial use on our plan, and how long it keeps audio.
  - **Anthropic:** API inputs not used for training.
- **Privacy:** rewrite `client/src/pages/privacy.tsx`'s text to say exactly what's sent where:
  - telemetry: frame rate and errors, under a random device code, kept on our server in the US;
  - the voice: to ElevenLabs to be understood, and the cast's spoken lines from ElevenLabs;
  - the story: to Anthropic;
  - what you ask to be painted: to Runway;
  - Space Setup's shapes, described as text;
  - sign-in data, when it's on;
  - deleting.

  Lane A owns the page's layout. I change only the words, through the sprint master. **Needs the owner:** a contact address for the privacy page (section 5).

### Task 8. The form copy and the video's shot list. Nov 17, after lanes A and D's stage 1.

- **The form:** the tagline, under 140 characters, counted by a test. About 500 words covering inspiration, how we built it, how hands are used, the FoV-aware design, the room effects as "passthrough that matters", the AI Storyteller, future plans, and a target launch date. Also "how hands are used", the track, the division and testing instructions ("Open www.foldtales.xyz in Quest Browser, tap Open the book; hands only; Space Setup helps"). In `docs/submission.md`, with word and character counts.
- **The shot list:** under 3:00, from real Quest recordings, in `docs/submission.md`. PRD §15's beats are out of date (Story Circle is cut, and Talk now lives in the Storyteller), so it follows what actually ships. Each shot has its review link, where to stand, and what's in the room's background (no people, no brands).
- **The video's audio:** a 30 s test recording on Nov 16 (R2), before anything is filmed for real.

### Task 9. The final pass. Nov 18, morning in India.

- **From the live link, as a judge,** with the controllers in a drawer: first visit, chapter 1 end to end, pause and resume, put the book away, come back, the Storyteller's door, and airplane mode. The owner does this in the headset. I watch telemetry and check the page from the Mac.
- **Then freeze:** no merges to main from submission until Dec 11 (R5), and the owner submits.

### Timeline

| When (IST) | Lane E |
|---|---|
| Nov 15, night | This plan. |
| Nov 16 | Task 1 (the build) first, then the PWA, the telemetry report, credits and privacy drafts. The test recording. A headset session for the per-effect numbers. |
| Nov 17 | Cold-start numbers, accessibility, the glasses view, the music bed if approved, the form and shot list once lanes A and D are approved, and the Devpost draft. Perf fixes. **Feature freeze at the end of the day.** |
| Nov 18 | The final pass on the live link, filming, and submitting by 20:00 IST. |
| Nov 19, 1:30 AM IST | The deadline. |

## 5. What I need

- **From the sprint master:**
  - Approval of this plan.
  - Agreement to touch these shared files: `client/vite.config.ts` (the cache path and the service-worker plugin), `client/index.html` and `client/src/main.ts` (the manifest links and the worker's registration, lane A's), `client/src/pages/privacy.tsx` (words only, lane A's), `client/src/paint/assets.ts` (what loads before the book appears; lanes B and D read it), and the sound engine (the music bed, if it ships).
  - Lanes A and D's approved stage 1 for the form copy and the shot list.
- **From the owner** (none blocks tonight's work):
  1. A **contact email for the privacy page** and the form. For example, an address at `foldtales.xyz`, which needs mail set up, or your own.
  2. A **target launch date** for the form. My suggestion: "Spring 2027 on the Meta Horizon Store, with Meta VR Glasses support", since the glasses arrive in spring 2027.
  3. About **20 minutes in the headset on Nov 16** for the per-effect numbers, and **30 seconds of test recording** with sound.
  4. **After submitting:** pause automatic deploys in Cloudflare Pages and Railway, or agree that nothing merges to main until Dec 11.
- **No contracts change.** Every event this lane needs exists.
- **No paid art or sound tonight.** Run 027 (the music bed) is planned in task 6, with its estimate, only if CC0 fails.
