# The Devpost form: ready to paste

Lane S, Nov 17, 2026, for the Meta VR Start Developer Competition 2026. Each section below is one of the owner's form fields, in the form's own order (from the owner's list of every field, Nov 17). Each paste box is plain text or Markdown, ready to copy. Every limit is checked by a character or word count, given beside it.

**Before pasting, settle the marks.** Square-bracket marks such as **[if the hunt passes]** belong to claims that depend on Nov 18:
- If the claim holds, delete only the mark.
- If it doesn't, delete the mark and the sentence after it.

| Mark | Decided by |
|---|---|
| **[if the hunt passes]** | Headset session step 17 (`docs/headset-session.md`) |
| **[if the bed clears]** | The music bed's Content ID test (`art/sound/music/LICENCE.md`) |
| **[if offline passed]** | Headset session step 24 |
| **[if the Storyteller is live]** | Lane D's launch switch (it's waiting on the Google consent-screen rename) |
| **[fps]** | The frame-rate pass. Keep "85–90 fps" only if the pass confirms it |

**Owner-only fields** say **OWNER** and have nothing to paste. The owner's email never goes in this repo.

The draft project on Devpost is currently named "Holo HQ", a placeholder. Rename it first.

---

## Step 1: Project overview

### Project name (60 characters max)

**Recommended: `Foldtales`** (9 characters).

The alternative, `Foldtales: Tales from the Table's Edge` (38 characters), fits, but I'd not use it:
- "Tales" is said twice in four words.
- *Tales from the Table's Edge* is the book Pip lives in. The product is Foldtales, which is also the name on the site, the cover and the film's end card. One name everywhere is easier to remember and to find.
- The subtitle is used in "What it does", where it reads as the book's title.

```
Foldtales
```

### Elevator pitch (200 characters max)

The approved tagline, 134 of 200 characters:

```
A painted pop-up book opens on your table. Help a small fox keep the lighthouse lit, and its sea, snow and stars spill into your room.
```

Leaving 66 characters unused is deliberate. The tagline was approved as it stands, and anything added would be a feature list.

---

## Step 2: Project details (the public project page)

### About the project (Markdown; Devpost's own headings)

About 1,145 words (6,314 characters); the field has no stated limit. Everything in it is checked against the code or the docs (sources in the notes after it).

```markdown
## Inspiration

Pip's lantern has rolled to the edge of your table, and he's looking up at you. You reach in, pinch it, and hand it back, and it lights again in his paws. "It was cold, and then you held it, and it just... woke up."

Evenings are when we reach for a story, and on a screen you only watch. We wanted the kind of story you have to lean over: a pop-up book on your own table, small enough to reach into, where the characters need your hands and know that you're there. No score, no losing, about six minutes a chapter, and nothing but your hands.

## What it does

Open www.foldtales.xyz in Quest Browser and tap **Open the book**. There's nothing to install. The book finds your real table and settles on it within reach, the room dims like house lights going down, and the pages stand up as painted paper sets. The first time, a pale ghost hand shows you the one control, with no words.

The book is *Tales from the Table's Edge*, in three chapters. Pip is a young fox in a keeper's coat far too big for him, and he wants to keep the lighthouse like old Wick. You hand him his lantern, turn the pages by their corners, and pull open the book's drawer to choose what gets him across a gap. The story waits for you but never needs you: left alone, it plays to its end.

The story uses your room as its stage:
- **Chapter 1:** when the lamp is relit, its beam sweeps across your real walls.
- **Chapter 2:** the tide comes in across your floor, and a paper boat sails home on it.
- **Chapter 3:** snow comes to the table's edge, and the stars come out on your ceiling, with Pip's own star among them. **[if the hunt passes]** The beam hunts your room for Wick's lost logbook, and you get up and fetch it.

Touch the ribbon's tail to pause. The stage folds flat, and a paper card rises behind the book, never over it. The book keeps your place: "Same time tomorrow, keeper?"

**The AI Storyteller.** **[if the Storyteller is live]** Beside the written chapters, the same cast make up a new story with you. Hold the paper talk button and say what tonight's story is about, or just hand them something. They answer out loud, can paint what you ask for onto the page, and can bring weather into your room: rain, shadow play on your wall, fireflies that drift to your hand. The written chapters never change. The app always owns the ending, and a story finishes cleanly if the AI is slow or unavailable.

## How we built it

- **The engine.** Built for the web with Meta's Immersive Web SDK (IWSDK) and Three.js, in TypeScript, so it opens from a link. The book finds your table from Space Setup's labelled planes, with hit testing as a fallback. The room effects use the same planes: walls, floor, ceiling and windows.
- **The puppets.** Every character is a cut-out paper puppet, animated at twelve poses a second, like stop-motion. The art was painted with AI (Seedream, through Runway) from our own sketches and written designs, then cut out and rigged in layers.
- **Voice and sound.** Chapter voices are ElevenLabs presets, recorded before release through Runway. Every line is captioned on the book's own page. Sounds are placed in the room with spatial audio. **[if the bed clears]** A quiet CC0 piano bed plays under the story.
- **The Storyteller.** Speech is transcribed with Whisper on Groq, Claude writes each turn within the cast and the world's rules, OpenAI's text-to-speech gives the cast their live voices, and paintings come from Seedream through Runway in about 30 seconds.
- **Behind it.** A small Hono server on Node, with SQLite and Better Auth (Google, or a code finished on your phone), runs on Railway. The site is on Cloudflare Pages. **[if offline passed]** After the first visit, the page and chapter 1 open with no network.
- **[fps]** Chapter 1 runs at 85–90 fps on Quest 3.

## Challenges we ran into

- **Finding the table.** In our first headset session, Pip floated in mid-air. Later, the book sank into the table, and hands couldn't reach it. Aiming the search lower, and settling the book fully on the scanned table top, fixed both.
- **Pinch for everything was wrong.** Pressing buttons by pinching felt unnatural, and the pause card covered the stage. Meta's own hand guidance named the problem: one gesture had two jobs. Now there are two gestures that never mix: pinch to hold the story's things, and touch to press the book's controls. Each press makes a soft paper tap, because hands have no haptics.
- **AI inside a written story felt like interference.** Our first attempt spliced AI reactions into chapter 1, and in the headset it read like an if-else. So the written chapters play exactly as written. The AI got its own door: the Storyteller, where the whole story is made up with you.
- **Hands, eyes and the field of view.** Every control had to work with either hand, within reach while seated, and inside Meta VR Glasses' narrower view.

## Accomplishments that we're proud of

- Three complete, voiced chapters with a beginning, a middle and an end, in which your room takes part.
- The first time someone who had never seen it played it, they were amazed.
- One mechanic, done well: hand them what they need. Each gift changes what happens next.
- The book opens from a link, in seconds, with nothing to install, on a real table in a room we've never seen.
- The Storyteller keeps the same cast, the same world and the same book, and always finishes.

## What we learned

- Show, don't tell. A looping ghost hand teaches the one control better than any text panel we tried.
- Passthrough matters only when the room changes the story. Every room effect is there because the story needs it: the light goes out over the house, the sea comes in, and the sky opens.
- An authored story and an AI story want different doors. Mixing them inside one chapter weakened both.
- Put the dial on the reader's side. The story waits for your hands but never punishes you for not using them.

## What's next for Foldtales

We plan to launch in **spring 2027 on the Meta Horizon Store and on Meta VR Glasses**. Before then:
- more chapters of the book;
- Story Circle, with friends around one table or remote, each bringing their own satchel of keepsakes into a shared story;
- the gaze-and-pinch controls we've built for Meta VR Glasses, tuned on the glasses themselves.
```

**Notes, for checking (not to paste):**
- **Features used:**
  - `client/iwsdk.config.json` asks for hand tracking, hit testing and plane detection in an `ar` session.
  - `client/src/room-fx/room-map.ts` reads Space Setup's planes and their labels.
  - `client/src/sound/engine.ts` places sounds with an HRTF panner.
  - `client/src/offline/cache.ts` keeps the site for offline use.
- **Models:**
  - `backend/src/storyteller/turn.ts` uses Claude Sonnet 5.5.
  - `backend/src/storyteller/listen.ts` uses Groq's whisper-large-v3-turbo.
  - Live voices are OpenAI's gpt-4o-mini-tts (`art/voice/live.json`).
  - Live paintings are `seedream5_flash` (`backend/src/storyteller/paint.ts`). Prepared art is `seedream5_pro` (`art/README.md`).
  - Chapter voices are ElevenLabs `eleven_v4` through Runway (`CREDITS.md`).
- **The challenges, as they happened:** `docs/playtest-notes.md`, the sessions of Nov 12, 13 and 14, and `docs/plans/2026-11-16-hands-and-controls.md`.
- **The first-timer:** `docs/playtest-notes.md`, Nov 14: "they were amazed". They aren't named, and they aren't in any footage.
- **Not claimed, on purpose:**
  - Spatial anchors: the feature is requested, but nothing creates an anchor.
  - Depth occlusion: review builds only (`?occlusion=on`).
  - "Instant" return visits.
  - "In their own voices": the live voices aren't the chapter voices.
  - "Painted in watercolour and pencil", as though by hand.
  - "Rigged by hand": unverified.
- **The owner's choice:** whether to add one sentence to "How we built it" saying how much of the code was written with AI coding agents. It's honest, and it's the owner's call to make.

### Built with (up to 25 tags)

All 20 of these are really used: each is in a `package.json` or the backend's calls.

```
iwsdk, webxr, three.js, typescript, react, tailwindcss, vite, hono, node.js, sqlite, better-auth, zod, claude, groq, whisper, openai, runway, elevenlabs, cloudflare-pages, railway
```

There's room for five more. Candidates, in order: `web-audio-api` (the spatial sound), `seedream` (the painter), `resend` (the "Your book is ready" email). Don't add `meta-quest`; the track already says that.

### "Try it out" links

```
https://www.foldtales.xyz
```

**The GitHub repo is not listed** until the sprint master confirms whether it's public. Lane E's note says it's private, and the rules accept the hosted link instead (§4: "a link will be required for judges to access and test your application").

### Image gallery (JPG/PNG/GIF, 5 MB max each, 3:2 recommended, up to 15)

Eight images, all 3:2 at 1620 × 1080. That's a 3:2 crop from the centre of a 1920 × 1080 headset frame, saved as JPG under 1 MB.
- Images 1–7 are still frames from the filming sitting's own recordings, taken from the final cut's takes.
- Image 8 is the real page on a Mac.
- Nothing is AI video, and nothing is a render passed off as a headset frame.
- Each image carries a caption: Devpost shows it under the image.

| # | Frame | Caption |
|---|---|---|
| 1 | The open book on the real table, the lighthouse lit, its beam on the wall behind (beat 1). This is also the thumbnail | The lighthouse's beam leaves the book and crosses a real wall. Captured on Meta Quest 3. |
| 2 | The book just landed on the table, pages standing, the room dimmed (beat 3) | The book finds your table and opens within reach. |
| 3 | The hand pinching the lantern, Pip looking up (beat 5) | Pinch to hold: hand Pip his lantern. |
| 4 | The drawer open, the kite in the fingers, at the gap (beat 8) | Hand them what they need. The drawer holds the gifts. |
| 5 | The ribbon's paper card risen behind the flattened book, a fingertip on Carry on (beat 6) | Touch to press. The menu rises behind the book, never over it. |
| 6 | The sea across the real floor, a real chair standing in it (beat 12) | Chapter 2: the sea comes in across your floor. |
| 7 | The stars and the fox constellation on the real ceiling (beat 13) | Chapter 3: Pip's star on your ceiling. |
| 8 | www.foldtales.xyz on a Mac, its painted hero (the landing's layered paintings), cropped 3:2 | The page at foldtales.xyz: open it in Quest Browser, nothing to install. |

**Optional:**
- **9.** The Storyteller's talk button under a fingertip, the cast answering. Caption: *The AI Storyteller: say what tonight's story is about.* Only if beat 14 is filmed.
- **10.** A painting the cast made, framed without its "Powered by Runway" line. Caption: *Painted for you by the AI Storyteller, about 30 seconds later.*

**Rules for every frame:**
- Nobody but the owner's hands.
- No brands, screens or readable spines.
- Never the teapot keepsake.
- No sign-in name or email in view: image 8 is taken signed out.

### Demonstration video (YouTube or Vimeo URL)

**The form's field, verbatim** (from the owner, Nov 17):

> A demonstration video—under three (3) minutes, showcasing footage of your Project as viewed on a Meta VR device, via XR Simulator, or another equivalent emulator. Allowed platforms: YouTube or Vimeo only. Video length: Only the first 3 minutes will be reviewed, so include everything needed to evaluate your project within that time. Visibility: Set to public or unlisted with no password.

**What we do:**
- **Length:** 2:45–2:55, safely under 3:00. The demo beat sheet (`docs/plans/2026-11-17-film-concept.md`) estimates 2:56, so the edit takes from its cut list until it lands inside 2:45–2:55.
- **Everything a judge needs is inside that time:** the link, the table, both hand gestures, a gift, the room, pause and resume, coming back, the Storyteller, and the launch line on the end card.
- **Footage:** real Meta Quest 3 recordings only, labelled "Captured on Meta Quest 3".
- **Upload:** YouTube, **unlisted** (allowed, and it keeps it off search until we're ready), no password. English captions as an uploaded `.srt`, as well as the burned-in captions. The music bed only if it cleared Content ID on this same channel.
- **Paste:** the YouTube link once it's uploaded, then check it in a signed-out browser window before submitting.

```
[the YouTube link, after the stage 3 edit]
```

---

## Step 3: Additional info (judges and organizers only, unless noted)

### Submitter type: **OWNER**

### Country of residence: **OWNER** (it appears in the gallery)

### Email of the developer organization, Meta VR Start membership, and team members' names, emails and roles: **OWNER**

Never put these in the repo. Only the people listed here may appear or be named in the video (§4).

### Name of your Team or Organization: **OWNER**

It displays as "Foldtales" created by *Team Name*. If there's no team name, the owner's own name works.

### Track

```
Entertainment
```

### Division

```
New Experience
```

The first commit is Oct 30, 2026, inside the window that starts Sept 24, and no earlier codebase or shipped title was reused.

### Summary of updates (Adapted experiences only)

Not applicable: leave blank.

### Build Path: **OWNER, confirm the option's wording**

Pick the WebXR / IWSDK option, whatever the form calls it.

### URL of the Meta VR competition release channel (for WebXR: the hosted URL)

```
https://www.foldtales.xyz
```

### What Meta VR capability(ies) did you use in your project?

140 words.

```
Passthrough mixed reality (an immersive-ar WebXR session), hand tracking, and scene understanding through WebXR plane detection with Space Setup's semantic labels, built with Meta's Immersive Web SDK.

- Hand tracking: every interaction, with no controllers.
- Plane detection: the book finds your real table and settles within reach, with hit testing as a fallback. The room effects use the labelled walls, floor, ceiling and windows: the lighthouse beam crosses your walls, the sea comes in across your floor, and the stars come out on your ceiling.
- Spatial audio: sounds are placed in the room.
- Microphone: the AI Storyteller, hold to talk.
- Gaze tracking: look-and-pinch on Meta VR Glasses, with everything kept inside the glasses' narrower field of view.
- A room-dim layer over passthrough, like house lights going down.
- Runs from a link in Quest Browser.
```

### Describe how Hand Interactions are implemented into your experience.

218 words.

```
Hands only, no controllers. There are two gestures, and they never mix: pinch to hold the story's things, and touch to press the book's controls.

Pinch: pick up a character or an object and bring it to a character to hand it over, and they take it. Hold a page by its corner and turn it as you would paper: the leaf follows your fingers round the spine. Pull the book's drawer open and choose a gift. Drag the spine to move the book, stretch its edges with both hands to resize it, and shut the cover to pause.

Touch: tap the ribbon's tail with a fingertip. The pop-up stage folds flat, and a paper card rises behind the book, never over it, at touch distance: Carry on, Start again, Contents, Put the book away. Buttons sink under your fingertip with a soft paper tap on every press, because hands have no haptics. In the AI Storyteller, press and hold a paper talk button on the table to speak.

The first time, a ghost hand shows you the ribbon, with no words. Every control works with either hand alone and within reach while seated. A far button can be pointed at and pinched. Nothing fires from looking alone. On Meta VR Glasses, look at a target and pinch.
```

### What makes you excited about the future of VR? (150 words or less suggested)

**OWNER: a draft in the owner’s voice, 115 words. Change anything that isn't how you'd say it.**

```
For me it's the moment the room stops being where you keep the headset and becomes part of the experience. When I first saw the lighthouse's beam cross my own wall, it wasn't a special effect. It was my room joining the story.

I'm excited by experiences you can have at your kitchen table in six minutes, with your hands, and that know where you are. And by glasses light enough to wear all evening, so a story can be something you open like a book, not something you prepare for. AI makes it possible for the story to answer back. The work now is making it feel handmade, and worth coming back to tomorrow.
```

### What is the target launch date for your app, if not already published?

```
Spring 2027, on the Meta Horizon Store and Meta VR Glasses.
```

### Checkboxes: **OWNER**

The owner confirms each one personally:
- Meta VR Start member;
- age of majority;
- eligible jurisdiction;
- not a sponsor or government employee.

---

## Before pressing Submit

- Every square-bracket mark is settled.
- The project is renamed from "Holo HQ".
- The video link plays signed out, and runs 2:45–2:55.
- www.foldtales.xyz opens on a cold Quest, and the live deploy is frozen until winners are announced (lane E's note in `docs/devpost-draft.md`).
- Submitted by **20:00 IST, Nov 18**. The deadline is 12:00 PT Nov 18, which is 01:30 IST Nov 19.
