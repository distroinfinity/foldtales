# The owner's headset session: the live site, once

One sitting, about 45 minutes, on the build that will be submitted. It merges three lanes' steps into one pass, in the order a reader meets things:
- lane A's (the page, the book's controls, endings);
- lane D's (sign-in, the AI Storyteller);
- lane E's (the must-pass list: cold start, either hand, pausing, reloading, offline, seated reach).

Every path already passed in the emulator. This session is for feel, look and sound, and for the few things only a real Quest shows: the hands' models offline, the mix on its speakers, and frame rate. Just play, and say what you notice in plain words. Telemetry, tagged with the build, reaches the agents on its own.

## Before you start

- **The build:** on the Mac, `www.foldtales.xyz` shows "Sign in" at the top. Under the AI Storyteller's door is the line "… made by AI, not people. Powered by Runway". If either is missing, the latest deploy isn't live yet: wait, and reload.
- **The Storyteller is on** (lane D's setup steps 1–3, `docs/plans/2026-11-15-finish-ai-storyteller.md`).
- **Seated at a table you've set up in Space Setup,** in ordinary evening light. Controllers in a drawer for the whole session.
- **Quest Browser:** clear the browsing data for `www.foldtales.xyz` in Quest Browser's settings (its cache and site data), so the first step is a real first visit.

## The session

| # | Do | Look and listen for | From |
|---|---|---|---|
| 1 | Open **https://www.foldtales.xyz** on home Wi-Fi | Say roughly how long until the page appears, and until "Open the book" stops saying "Getting the book ready" | E |
| 2 | Look at the hero, scroll to the Storyteller and the foot, open **Your book** | The one button says where you are. The Storyteller's door says what it needs (sign-in, the microphone). Your book lists each chapter with Start, Continue or Read again | A |
| 3 | **Sign in with Google** from "Sign in" at the top | Google's own page, then back on Foldtales, signed in ("… 's book"). Later, on your phone: the "Your book is ready." email arrives, once. Try the phone code once too, at `www.foldtales.xyz/link/` | D |
| 4 | **Open the book** and let it start | The book finds your table, the room dims, the pages stand up. A small card by the ribbon: "Pinch the ribbon to pause". **Listen for the music:** a quiet piano bed under the narrator. Is it warm, and is every word still clear? Or is the book better without it? | A, E |
| 5 | Hand the lantern back with your **left hand only**, then turn the page with your **right hand only** | Each works with one hand, first time, without leaning in | E |
| 6 | Pinch the **ribbon** (either hand) | A paper card pops up from the spread and the story stops. Its pop, its sound, its size: readable without leaning in? It should feel like part of the book | A |
| 7 | **Contents → Settings:** Sound off, then on. Room: lighter, then dark. Then **Back, Back, Carry on** | Sound goes silent, the music too, and comes back. The dim lightens and darkens. Carry on resumes on the same word | A |
| 8 | Pick something up and, holding it, pinch the ribbon with the other hand. Then shut the cover while a character is speaking, and open it again | What you held goes home, not dropped or floating. The line stops with the cover and carries on when it opens. The card folds away with the cover | A, E |
| 9 | Take the headset off for 20 seconds, then put it back on | Same moment, same place, nothing replayed | E |
| 10 | **Reload** the page in Quest Browser, mid-chapter | The page offers "Continue chapter 1". One tap, and the book comes back on the same spread | E |
| 11 | **Put the book away** (ribbon), then tap **Continue** on the page | The page shows where you stopped; the book arrives back at your place | A |
| 12 | Play to the end: the drawer at the gap, something handed to Pip, the beam. **While the beam sweeps, record 30 s** (Meta button → camera → Record video) | The beam crossing your real walls. The end card: "The end of chapter 1", what lasts, Read again or Continue. The recording is for the agents: they check that the app's layer and the voices are both in it before anything is filmed | A, E |
| 13 | On the page, the Storyteller: **"Let them hear you"**, and allow the microphone | Straight into the book, the drawer slides out, and the cast greets you and offers two ideas | D |
| 14 | **Hold to talk** and say what tonight's story is about | The narrator names the story within about 5 s. Each voice fits: the narrator warm, Pip young and bright, Wick gruff-kind, Moth light. Say which is wrong, if any | D |
| 15 | Ask for a painting: "Can you find me a little blue teapot?" | It arrives on the page within about 30 s, with "Powered by Runway" on its caption. It's in your satchel next time | D |
| 16 | Ribbon → **End the story here** | The beam sweeps your room. The end card shows the story's title and two or three lines | A, D |
| 17 | **Put the book away**; open **Your book** on the page | The story is listed under "Your stories, with the AI Storyteller" | D |
| 18 | Fully close Quest Browser (not just the tab). Turn on **airplane mode**, then open `www.foldtales.xyz` again and open the book | The page and chapter 1 open with no network. **Look at your hands:** their models come from the internet, so say if they look different or missing. The Storyteller's door should say it can't open offline | E |
| 19 | Airplane mode off. Move to a **sofa or chair with a lap tray, no table**, and open the book | It lands within reach, in front of you; every control works within about 2 feet, seated | E |
| 20 | Still seated, look at the room effects: on the page, **Chapters**. If chapter 2 or 3 is there, play its first spread | The sea on your floor, or stars on your ceiling, in view and not behind you; nothing floating in mid-air | E |

**If there's time:**
- Turn the room lights low and repeat step 5: hand tracking holds, and captions stay readable.
- Start a Storyteller story with "or play by hand" and say nothing. It carries on alone and ends by itself.
- **A short frame-rate pass** (about 12 minutes; the agent sets it up first). Real frame rates come only from the Quest, and these fixtures hold one scene or effect still for a minute, so each reading means one thing.
  - **Setup, by the agent:** the agent serves a review build from lane E's workspace (`pnpm --filter @tabletop/client build:review`, then `vite preview` of `dist-review` on port 5130, with the local backend on 5131) and runs `adb reverse tcp:5130 tcp:5130` with the Quest on USB.
  - **For each link:** open it in Quest Browser, tap Open the book, and sit still, looking at the book, for about 60 s. Then open the next one.

  | Link | Holds |
  |---|---|
  | `http://localhost:5130/?perf=ch1-shore` | The shore spread, no effect: the baseline |
  | `http://localhost:5130/?perf=rain` | Rain all round |
  | `http://localhost:5130/?perf=snow` | Snow, settling |
  | `http://localhost:5130/?perf=sea` | The sea on the floor, with the boat and the tide in |
  | `http://localhost:5130/?perf=night-sky` | The night sky on the ceiling |
  | `http://localhost:5130/?perf=window` | The window onto the story |
  | `http://localhost:5130/?perf=rain+sea` | Rain with the sea: two big effects |
  | `http://localhost:5130/?perf=night-sky+sea` | The night sky with the sea |
  | `http://localhost:5130/?perf=sea+window` | The sea with the window |

  - **Afterwards, the agent prints the table:** `node scripts/telemetry-report.ts <start time> --cases`, run against the local backend. Each fixture gets its median fps, its 1% low, its frames under 60 fps and its slowest frame. It also confirms each fixture's effects were really on. Anything under 72 fps (the look bar) gets fixed before submission.
  - **The other twelve fixtures** (`client/src/review/perf-cases.ts`) run the same way if there's more time: `ch1-lamp`, `ch1-gap`, `ch1-beam`, `shadows`, `fireflies`, `gulls`, `bottle`, `hunt`, `rain+window`, `snow+window`, `night-sky+fireflies`, `rain+shadows`.

## Afterwards

- Say what felt off, in plain words. It goes in `docs/playtest-notes.md`, under a dated section per lane.
- **The agents pull:**
  - this session's telemetry: frame rate per scene and effect, hitches and errors, tagged with the build;
  - the step 12 recording, over USB, to check its picture and sound before filming;
  - your words on the music (step 4).
- **Not in this session:**
  - the frame-rate fixtures, except the short pass under "If there's time" (it needs a review build over USB);
  - filming the video itself (`docs/submission.md`);
  - the private YouTube Content ID upload of the music bed (`art/sound/music/LICENCE.md`).
