# The Devpost form: ready to paste

Lane S, Nov 17, 2026, for the Meta VR Start Developer Competition 2026. Each section below is one of the owner's form fields, in the form's own order (from the owner's list of every field, Nov 17). Each paste box is plain text or Markdown, ready to copy. Every limit is checked by a character or word count, given beside it.

**Before pasting, settle the marks.** Square-bracket marks such as **[if the hunt passes]** belong to claims that depend on Nov 18:
- If the claim holds, delete only the mark.
- If it doesn't, delete the mark and the sentence after it.

| Mark | Decided by |
|---|---|
| **[if the hunt passes]** | Tonight's filming: the hunt is walked in chapter 3 as a shot. If it fails, the sentence goes |
| **[if the bed clears]** | Whether the CC0 piano bed plays in the live build. It describes the product, not the film, so no Content ID test is needed for it |
| **[if offline passed]** | Headset session step 24 |
| **[if the Storyteller is live]** | Lane D's launch switch (it's waiting on the Google consent-screen rename). This mark covers the **whole** "The AI Storyteller" paragraph, not one sentence |
| **[fps]** | The frame-rate pass. Keep "85–90 fps" only if the pass confirms it |

**Owner-only fields** say **OWNER** and have nothing to paste. The owner's email never goes in this repo.

The draft project on Devpost is currently named "Holo HQ", a placeholder. Rename it first.

### What can go in tonight, and what waits

Updated Nov 18, 20:00 IST: F1–F3 and the talk tab are live. Everything except the video, the gallery and the marks below can be pasted now.

| Field | Status |
|---|---|
| Project name, Elevator pitch | **Final.** Paste now |
| About the project | **Paste now.** Lanes F1–F3 are live (main 0f8dcfc), so their marks are gone. For each mark still left, delete the mark and keep the sentence if it holds, or delete the sentence (the table above) |
| Built with | **Final.** Paste now |
| Try it out | **Paste the site now.** The GitHub repo waits for the owner's answer: is it public? |
| Image gallery | **Waits** for the filming sitting tonight. Image 8, the page on a Mac, can be taken now |
| Demonstration video | **Waits** for the film |
| Track, Division, URL, Summary (blank) | **Final.** Paste now |
| Capabilities, Hand Interactions | **Final.** Paste now |
| Future of VR | **Owner:** edit the draft into your own words, then paste |
| Launch date | **Final.** Paste now |
| OWNER fields and checkboxes | **Owner,** any time |

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

The owner's line, chosen Nov 18 (81 of 200 characters). It replaces the earlier tagline: it sells the idea (you direct, an AI cast performs, live) rather than chapter 1's plot.

```
A pop-up theater on your table. Your imagination directs. An AI cast performs live.
```

---

## Step 2: Project details (the public project page)

### About the project (Markdown; Devpost's own headings)

Rewritten Nov 18 around the new pitch: it leads with the improvised show. About 1,110 words, no marks left: unconfirmed claims (the hunt, offline, the music bed, the frame rate) are left out, and go back in only once proven. Devpost's last heading is renamed from "What's next for Holo HQ". The field has no stated limit. Everything in it is checked against the code or the docs (sources in the notes after it).

```markdown
## Inspiration

Evenings are when we reach for a story, and on a screen you only watch. We wanted live theater instead: a stage small enough to sit on your own table, a paper cast who know you're in the room, and a show you direct just by saying what tonight's story is about.

So we built it like an improv troupe, not a storybook app. The cast say yes to your idea, build on it, and play it out in front of you, in your room. And it's pop-up paper, so it feels handmade, not generated.

## What it does

Foldtales is a pop-up theater on your table. Your imagination directs; an AI cast performs live.

Open www.foldtales.xyz in Quest Browser. There's nothing to install. The book finds your real table and settles within reach, the room dims like house lights going down, and painted paper sets stand up. The first time, a ghost hand shows you the one control, and the first thing you can hand over glows.

**The improvised show.** Hold the gold talk tab on the book's edge and say what tonight's story is about, or hand the cast something from the book's drawer. The cast make the story up with you, scene by scene, and answer out loud in live voices. Ask for something and it's painted onto the page about 30 seconds later. They bring the story into your room: rain, giant shadow play on your wall, fireflies that drift to your hand. You direct, they perform, and every night's show is new. The app always brings the ending home, even if the AI is slow.

**The written chapters.** *Tales from the Table's Edge* is three authored, fully voiced chapters about Pip, a young fox in a keeper's coat far too big for him, who wants to keep the lighthouse like old Wick. You hand him his lantern, turn the pages by their corners, and pull open the drawer to choose what gets him across a gap. Your room is the stage:
- **Chapter 1:** the lighthouse's beam leaves the book and sweeps across your real walls, and a storm comes into your room when the lamp blows out.
- **Chapter 2:** the tide comes in across your floor, and a paper boat sails home on it.
- **Chapter 3:** snow comes to the table's edge, and the stars come out on your ceiling, with Pip's own star among them.

When a chapter ends, the next one opens in the book, without leaving the headset. Touch the ribbon to pause: the stage folds flat and a paper card rises behind the book, never over it. The book keeps your place. "Same time tomorrow, keeper?"

## How we built it

- **The improvising cast.** Your speech is transcribed with Whisper on Groq. Claude writes each turn as an improv partner: say yes, build on what you said, and make something you can *see* happen, within the cast's characters and the world's rules. Each turn comes back as stage directions as well as lines: who speaks, how they act, where they look, and what happens in your room. OpenAI's text-to-speech gives the cast their live voices, and Seedream, through Runway, paints new things onto the page.
- **The engine.** Built for the web with Meta's Immersive Web SDK (IWSDK) and Three.js, in TypeScript, so it opens from a link. The book finds your table from Space Setup's labelled planes, with hit testing as a fallback, and the room effects use the same planes: walls, floor, ceiling and windows.
- **The puppets.** Every character is a cut-out paper puppet, animated at twelve poses a second, like stop-motion. The art was painted with AI (Seedream, through Runway) from our own sketches and written designs, then cut out and layered.
- **Voice and sound.** The chapters' voices are ElevenLabs voices, recorded ahead through Runway. Every line is captioned inside the book. Sounds are placed in your room with spatial audio.
- **Behind it.** A small Hono server on Node, with SQLite and Better Auth, runs on Railway. The site is on Cloudflare Pages.

## Challenges we ran into

- **AI inside a written story felt like interference.** Our first attempt spliced AI reactions into chapter 1, and in the headset it felt like a script with if-else branches. So the written chapters play exactly as written, and the AI got its own stage: the improvised show, where the whole story is made up with you.
- **Making improv feel like theater, not chat.** A reply in text is not a performance. Every turn had to become something you see on the table or in your room: a character acting, a painting arriving, weather coming in. The show also has to end well every time, so the app owns the ending, not the model.
- **Finding the table.** In our first headset session, Pip floated in mid-air. Later the book sank into the table, and hands couldn't reach it. Aiming the search lower, and settling the book fully on the scanned table top, fixed both.
- **Pinch for everything was wrong.** Pressing buttons by pinching felt unnatural. Now there are two gestures that never mix: pinch to hold the story's things, and touch to press the book's controls, each press with a soft paper tap because hands have no haptics.

## Accomplishments that we're proud of

- A cast that improvises a new show with you, out loud, and still feels handmade.
- Three complete, voiced chapters in which your room takes part: your walls, your floor and your ceiling.
- The first time someone who had never seen it played it, they were amazed.
- It opens from a link, in seconds, with nothing to install, on a real table in a room we've never seen.

## What we learned

- An authored story and an improvised one want different stages. Mixing them inside one chapter weakened both.
- Improv needs a stage, not a chat box. The AI is only as good as what it can make happen in front of you.
- Show, don't tell. A looping ghost hand teaches the one control better than any text panel we tried.
- Passthrough matters when the room changes the story. Every room effect is there because the story needs it.

## What's next for Foldtales

We plan to launch in **spring 2027 on the Meta Horizon Store and on Meta VR Glasses**. Before then:
- more chapters, and more of the world for the cast to improvise in;
- Story Circle: friends around one table, or remote, directing one show together;
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
- **Everything a judge needs is inside that time:** the beam leaving the lighthouse (the hook), the link, the table, both hand gestures, a gift, the room, pause and resume, the next chapter in the headset, the Storyteller, and the launch line on the end card.
- **Filmed tonight on the final build** (main 0f8dcfc), as `docs/plans/2026-11-18-filming-plan.md` sets out.
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

230 words with the mark in, 227 without.

```
Hands only, no controllers. There are two gestures, and they never mix: pinch to hold the story's things, and touch to press the book's controls.

Pinch: pick up a character or an object and bring it to a character to hand it over, and they take it. Hold a page by its corner and turn it as you would paper: the leaf follows your fingers round the spine. Pull the book's drawer open and choose a gift. Drag the spine to move the book, stretch its edges with both hands to resize it, and shut the cover to pause.

Touch: tap the ribbon's tail with a fingertip. The pop-up stage folds flat, and a paper card rises behind the book, never over it, at touch distance: Carry on, Start again, Contents, Put the book away. Buttons sink under your fingertip with a soft paper tap on every press, because hands have no haptics. In the AI Storyteller, press and hold the gold talk tab at the book's near edge to speak.

The first time, a ghost hand shows you the ribbon, with no words. The first thing you can hand over is highlighted. Every control works with either hand alone and within reach while seated. A far button can be pointed at and pinched. Nothing fires from looking alone. On Meta VR Glasses, look at a target and pinch.
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
