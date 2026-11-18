# The Devpost form: ready to paste

Lane S, for the Meta VR Start Developer Competition 2026. Each section below is one of the owner's form fields, in the form's own order. Each paste box is plain text or Markdown, ready to copy.

**FINAL, Nov 18, 22:30 IST.** Everything is decided against the live build (main 0309177) and the cut film. There are no marks left: every box pastes as it stands.
- Chapter 3's hunt is the page hunt now: the beam finds Wick's lost logbook glinting on the book's page, with no walking. Nothing in this copy asks anyone to get up.
- The repo is public at https://github.com/distroinfinity/foldtales (the sprint master scanned the tree and the full history for secrets: none).

**Owner-only fields** say **OWNER** and have nothing to paste. The owner's email never goes in this repo.

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

The owner's line, chosen Nov 18 (83 of 200 characters). It replaces the earlier tagline: it sells the idea (you direct, an AI cast performs, live) rather than chapter 1's plot.

```
A pop-up theater on your table. Your imagination directs. An AI cast performs live.
```

---

## Step 2: Project details (the public project page)

### About the project (Markdown; Devpost's own headings)

Nov 18: the owner's draft merged with ours (the owner's structure and voice; ours adds the link, the launch date, the in-headset chapter turn, the storm and the improv details). Cut to about 740 words at the owner's ask, no marks left: unconfirmed claims (the hunt, offline, the music bed, the frame rate) are left out, and go back in only once proven. Devpost's last heading is renamed from "What's next for Holo HQ". The field has no stated limit. Everything in it is checked against the code or the docs (sources in the notes after it).

```markdown
## Inspiration

A pop-up book already feels like a little theater. We wanted to open one and have the characters notice us.

That became Foldtales: your table is the stage, your imagination directs, and an AI cast performs live. A tiny fox looks up at you for help. You hand him back his lantern, and it lights again in his paws. Later, the lighthouse's beam leaves the page and sweeps across your living room.

## What it does

Foldtales turns your real table into a painted pop-up stage. Open www.foldtales.xyz in Quest Browser, with nothing to install. The book settles on your table within reach, the room dims like house lights going down, and the scenery unfolds. Meet Pip, a young fox in a keeper's coat far too big for him, old Wick, and Moth.

There are two ways to experience it:

- **Improvise a show with the cast (the AI Storyteller).** Hold the gold talk tab and suggest a premise, talk to the cast, or hand them something from the book's drawer. They answer out loud, act the story out, and can paint new things onto the page. The show spills into your room: rain, shadow play on your wall, fireflies that drift to your hand. Every night's show is new, and it always reaches an ending.
- **Three written chapters, *Tales from the Table's Edge*.** Turn the pages, hand characters what they need, and help Pip keep the lighthouse lit, or sit back and let it play. Chapters follow one another without leaving the headset.

The spectacle reaches beyond the table: a storm blows into your room, the lighthouse beam sweeps your walls, the sea washes across your floor, and stars appear on your ceiling.

It's hands only: pinch to hold, touch to press. A ghost hand teaches the one control, with no text to read.

## How we built it

TypeScript, Meta's Immersive Web SDK (IWSDK) and Three.js, so it runs from a link. The book finds your table from Space Setup's labelled planes, and the room effects use the same walls, floor, ceiling and windows.

The characters are layered paper puppets, animated at twelve poses a second for a stop-motion feel, painted with Seedream through Runway from our own designs.

In the AI Storyteller, Whisper on Groq transcribes your speech. Claude writes each turn as an improv partner, saying yes to your idea and building on it, and returns the cast's lines with stage directions: who acts, where they look, what happens in your room. OpenAI gives the cast live voices, and Seedream paints onto the page. The chapters use prepared ElevenLabs voices, captioned inside the book.

A small Hono server on Node, with SQLite and Better Auth, handles AI requests and accounts. We developed in IWSDK's emulator, then tested everything on a real Quest 3.

## Challenges we ran into

**Making paper belong in a real room.** Early versions floated above the table or sank into it. Placement, scale, shadows and reach all needed work.

**Making hands feel intuitive.** Pinching suits a lantern but not a button. We settled on two actions that never mix: pinch to hold, touch to press, with a soft paper tap on every press.

**Finding the right role for AI.** AI reactions inserted into a written chapter broke its pacing. Giving improvisation its own stage let the cast respond freely while the written stories stay as written.

**Keeping the performance moving.** Speech, writing and painting arrive at different speeds. Clear feedback, bounded waits and fallbacks mean a slow service never strands the show. The app, not the model, owns the ending.

## Accomplishments that we're proud of

Three complete, voiced chapters inside a real room, with one painted world and every interaction done by hand. An AI show where a spoken idea becomes a performance. And the smallest moment: Pip looking up as you hand back his lantern.

## What we learned

Handing a character something gives you a role in their world within seconds. AI improvises best inside strong theatrical boundaries: the cast, the setting, the actions and the pacing give it somewhere convincing to go. And testing in the headset changes everything: a simple beam crossing a real wall became the defining moment.

## What's next for Foldtales

We plan to launch in **spring 2027 on the Meta Horizon Store and Meta VR Glasses**, with more chapters, and Story Circle: friends sharing one performance around one table or remotely.
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

23 tags, each in a `package.json` or the backend's calls.

```
iwsdk, webxr, three.js, typescript, react, tailwindcss, vite, hono, node.js, sqlite, better-auth, zod, claude, groq, whisper, openai, runway, seedream, elevenlabs, web-audio-api, resend, cloudflare-pages, railway
```

### "Try it out" links

```
https://www.foldtales.xyz
https://github.com/distroinfinity/foldtales
```

### Image gallery (JPG/PNG/GIF, 5 MB max each, 3:2 recommended, up to 15)

The files are on the owner's Mac in `~/Movies/foldtales-film/gallery/` (not in the repo). Frames 01–12 are 1620 × 1080 crops of the real Quest 3 recordings from the filming sitting. Nothing is AI video, and nothing is a render passed off as a headset frame. The thumbnail (`00-thumbnail.png`) is an illustration: use it as the project thumbnail only, never as a gallery image that claims to be the headset view.

Recommended, in this order:

| File | Caption |
|---|---|
| `01-beam-on-your-wall.jpg` | The lighthouse's beam crosses a real wall. Captured on Meta Quest 3. |
| `03-storm-in-your-room.jpg` | A storm blows into your room as the lamp goes out. |
| `04-lantern-hand-over.jpg` | Pinch to hold: hand Pip his lantern. |
| `05-ribbon-pause-card.jpg` | Touch to press: the ribbon pauses the story, and the card rises behind the book. |
| `07-sea-on-your-floor.jpg` | Chapter 2: the sea comes in across your floor. |
| `08-snow-on-your-floor.jpg` | Chapter 3: snow on your floor. |
| `09-stars-on-your-ceiling.jpg` | Chapter 3: the stars come out on your ceiling. |
| `10-ai-painted-crane.jpg` | The AI Storyteller: ask for a paper crane, and it's painted onto the page. |
| `11-ai-rabbit-and-stars.jpg` | The cast improvise with you: a rabbit, rain and stars, all asked for out loud. |
| `12-story-saved-as-a-chapter.jpg` | Every story you make is saved in the book, like a chapter. |
| `08-landing-page.jpg` | The page at foldtales.xyz: open it in Quest Browser, nothing to install. |

Spares: `02-book-on-your-table.jpg`, `06-ladder-from-the-drawer.jpg`.

### Demonstration video (YouTube or Vimeo URL)

**The form's field, verbatim** (from the owner, Nov 17):

> A demonstration video—under three (3) minutes, showcasing footage of your Project as viewed on a Meta VR device, via XR Simulator, or another equivalent emulator. Allowed platforms: YouTube or Vimeo only. Video length: Only the first 3 minutes will be reviewed, so include everything needed to evaluate your project within that time. Visibility: Set to public or unlisted with no password.

**The film:** `~/Movies/foldtales-film/edit/foldtales-demo-v4.mp4`, **2:48**, real Quest 3 recordings of the live build, with plain on-screen labels. The last minute is the AI Storyteller. English captions: `foldtales-demo.en.srt`, uploaded to YouTube as subtitles.

**Upload:** YouTube, **Unlisted**, no password. Check that the link plays in a signed-out window, then paste it here.

```
[the YouTube link]
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

About 150 words.

```
Built with Meta's Immersive Web SDK as a passthrough mixed reality (immersive-ar) WebXR session in Quest Browser.

- Hand tracking: every interaction, with no controllers. Pinch to hold, touch to press.
- Scene understanding: WebXR plane detection with Space Setup's semantic labels. The book finds your real table and settles within reach, with hit testing as a fallback. The room effects use the labelled walls, floor, ceiling and windows: the lighthouse beam crosses your walls, a storm flashes at your real window, the sea comes in across your floor, and the stars come out on your ceiling.
- Spatial audio: voices and sounds are placed in your room.
- Microphone: hold to talk with the AI cast.
- Gaze tracking: look-and-pinch on Meta VR Glasses, with everything kept inside the glasses' narrower field of view.
- A room-dim layer over passthrough, like house lights going down.
- Runs from a link in Quest Browser, nothing to install.
```

### Describe how Hand Interactions are implemented into your experience.

About 220 words.

```
Hands only, no controllers. There are two gestures, and they never mix: pinch to hold the story's things, and touch to press the book's controls.

Pinch: pick up a character or an object and bring it to a character to hand it over, and they take it. The first thing you can hand over glows, so you know what to reach for. Hold a page by its corner and turn it like paper: the leaf follows your fingers round the spine. Pull the book's drawer open and choose a gift. Drag the spine to move the book, stretch its edges with both hands to resize it, and shut the cover to pause.

Touch: tap the ribbon's tail with a fingertip. The pop-up stage folds flat and a paper card rises behind the book, never over it, at touch distance: Carry on, Start again, Contents, Put the book away. Buttons sink under your fingertip with a soft paper tap, because hands have no haptics. In the AI Storyteller, press and hold the gold talk tab on the book's edge to speak, and let go to send.

The first time, a ghost hand shows you the ribbon, with no words. Every control works with either hand, within reach while seated. A far button can be pointed at and pinched, and nothing fires from looking alone. On Meta VR Glasses, look at a target and pinch.
```

### Testing instructions (if the form asks for them)

```
On a Meta Quest 3 or 3S, open https://www.foldtales.xyz in Quest Browser and tap Open the book. Allow the browser to use the room when asked. Sit at a table if you can (Space Setup helps the book find it); without one, choose "No table? Read in the painted room". Hands only. Each of the three chapters takes about six minutes, and when one ends the next opens in the book, without leaving the headset. In chapter 3, the lighthouse beam finds Wick's lost logbook glinting on the book's page. To pause or leave, touch the ribbon's tail at the book's near edge with a fingertip. The AI Storyteller needs sign-in (Google, or a code finished on your phone) and the microphone: hold the gold talk tab on the book's edge to speak, and let go to send.
```

### What makes you excited about the future of VR? (150 words or less suggested)

**OWNER: a draft in the owner's voice, about 125 words. Change anything that isn't how you'd say it.**

```
For me, it's the moment the room stops being where you keep the headset and becomes part of the experience. The first time I saw the lighthouse's beam leave the book and cross my own wall, it wasn't an effect. It was my room joining the story.

Now add AI, and the room can answer back. A paper cast on my table can hear my idea, improvise a scene around it, and bring rain or fireflies into my living room. That's not a game or a film. It's closer to live theater, made for one evening and one person.

And as headsets become glasses light enough to wear all evening, a story like that can be something you open like a book, not something you set up for.
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

- The project is named Foldtales, not "Holo HQ".
- The video link plays signed out; the film runs 2:48.
- Track: Entertainment. Division: New Experience.
- www.foldtales.xyz opens on a cold Quest, and the live deploy is frozen until winners are announced (lane E's note in `docs/devpost-draft.md`).
- Submitted by **23:30 IST, Nov 18**. The deadline is 12:00 PT Nov 18, which is 01:30 IST Nov 19.
