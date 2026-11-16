# Submission: the Devpost form and the video

Lane E, Nov 16. Every claim here is about something built. Lines marked **[if merged]** describe chapters 2 and 3 and the room effects they bring (lanes B and C, PR #35), still open on Nov 16. The AI Storyteller merged on Nov 16 (PR #30); its lines stand as long as it is live on the deployed site on Nov 18.

On Nov 18, before submitting, delete each marked line whose work didn't merge, and drop the marks. `tests/submission.test.ts` checks the tagline's length and the description's word count.

**Deadline:** Wednesday, Nov 18, 2026, 12:00 PM PT (Thursday, Nov 19, 1:30 AM IST). Submit by **20:00 IST on Nov 18**, from a draft started on Nov 17.

## The form

| Field | Entry |
|---|---|
| Project name | Foldtales |
| Track | Entertainment |
| Division | New Experience (first commit Oct 30, 2026; the window opened Sep 24) |
| Link | https://www.foldtales.xyz |
| Video | The YouTube link (public), under 3:00 |
| Target launch date | Spring 2027, on the Meta Horizon Store and Meta VR Glasses (owner, Nov 16) |

### Tagline (under 140 characters)

<!-- tagline -->
A painted pop-up storybook opens on your real table. Reach in, hand the characters what they need, and watch your room join the story.
<!-- /tagline -->

### Description (about 500 words)

<!-- description -->
**Inspiration.** Evenings are when people reach for stories: a show, an audiobook, a cozy game. On a screen you only watch. We wanted the story to happen on your own table, at a scale you can lean over and reach into, the way a pop-up book feels when you're small. Foldtales is a painted storybook for winding down: no score, no losing, about six minutes a chapter, and only your hands.

**What it is.** Open the link in Quest Browser and tap Open the book. The book finds your real table and unfolds, the room dims like house lights going down, and the pages stand up as paper sets. In *Tales from the Table's Edge*, Pip, a young fox in a keeper's coat far too big for him, loses the lighthouse's light. You hand his lantern back, turn the pages by hand, and pick something from the book's drawer to get him across a gap. The story waits for you, but never needs you: it plays to its end with no input at all. When the lamp is relit, its beam sweeps across your real walls.

**Your room is part of the story.** Mixed reality isn't a backdrop here. The book settles on whatever table your Quest has found, sized to it and within reach, and the lighthouse's beam lights up your real room. **[if merged]** The story reaches further into the room around you: shadow play on your wall, fireflies, rain and snow falling around you, stars and the moon on your ceiling, the sea across your floor with a paper boat sailing on it, and your real window becoming the story's window. Chapter 2 brings the sea in across your floor; chapter 3 puts the night sky on your ceiling.

**The AI Storyteller.** Beside the written chapters, the same cast improvises a new story with you. Say what tonight's story is about, or just hand them something; they answer in their own voices, can paint what you ask for, and can bring weather into your room. The app always owns the ending, and the story finishes cleanly if the AI is slow or unavailable.

**How we built it.** Foldtales is built for the web with Meta's Immersive Web SDK and Three.js, so it opens from a link with nothing to install. Every character is a cut-out puppet, painted in watercolour and pencil, rigged in layers and animated at twelve poses a second like stop-motion. The art was painted with AI from our own designs and references, then cut out, finished and rigged by hand; chapter voices were recorded with ElevenLabs, and a quiet CC0 piano bed plays under the story. Chapter 1 runs at 85–90 fps on Quest 3, and the site caches itself for instant return visits.

**What's next.** We plan to launch in spring 2027, on the Meta Horizon Store and on Meta VR Glasses. Before then: more chapters of the book, room effects that remember your room, and Story Circle, with friends around one table or remote, each bringing their own satchel of keepsakes into a shared story.
<!-- /description -->

### How hands are used

<!-- hands -->
Everything is done with your hands, and no controllers are needed. Pinch or grab a character or object to pick it up, and bring it to a character to hand it over: they take it and turn it over. Hold a page's corner and turn it as you would paper, or look at the corner and pinch. Pull the drawer open to choose what to give. Shut the cover to pause, drag the spine to move the book, and stretch it with both hands to resize it. Pinch the ribbon for the book's one menu: carry on, start again, contents, put the book away. Every control works with either hand alone and within reach when seated. Nothing fires from looking alone. In the AI Storyteller, press the paper talk button on the table with a fingertip or a pinch to speak, or hand things over without speaking.
<!-- /hands -->

### Designed for the narrow field of view (VR Glasses)

<!-- fov -->
The whole book, its caption band and its controls fit inside the glasses' 74° × 68° view when you look at it. On glasses, look at a target and pinch with either hand: look at the kite and pinch, then look at Pip and pinch, and the kite floats to him. Nothing fires from gaze alone. Captions are printed on the book's own page in Atkinson Hyperlegible, never floating over the room.
<!-- /fov -->

### Testing instructions

<!-- testing -->
On a Meta Quest 3 or 3S, open https://www.foldtales.xyz in Quest Browser and tap Open the book. Allow the browser to use the room when asked. Sit at a table if you can (Space Setup helps the book find it); without one, choose "No table? Read in the painted room". Use your hands only. Chapter 1 takes about six minutes. Pinch the ribbon at the book's near edge to pause or leave. The AI Storyteller needs sign-in (a code finished on your phone, or Google) and the microphone.
<!-- /testing -->

## The video's shot list (under 3:00, real Quest footage)

**Rules that bind every shot** (Official Rules §4):
- Real Quest recordings only, in English.
- Nobody but the team in frame.
- No brands, logos or screens showing other content in the room.
- Not the satchel keepsake named after a real person.
- Any music must have cleared its private YouTube test (run 027).

**Before filming (Nov 17):** a 30 s test recording with sound. Meta button → camera → Record video. Pull it over USB, and check that both the app's layer and the voices are in it (they weren't in two earlier tests).

**Where:** a tidy table, evening light, plain walls, one real window in view, nothing branded. The live link, seated, hands only.

| # | Time | Shot | Recorded from | Look and listen for |
|---|---|---|---|---|
| 1 | 0:00–0:12 | **The hook:** the lighthouse's beam sweeps across the real room, then Pip's lantern goes out | Chapter 1, the end (`?jump=the-beam` on a review build), then the opening | The beam crossing real walls; the room dim |
| 2 | 0:12–0:30 | Tap Open the book in Quest Browser. The book finds the table and unfolds, the room dims, the pages stand up | From the page, first visit | No headset-UI clutter; the found-surface wash |
| 3 | 0:30–0:50 | Hand the lantern back to Pip: pinch, bring it to him, let go; his relief | Chapter 1 | A clean single grab; Pip's hop |
| 4 | 0:50–1:05 | Turn the page by hand to the shore; lean to show the layers' parallax | Chapter 1 | The leaf following the pinch |
| 5 | 1:05–1:25 | Pull the drawer, pick the kite, hand it over at the gap; Pip crosses on it | Chapter 1, the gap | What you gave decides the crossing |
| 6 | 1:25–1:50 | **Your room joins in:** rain all round, snow settling on the real table, the sea on the floor with the paper boat, stars on the ceiling | Review links, one effect each (`?room=`) | Two or three seconds each, framed wide |
| 7 | 1:50–2:25 | The AI Storyteller: ask for tonight's story, hand over the paper boat, and they answer in voice; a painting arrives | The Storyteller, signed in | One continuous exchange, not cut mid-line |
| 8 | 2:25–2:40 | The ribbon's menu card, and putting the book away | Any chapter | One pinch, one card |
| 9 | 2:40–2:55 | The end page and "More chapters on the way" on the page; title card: Foldtales, www.foldtales.xyz | Chapter 1's end and the page | Hold for the URL |

**Cut list if the edit runs long:** drop shot 8 first, then shorten shot 6 to two effects. Never cut shots 1, 3 or 5.

**If shot 7 can't be filmed** (the AI not live on the deployed site by Nov 18), give its 35 seconds to shots 5 and 6, and drop the Storyteller line from the description.
