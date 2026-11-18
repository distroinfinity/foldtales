# Devpost draft: ready to paste

Lane E, Nov 17, for main at 2a22af1. Each field below is copied from `docs/submission.md`, where the copy is kept and reasoned; `tests/devpost-draft.test.ts` fails if the two drift apart. Paste each box as it stands into the Devpost form for the Meta VR Start Developer Competition 2026.

**Deadline:** Wed Nov 18, 12:00 PM PT (Thu Nov 19, 1:30 AM IST). **Submit by 20:00 IST on Nov 18.** Start the draft on Devpost today, Nov 17: Devpost keeps a draft, and it can be edited until the deadline.

**Superseded on Nov 18:** the paste-ready copy is `docs/devpost-form.md` (final). Chapter 3's hunt is now the page hunt (the beam finds the logbook on the book's page, no walking), so no hunt mark is left here either.

## The form

| Field | Paste |
|---|---|
| Project name | Foldtales |
| Track | Entertainment |
| Division | New Experience |
| Link to try it | https://www.foldtales.xyz |
| Video | The public YouTube link, once the video is cut (under 3:00) |
| Target launch date | Spring 2027, on the Meta Horizon Store and Meta VR Glasses |
| Built with (if asked) | webxr, immersive-web-sdk, three.js, typescript, react, tailwind-css, hono, better-auth, claude, openai, groq, runway, elevenlabs, cloudflare-pages, railway |

### Tagline

<!-- tagline -->
A painted pop-up storybook opens on your real table. Reach in, hand the characters what they need, and watch your room join the story.
<!-- /tagline -->

### Description (Devpost's "About the project"; it takes Markdown, so the bold headings carry over)

<!-- description -->
**Inspiration.** Evenings are when people reach for stories: a show, an audiobook, a cozy game. On a screen you only watch. We wanted the story to happen on your own table, at a scale you can lean over and reach into, the way a pop-up book feels when you're small. Foldtales is a painted storybook for winding down: no score, no losing, about six minutes a chapter, and only your hands.

**What it is.** Open the link in Quest Browser and tap Open the book. The book finds your real table and unfolds, the room dims like house lights going down, and the pages stand up as paper sets. In *Tales from the Table's Edge*, Pip, a young fox in a keeper's coat far too big for him, loses the lighthouse's light. You hand his lantern back, turn the pages by hand, and pick something from the book's drawer to get him across a gap. The story waits for you, but never needs you: it plays to its end with no input at all. When the lamp is relit, its beam sweeps across your real walls. In chapter 2 the tide comes in across your floor with a letter from Thimble, a field mouse lost at sea. In chapter 3, on the longest night, snow comes to the table's edge and old Wick is lost in it.

**Your room is part of the story.** Mixed reality isn't a backdrop here. The book settles on whatever table your Quest has found, sized to it and within reach, and the lighthouse's beam lights up your real room. In chapter 2 the sea washes across your floor and a paper boat sails home on it. In chapter 3 snow falls around you, and the stars come out on your ceiling, Pip's own among them. The beam finds Wick's lost logbook glinting on the book's page. With the AI Storyteller the cast can also bring rain, shadow play on your wall, fireflies that follow your hand, and your real window becoming the story's window.

**The AI Storyteller.** Beside the written chapters, the same cast improvises a new story with you. Say what tonight's story is about, or just hand them something; they answer in their own voices, can paint what you ask for, and can bring weather into your room. The app always owns the ending, and the story finishes cleanly if the AI is slow or unavailable.

**How we built it.** Foldtales is built for the web with Meta's Immersive Web SDK and Three.js, so it opens from a link with nothing to install. Every character is a cut-out puppet, painted in watercolour and pencil, rigged in layers and animated at twelve poses a second like stop-motion. The art was painted with AI from our own designs and references, then cut out, finished and rigged by hand; chapter voices were recorded with ElevenLabs, and a quiet CC0 piano bed plays under the story. Chapter 1 runs at 85–90 fps on Quest 3, and the site caches itself for instant return visits.

**What's next.** We plan to launch in spring 2027, on the Meta Horizon Store and on Meta VR Glasses. Before then: more chapters of the book, room effects that remember your room, and Story Circle, with friends around one table or remote, each bringing their own satchel of keepsakes into a shared story.
<!-- /description -->

### How hands are used

<!-- hands -->
Everything is done with your hands, and no controllers are needed. There are two verbs, and they never mix: pinch to hold the story's things, touch to press the book's controls. Pinch or grab a character or object to pick it up, and bring it to a character to hand it over: they take it and turn it over. Hold a page's corner and turn it as you would paper, or look at the corner and pinch. Pull the drawer open to choose what to give. Shut the cover to pause, drag the spine to move the book, and stretch it with both hands to resize it. Touch the ribbon's tail with a fingertip for the book's one menu. The pop-up stage folds flat, then a paper card rises behind the book, never over it, at touch distance: carry on, start again, contents, put the book away. Its buttons sink under your fingertip, with a soft paper tap on every press, because hands have no haptics. The first time, a ghost hand shows you the ribbon, with no words. Every control works with either hand alone and within reach when seated, and a far button can be pointed at and pinched. Nothing fires from looking alone. In the AI Storyteller, press and hold the paper talk button on the table with a fingertip to speak, or hand things over without speaking.
<!-- /hands -->

### Designed for the narrow field of view (VR Glasses)

<!-- fov -->
The whole book, its caption band and its controls fit inside the glasses' 74° × 68° view when you look at it. On glasses, look at a target and pinch with either hand: look at the kite and pinch, then look at Pip and pinch, and the kite floats to him. When the book pauses, its menu card stands just above the flattened book, inside the view. Nothing fires from gaze alone. Captions are printed on the book's own page in Atkinson Hyperlegible, never floating over the room.
<!-- /fov -->

### Testing instructions

<!-- testing -->
On a Meta Quest 3 or 3S, open https://www.foldtales.xyz in Quest Browser and tap Open the book. Allow the browser to use the room when asked. Sit at a table if you can (Space Setup helps the book find it); without one, choose "No table? Read in the painted room". Use your hands only. Each of the three chapters takes about six minutes; each follows from the end card before it, or from Your book on the page. In chapter 3, the lighthouse beam finds Wick's lost logbook glinting on the book's page. To pause or leave, touch the ribbon's tail at the book's near edge with a fingertip. The AI Storyteller needs sign-in (a code finished on your phone, or Google) and the microphone.
<!-- /testing -->

## The video: nine shots, under 3:00

Filmed in one sitting after the headset session, from real Quest recordings (Meta button → camera → Record video), and pulled over USB. **Before any filming:** the step-12 test recording must show both the app's layer and the voices, and the music bed must have cleared Content ID (below), or be removed.

**Rules for every shot** (Official Rules §4): real Quest footage, in English; nobody but the team in frame; no brands, logos or other screens in the room; never the satchel keepsake named after a real person (the teapot).

**Where:** a tidy table, evening light, plain walls, one real window in view, nothing branded. Seated, hands only (standing only to fetch the logbook in the hunt). The live link, except shot 1 and shot 6's rain, which come from a review build over USB (the same build).

| # | Time | Shot | Recorded from | Look and listen for |
|---|---|---|---|---|
| 1 | 0:00–0:12 | **The hook:** the lighthouse's beam sweeps across the real room, then Pip's lantern goes out | Chapter 1, the end (`?jump=the-beam` on a review build), then the opening | The beam crossing real walls; the room dim |
| 2 | 0:12–0:30 | Tap Open the book in Quest Browser. The book finds the table and unfolds, the room dims, the pages stand up | From the page, first visit | No headset-UI clutter; the found-surface wash |
| 3 | 0:30–0:50 | Hand the lantern back to Pip: pinch, bring it to him, let go; his relief | Chapter 1 | A clean single grab; Pip's hop |
| 4 | 0:50–1:05 | Turn the page by hand to the shore; lean to show the layers' parallax | Chapter 1 | The leaf following the pinch |
| 5 | 1:05–1:25 | Pull the drawer, pick the kite, hand it over at the gap; Pip crosses on it | Chapter 1, the gap | What you gave decides the crossing |
| 6 | 1:25–1:50 | **Your room joins in:** the sea on the floor with the paper boat, snow settling on the real table, the beam finding Wick's logbook on your floor, stars on the ceiling | Chapters 2 and 3 on the live link (the hunt only if it passed step 17); rain, if there's room, from a review link (`?room=rain`) | Two or three seconds each, framed wide |
| 7 | 1:50–2:25 | The AI Storyteller: ask for tonight's story, hand over the paper boat, and they answer in voice; a painting arrives | The Storyteller, signed in | One continuous exchange, not cut mid-line |
| 8 | 2:25–2:40 | Touch the ribbon: the stage folds flat, the menu card rises behind it; press Put the book away | Any chapter | One fingertip touch, one card; the stage never covered |
| 9 | 2:40–2:55 | The end page and "More chapters on the way" on the page; title card: Foldtales, www.foldtales.xyz | Chapter 1's end and the page | Hold for the URL |

**Cut list if the edit runs long:** drop shot 8 first, then shorten shot 6 to two effects. Never cut shots 1, 3 or 5.

**If shot 7 can't be filmed** (the AI not live on the deployed site by Nov 18), give its 35 seconds to shots 5 and 6, and drop the Storyteller line from the description.

**Captions:** the cast speaks in every shot, and the rules ask for English captions when anyone speaks (Official Rules §4). The book's own printed captions are in the footage. On YouTube, also add English subtitles: lane E writes an `.srt` from the final cut's lines, or YouTube's automatic captions are corrected by hand before the video goes public.

## What the owner approves or decides, off the headset

Everything here can be done now. The Quest waits for one sitting: the session (`docs/headset-session.md`), the step-12 test recording, and the frame-rate pass.

### 1. Approve the copy

Read the five boxes above and reply "approved", or with changes. Four claims depend on things that aren't settled yet:
- **"a quiet CC0 piano bed plays under the story"** (description, "How we built it") stands only if the bed stays: your verdict in session step 4, and a clean Content ID check (2, below). If either drops it, cut those words, and About's music credit goes with them (lane E does both).
- **The AI Storyteller's lines** stand if it's switched on and live on Nov 18. If not: drop its paragraph and the end of the testing instructions, and give shot 7's 35 seconds to shots 5 and 6.
- **"Chapter 1 runs at 85–90 fps on Quest 3"** is from earlier Quest sessions (`docs/room-effects.md`). The frame-rate pass re-checks it; if it reads lower, the number changes.
- **The hunt:** settled. It's the page hunt now (main 0309177), described as the beam finding the logbook on the page.

### 2. The music bed's Content ID test (about 15 minutes, mostly waiting)

The test video is made: a plain dark frame with the finished bed (`client/public/sound/music/bed.mp3`, SHA-256 `c8296a24…3bbc`) played twice as its whole soundtrack, 3:15 long. Lane E built it on Nov 17, outside the repo (the path is in lane E's report). If it's gone, rebuild it with `ffmpeg -f lavfi -i "color=c=0x15110e:s=1280x720:r=24" -stream_loop 1 -i client/public/sound/music/bed.mp3 -map 0:v -map 1:a -c:v libx264 -tune stillimage -pix_fmt yuv420p -c:a aac -b:a 192k -shortest bed-test.mp4`.

1. On the channel the submission video will go to, open YouTube Studio → **Create → Upload videos**, and choose the file.
2. Title it anything, such as "bed test". Set **Visibility: Private** from the start.
3. Go to the **Checks** step and wait for the copyright check to finish (usually a few minutes; the Studio list shows it under "Restrictions" too).
4. Tell lane E the result: **"No issues found"**, or the claim's text and claimant. Lane E records it, with the date and the private video's ID, in `art/sound/music/LICENCE.md`.
5. **A claim** (likely only if someone has registered this CC0 track or a derivative of it): dispute it from Studio, citing the CC0 dedication (https://freesound.org/people/CVLTIV8R/sounds/810857/). If it isn't cleared before filming, lane E deletes `bed.mp3`. The engine plays no music when the file is missing, and the copy loses its music line.
6. Delete the test video afterwards, or leave it private.

### 3. The Devpost page itself

- **Team:** you alone, or anyone else who should be listed as an entrant. Only entrants may appear or be named in the video.
- **A thumbnail and gallery images:** recommended. Either stills from the filming sitting (best: the book open on the table with the beam on the wall), or lane E can make them from the landing page's paintings now. Say which.
- **The repository stays private.** The rules accept the live link in place of a GitHub page (Official Rules §4, plan section 1).

### 4. Keeping it up for the judges (until winners are announced, about Dec 11)

- **Freeze after submitting:** pause automatic deploys in Cloudflare Pages (the project's Settings → Builds → pause) and in Railway, or agree that nothing merges to main until Dec 11. Judging uses the entry as it stood at the deadline.
- **Running costs:** Railway's plan, plus the AI caps (lane D: 150 stories a day for everyone), must last about three weeks of judges. Confirm the payment method covers it, and the Runway, OpenAI, Groq and Anthropic balances or limits.

### 5. Recommended, optional

- **Groq Zero Data Retention:** GroqCloud console → Settings → Data Controls → Zero Data Retention, on. Privacy's wording no longer depends on it (it promises no "isn't kept"), but it's the stronger setting.

### For the record (no decision needed)

- **The legal pages are live with this PR:** Terms at `/terms/` (new, linked from the page's foot and from Privacy), Privacy with each service named and your email, and About's full credits. They're pasted from `docs/legal-copy.md`. Terms carries Runway's required end-user terms (§2.5) and OpenAI's AI-voice disclosure.
- **One licence gap stays open:** `@drawcall/uikitml` (pulled in by IWSDK) publishes no licence, and `notices.txt` says so.
