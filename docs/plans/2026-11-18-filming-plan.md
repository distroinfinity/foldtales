# The filming plan: one sitting for the demo

Lane S, written Nov 17 for filming on Nov 18. It films the demo beat sheet in `docs/plans/2026-11-17-film-concept.md` ("Revision, Nov 17: the demo cut"). The paste-ready form is `docs/devpost-form.md`.

**The order of the day is the owner's:**
1. Finish the product.
2. The owner's full test run of the live site, as a real user. The sprint master drives the Quest.
3. The capture test.
4. This sitting.

Nothing here touches the Quest until the sprint master says it's free.

**Gates before the sitting starts:**

| Gate | Pass | If it fails |
|---|---|---|
| The capture test (section 1) | One method is proven, with picture and sound both verified by the agent from a pulled clip | No filming. Escalate to the sprint master with what the clip showed |
| The owner's test run | The live build plays chapters 1–3 end to end, and the page's wording matches the labels | Fix the labels to match what's true, never the other way round |
| The Storyteller's launch switch | Live on www.foldtales.xyz, signed in | Beat 14 drops; the cut list takes up the time |
| The music bed's Content ID test | "No issues found" | The bed is deleted before filming, so it's never in any take |
| The room hunt (session step 17) | Passed | Not in the demo either way; it's only an option for beat 12 |

## 1. The capture test (still to prove)

### What we know

- **An in-headset recording from Oct 31** (`/sdcard/Oculus/VideoShots/com.oculus.browser-20261031-230031-0.mp4`, a spike, not this app):
  - HEVC 1920 × 1080 at 59.94 fps, with AAC stereo at 48 kHz, 78 s.
  - **Its frames do include the WebXR layer** (the spike's hand outlines over passthrough).
  - **Its sound was nearly silent:** a mean of −59 dB and a peak of −24 dB. The spike may simply have had no sound, so whether the app's audio is recorded is **still unproven**.
- Two earlier recordings in this project had passthrough only, or no voices (`docs/plans/2026-11-17-film-concept.md`).
- **Meta's capture guide** (developers.meta.com/vr/resources/video-capture-mr-vr):
  - In headset: Camera app, Landscape 1920 × 1080, 36 fps (variable), 20 Mbps, image stabilization Low, slow head moves.
  - Developer Hub: up to 2160p at 60 fps (variable) and 40 Mbps, settings that "you may need to reduce" if the app drops frames.

### The methods, in the order we try them

| # | Method | How it starts and stops | Why this order |
|---|---|---|---|
| A | **Recording driven from the Mac:** `metavr capture video start` / `metavr capture video stop --pull <file>`. It defaults to 1920 × 1080 and takes `--width` and `--height` | The agent starts and stops it from the Mac. The owner just plays | No menus in the headset, so no Camera panel in the shot and no hand moves to start or stop it. The file lands on the Mac directly |
| B | **The headset's Camera app:** Meta button → Camera → Record video, with Meta's settings above | The owner starts and stops it | Meta's documented path. A fallback if A drops the WebXR layer or the sound |
| C | **The Developer Hub's Record Video,** 2160p @ 60, 40 Mbps, stepped down to 1080p if the app drops frames | The agent, from the Developer Hub on the Mac | Only if A and B both pass and we want more pixels: extra room to crop the 3:2 gallery stills and to stabilize |
| D | **Casting to the Mac and screen-recording it** | Mac | Last resort. Meta says the quality is lower |

Not used: scrcpy (it isn't installed, and it shows the raw per-eye display, not a viewer's frame).

### The test, in the owner's numbered steps

The agent prepares the headset first, under the sprint master's rules:
1. Close every Quest Browser tab (through DevTools at `localabstract:chrome_devtools_remote`).
2. Load exactly one URL, `https://www.foldtales.xyz/`.
3. Confirm from the Quest's own screen (`metavr` device screenshot, plus DevTools' tab list) that it's the page in front.
4. Only then ask the owner to put the headset on.

**For the owner (about 3 minutes):**
1. Sit at the filming table, put the headset on, and confirm the boundary if asked.
2. When the agent says "recording", tap **Open the book**, and look at the book until the narrator has spoken twice.
3. Then say one sentence out loud: "This is a microphone test."
4. Wait for "stopped". If method A fails, step 5 is method B.
5. Meta button → Camera → Record video. Repeat steps 2 and 3, then stop the recording from the same menu.

### What the agent checks before telling anyone it works

Each check runs on the pulled file. These tools are all on the Mac: `ffprobe`, `ffmpeg`, `whisper-cli`.

1. **The streams:** `ffprobe` shows one video stream (codec, 1920 × 1080 or larger, frame rate) and one audio stream. Write down the frame rate: Meta says 36 fps variable, and the Oct 31 clip was 59.94.
2. **The picture:** a contact sheet of frames at 2, 10, 20 and 28 s. Pass if the book (the painted pages, Pip, the dim) is in the frames over real passthrough. Fail if it's passthrough only.
3. **The sound:**
   - `volumedetect` gives a mean above about −40 dB.
   - A transcription with `whisper-cli` contains the narrator's opening words ("Every night, the lighthouse…").
   - The microphone sentence is either there or not. Write down which: beat 14 needs the owner's voice.
4. **Sync:** pick a visible event with a sound (the page standing up with its paper sound) and check that it lines up within about two frames.
5. **The verdict, in one line per method:** picture, app sound, mic, resolution and fps. Report it with `SUPERSET_WORKER_DONE / task: S-capture` and the clip's path.

**If the app's sound records but the microphone doesn't:** in beat 14, the owner's sentence is heard as part of the same real moment. A phone on the table records the room at the same time, and the two are synced by the page's paper sound. The cast's reply stays the headset's own audio. Nothing is re-recorded later.

## 2. The room and the headset

**The room** (Meta's set guidance and our rules):
- **The table:** one table, cleared, with a plain cloth or bare wood. Already in Space Setup, so the book finds it at once. Seated, on a chair without arms.
- **What's in view:**
  - Plain walls, with one real window, so the beam crosses something real.
  - Clear floor ahead and to the right, for the sea.
  - A ceiling with no fan and no bright fitting in the middle.
  - Nothing branded: no screens (the Mac faces away, or is out of the room), no readable book spines, no boxes, no logos, no cans or bottles.
  - Never the teapot keepsake.
  - No other people, and no pets.
- **The light:** one or two warm lamps, out of shot, behind or beside the owner. No overhead light. Evening outside.
  - The book's room dim is set in its Settings: **Dark** (the default) or **Lighter** (it stops at 0.55).
  - The first take of beat 1 is filmed once in each, back to back. The agent checks both clips' frames, and we pick the one where both the walls and the beam read.
- **The headset:**
  - Fully charged, and on the cable if method A is used.
  - Controllers in a drawer, the whole time.
  - Camera settings (method B): Landscape 1920 × 1080, 36 fps, 20 Mbps, image stabilization Low, and the dominant eye.
  - Sound: Quest volume at about 70%.
  - Wi-Fi: home Wi-Fi; the live site needs it.
- **Clean start:** clear Quest Browser's data for `www.foldtales.xyz` before the first take. Then it's a true first visit: the page offers Open the book, and the ghost hand appears.

## 3. Where each shot comes from

- **The live site, www.foldtales.xyz, by default.** It's what judges will open.
- **The review build over USB,** only for retakes that would otherwise mean replaying minutes. It's the same build plus review hooks:
  1. Build it: `pnpm --filter @tabletop/client build:review`.
  2. Start the local backend: `pnpm --filter @tabletop/backend dev`.
  3. Serve it with `vite preview --outDir dist-review`, run from `client/`. Its port is `CLIENT_PORT` from this workspace's `.env.ports`, and `/api` goes to `BACKEND_PORT`.
  4. Forward the port: `adb reverse tcp:$CLIENT_PORT tcp:$CLIENT_PORT`, with the ports read from `.env.ports`, never typed in.
- **Before every retake link,** tap **Start from the beginning** on the page. `jump` is ignored when the page resumes a saved place (`if (jump && !resumeFrom)`, `client/src/index.ts`).
- **Never film the review build's `?card=busiest` proof card:** it names the teapot keepsake.

## 4. The sitting, in order (about 75 minutes)

Each "run" is one continuous recording. Long continuous runs are deliberate:
- The demo's beats are the real journey in order, and one take of chapter 1 holds nine of them.
- Every hand moment is allowed to finish inside one recording.
- It avoids retakes that need a fresh site.

The editor cuts the beats out of the runs. **Every look starts and ends with a 2 s hold.** Head moves are slow. The hands come into frame from below.

| Run | Beats | What the owner does | Source | Takes |
|---|---|---|---|---|
| R0 | — | 30 s of the room, still, with the app's sound off (Quest volume 0), looking at the table, walls and window: the room tone, and a clean plate | Any | 1 |
| R1 | 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 (end) | **First visit, straight through chapter 1.** In Quest Browser, the page; tap Open the book; let the book land; watch the ghost hand twice without touching the ribbon. Hand the lantern back. After Pip's relight, touch the ribbon (beat 6): look at the card, press **Carry on**. Turn the page by its corner, then one slow lean. At the gap, pull the drawer and hand over the kite. When the lamp relights, follow the beam round the room slowly, across two walls and the window, and settle back on the gallery. Hold through "Same time tomorrow". Then the end card | Live, site data cleared first | 1, plus a second if anything breaks. The ghost hand needs site data cleared again for a second take |
| R2 | 1 | **The cold open:** the lit lamp, the beam leaving it, the head following it onto the wall. Filmed in Dark, then in Lighter | Review build, `?chapter=1&jump=lighthouse`; or R1's beam | 2 (Dark, Lighter) |
| R3 | 11 (the page) | After R1's end card, press **Put the book away**. On the page, hold on what it now offers for chapter 2, then tap it | Live, continuing R1 | 1 |
| R4 | 12 | Chapter 2 from that tap. When the sea comes in, tip the head down slowly to the floor: the ring of sea, a real chair standing in it; hold 4 s; back to the book | Live; retake `?chapter=2&jump=sea-in` | 1, plus a retake |
| R5 | 13 | Chapter 3's sky: the head well back and still; the moon and the fox together; through "Looks like that one's yours." | Review build, `?chapter=3&jump=the-sky` (the live run is about 6 min to reach it) | 2 |
| R6 | 6 (spare), 15 | A spare ribbon pause, and the close: at a quiet moment, shut the cover by its outer edge; hold 4 s as the lights come partway up | Live or review build | 2 |
| R7 | 14 | **Last, if the Storyteller is live.** Signed in, on the page: **Let them hear you**. In the book, press and hold the paper talk button with a fingertip, and say one prepared sentence (below). Let the cast's reply finish. If asked for a painting, wait about 30 s, framed so the "Powered by Runway" line is out of shot | Live, signed in | 3 sentences, one take each; keep the clearest |
| R8 | gallery 8 | On the Mac, signed out: www.foldtales.xyz's hero, as a screenshot | Mac | 1 |

**The three Storyteller sentences:** plain, the owner's own words, nothing branded, no real names, never the teapot.
- "Tonight's story is about a paper crane who's never seen the sea."
- "Tonight's story is about a button that wants to be the moon."
- "Tonight's story is about a lost mitten looking for its other half."

**Also in this sitting:** the stills for gallery images 1–7 come from these runs. They're taken by the editor later, so nothing extra is filmed for them.

**Things to check at the owner's test run, not guess now:**
- **The page's wording after chapter 1 ends** (beat 11's second half). The label says *Come back tomorrow. The book keeps your place.* If the page offers "Continue chapter 1" partway through and "Open the book" with chapter 2's line after an ending (`client/src/landing/library.ts`, `client/src/show/progress.ts`), R3 may be better filmed by putting the book away partway through chapter 2, so the page says "Continue chapter 2". Use whichever is true.
- **Whether the ghost hand shows on the live build at first open.** It does unless the ribbon was used on this headset (`tt.ribbon-used`); the test run itself will set that flag, so the site data is cleared after the test run.

## 5. Getting the files off

Only once the sprint master says the Quest is free, and only over USB:
- **Method A:** `metavr capture video stop --pull <raw folder>/<run>-<take>.mp4` puts the file straight on the Mac.
- **Method B:**
  1. List `/sdcard/Oculus/VideoShots/`.
  2. Pull each new file with `adb pull`.
  3. Rename it on the Mac to `<run>-<take>.mp4`. Never delete anything on the headset until the Mac copies are verified.
- **Where they go:** `~/Movies/foldtales-film/raw/` on the owner's Mac. Never into the repo, and never into the agent's scratchpad, which can be cleared.
- **A log sheet,** `~/Movies/foldtales-film/raw/LOG.md`:
  - one row per file: run, take, beats, duration and verdict (keep, spare, bad);
  - a one-line note for each.
- **Each file is checked as it lands:** `ffprobe` for both streams and the duration, and a 4-frame contact sheet. A run with no sound, or no book in the frame, is reshot in the same sitting, while everything is still set up.

## 6. If something goes wrong on the day

| Problem | Do |
|---|---|
| The capture test fails for every method | No filming. Report to the sprint master with the evidence. Rules §4 also allows "XR Simulator, or another equivalent emulator", but our brief is real Quest footage, so that's the owner's decision |
| The room reads too dark on video | Switch the book to Lighter and add a lamp. The editor lifts exposure a little, never so much that it looks like daylight |
| Hand tracking drops in low light | Add a lamp low and to the side of the table; retake |
| The Storyteller is slow or fails mid-take | Let the app end the story (it always does). Retake once. If it fails twice, beat 14 drops |
| A line runs long in a take | Don't retake for time; the edit's cut list handles length (target 2:45–2:55) |
| Anything branded, a person, or the teapot is in frame | Reshoot, never blur it in the edit |

## 7. What the sitting hands to stage 3

- The raw runs and their log.
- Which room light was chosen.
- The capture method's numbers (resolution, fps, the sound's level).
- Whether the microphone was in the headset recording or on the phone.
- The Storyteller take chosen, or a note that it's dropped.
