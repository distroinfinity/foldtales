# Tabletop Theater — PRD

**One-liner (tagline, Nov 14):** A living storybook on your table. Reach in and help the characters through each chapter, or make up a new story with the AI Storyteller.

Track: Entertainment · Division: New Experience · Status: Frozen v1 · 2026-11-02

---

## 0. Positioning and the shape of the product (owner, Nov 14)

- **What it is:** an **interactive storybook** for winding down in the evening. It isn't a game: there's no score and no losing. Chapters take about six minutes, and you need only your hands.
- **Who it's for:** teens and adults who unwind with stories.
- **Tabletop Theater** is the product. Its first book is ***Tales from the Table's Edge***, with Pip, Wick and Moth in the Lost and Found. The old title, "The Lighthouse at the Edge of the Table", read like a chapter.
- **There are two ways in:**
  - **Chapters:** written, theatrical stories, read in order, with no account needed. Only chapter 1 is in v1, plus "More chapters on the way."
  - **The AI Storyteller:** talk to Pip, Wick and Moth, hand them anything, and the AI makes up the story as you go, voiced live. It needs sign-in. Since ticket 3's first headset session, the AI no longer edits the written chapters; it has its own mode.
- **Your book:** an account keeps your place and finished chapters on any headset, and opens the AI Storyteller. Sign-in is offered on the first visit, but never before the story: one quiet line under the button.
- **The page:** one short page for every device. A hero gives the one action, then a scroll opens the real pop-up book, in the manner of Apple's product pages. Plan: `docs/plans/2026-11-14-product-front-door.md`.

## 1. Why this exists

- **Behavior we build on:** people unwind with stories every evening: shows, audiobooks, cozy games. On a screen the story is fixed and you only watch.
- **What VR adds:** the story happens *on your table*, at a scale you can lean over and reach into. You can shelter a character in your hand, or put a real-feeling object into its paws. This physical participation is the reason to wear a headset; a tablet can't do it.
- **What AI adds:** an AI director makes the show respond to you. When your contribution is unexpected, the scene changes and the ending changes.
- **Gap:** AI in VR today means talking avatars and object labels. Nobody uses AI as the live director of a physical show.

## 2. Users & context

- **Who:** teens and adults who use Quest seated in the evening as a TV replacement, to unwind. PG, cozy tone.
- **Where:** seated at a desk or table, or on a tray table with no table at all. Everything stays within near-body reach.
- **Session:** one 5–7 minute episode, often two or three back-to-back.
- **Devices:**
  - **With passthrough:** the stage stands on your real surface.
  - **Without passthrough:** it stands on a table in a cozy virtual room.

## 3. Product principles

1. **No chat window.** The AI acts only through the stage: characters, props, light, music, narration. Text appears only as optional captions and on storybook pages.
2. **Lean-back by default, reach in any time.** An episode is satisfying with zero input, and every input visibly changes something.
3. **Your choices matter, within the story.** Accepted interventions change *this episode's* resolution. Only what the page records carries forward, and you can undo it.
4. **Never wait, never pretend.** AI latency is hidden in the show (narration, a character turning an object over, page turns), but failures are never hidden by repeating filler. An object you give is never silently thrown away.
5. **The surface matters.** Stage size and staging adapt to your real surface: characters stop at its edges, and a cliff can be its edge.
6. **What you give stays given.** An object you use keeps what it did, and it can come back.

## 4. The viewer's role

You are **the Reader**: a giant, friendly presence the characters know is watching over their world. Characters can look up and ask the Reader for help. Only the narrator talks about the book itself.

## 5. Core loop

Open the book → the episode plays → reach in, talk, or hand something over whenever you like → your intervention changes how this episode resolves → the episode ends with a storybook page recording what lasts → close the book.
Next time: "Previously on…", and what you gave is back, now with problems of its own.

## 6. Features

| Tier | Feature | What it is |
|---|---|---|
| Must | **The Book** | A pop-up book and the only UI. Open it to start or resume, close it to pause, one book per series. Pages pop up into paper sets. Taking the headset off, or losing hand tracking, pauses it, and an intervention you started is kept. |
| Must | **Flagship series** | Launches with one handcrafted series and a recurring cast worth caring about: *The Lighthouse at the Edge of the Table*, set in the Lost and Found where everything lost in a house drifts home. With Pip (a young fox afraid of the dark who quietly wants to be the next keeper), Wick (a grumpy keeper secretly losing his sight) and Moth (who flies at anything bright and brings odd finds). The arc: Pip learns the dark, and Wick learns to hand over the lamp. |
| Must | **Tonight's lost thing** | Pick a lost object, and the AI writes an episode about whose it is, in the same world with the same cast. Offered once the first episode has finished. |
| Must | **Episodes** | 5–7 minute episodes, each solving one problem, with a narrator, character voices, music and lighting. 1–2 moments where a character asks the Reader for help. Ignoring them is fine. |
| Must | **Reach in** | Pick up, move, shelter, and place characters and props. Hand things to characters. Characters react physically and verbally. |
| Must | **Talk** | Pinch a character (or look and pinch) to select it, then speak. A paper ear lights up while it listens. It answers in character, and what you say can change the scene. |
| Must | **Lost and Found** | Objects come from three places: on the set, in the book's drawer, and in your satchel. Handing one to a character changes the story. The drawer opens when a character asks, or when you pull it. Use an object and you can keep it. |
| Must | **Consequences & canon** | Interventions change how an episode resolves. The episode's page records what lasts (new cast members, relationships, key events). Undo any lasting change from the page. |
| Must | **Keepsakes come back** | Objects you used go in your satchel and carry across stories. They return with history and new problems: the kite you gave last week is tangled on the lighthouse, and its owner has come looking. |
| Must | **Storybook page** | Each episode adds an illustrated page, including the things you gave. The series becomes a book you can reread. |
| Must | **Story Circle** | 2–4 friends share a story, either around one table in the same room or remote with the same stage on each person's own surface. The host's series plays. Everyone can reach in, talk, and hand things over, and each person brings their own satchel. The director gives each person at least one moment where their contribution changes the scene. Remote friends appear as paper avatars at the book's edge. One character conversation at a time, and everyone can see who is talking. Friends-only invites. |
| Later | Real-object cameos | Use the passthrough camera so stories can include real things on your table. Quest 3/3S only. |
| Later | Community series | Share and continue other people's series. |

## 7. Key user journeys

**First five minutes**
1. The book appears on your surface, already opening. Pip's episode starts immediately with no choices to make.
2. Pip's lantern blows out in a gust. Pip looks up at the Reader. You hand the lantern back, and Pip's relief is your first payoff (minute ~1).
3. The path ends at a gap. Pip says "If only we could cross…" and the drawer slides open. You hand over something, perhaps a kite, a spool of thread, or a ladder. What you gave decides how Pip crosses, and the story continues *your* way (minute ~3).
4. A doing-nothing path also works: Wick arrives with a rope, and the episode resolves differently.
5. The lighthouse lamp is relit, and its beam sweeps across your real room. The episode ends with a page showing what you gave (minute ~6). Tonight's lost thing is offered for later.

**Returning evening:** open the book → "Previously on…" (about 20 s) → the kite you gave is tangled on the lighthouse, and its owner has come looking → you help → you close the book mid-scene for a call → reopening resumes at the same moment.

**Arriving and moving around** (owner, Nov 13; reshaped Nov 14): the page knows you, and its one button says where you are:
- New: "Open the book".
- Back mid-chapter: "Continue chapter 1", or start from the beginning.
- After a finished chapter: "Read chapter 1 again" (later, "Continue to chapter 2"). The AI Storyteller sits beside it at equal weight.

A curious visitor scrolls and sees the book open, Pip's lantern come back, and the beam sweep, then the AI Storyteller. Sign-in is a bookplate ("Put your name in the book"): a short code you finish on your phone, or Google. Inside, the book is the menu: the end-of-chapter page offers "Read it again". On a desktop or phone, the same page says "Send to your Quest" (Meta's own link), and the 3D book is never downloaded.

**Story Circle:** the host invites a friend → the friend's surface shows the same book → both of you hand things over and talk while the director makes sure each of you changes the scene → the page appears in both books.

## 8. Interaction design

| Intent | Hands | Eyes + hands (VR Glasses) | Voice |
|---|---|---|---|
| Select / grab | Pinch or grab | Look + pinch | — |
| Hand over | Pick up an object, bring it to a character, and let go | Look + pinch the object, then the character | — |
| Take from drawer or satchel | Pull the drawer or tab, then pick up | Look + pinch | — |
| Talk | Pinch a character → it listens | Look + pinch → it listens | Speak |
| Pause / resume / recenter | Close or open the book; grab the spine to move it | Look + pinch | — |

- **Hands-only, end to end.** Talking is optional: every episode can be completed silently.
- **Selection is always explicit.** Nothing triggers from gaze alone, and nothing depends on hover.
- **Stage size adapts** from tray to desk. The key action and captions stay within the central ~70° at your actual viewing distance.
- **Accessibility:** captions for all speech, and one-handed play.

## 9. AI behavior

| Role | Decides |
|---|---|
| **Director** (AI) | The episode's beats from the premise plus canon. Runs the show only through stage actions (place, move, speak, emote, light, music, ask the Reader, resolve). Plans the next beat while the current one plays. |
| **Characters** (AI) | In-character replies when selected and spoken to, consistent with each character's description. |
| **Illustrator** (AI, optional) | Live-painted pages, Moth's odd finds and visitors, if time allows. Pages are otherwise composed from the episode's own art. |
| **The app** (not AI) | Physics, positions, surface bounds, episode length, moderation, and what becomes canon. |

**Failure handling:**
- **AI is slow:** one narrator bridge or ambient beat. If it's still slow, play the scene's authored beat.
- **AI fails:** the authored beat plays, and the object you gave stays on stage.
- **Any object, any scene:** every object has tags and every scene problem accepts tags, so an authored reaction and outcome always exist.

**Without AI** (take-it-away test): the flagship series plays as an authored story with branches, and reach-in and handing over objects still work. The adaptive story is the AI layer on top of a complete theater.

## 10. Product components

```
 Input (hands · eyes · voice)
        │
        ▼
 Intent router ──► Object system (set, drawer, satchel)
        │                                   │
        ▼                                   ▼
   Director  ◄──► Series memory      Stage (book, sets, puppets, physics, surface fitting)
        │        (canon, cast, satchel,     ▲
        │         pages)                    │ stage actions
        ├──► Characters ──► Voice & music ──┤
        └──────────────────────────────────►┘
 Story Circle session: syncs stage state and player inputs across players
```

- **The Stage works without the AI.** Authored stories play on it unchanged.
- **The Director never addresses the user directly.** It only issues stage actions.
- **Series memory is the single source of truth for canon,** and only the app writes to it.

## 11. Content, privacy & safety

- Inputs (premises, speech) are moderated, and so is AI output (lines, art).
- Off-tone requests are redirected in-story with a short, clear narrator line, never an error dialog. The story continues.
- Listening is always explicit and visible. A mute is always available.
- Voice is processed in the cloud, and this is disclosed at first launch. Recordings and canon can be deleted.
- No passthrough camera use. Mixed reality uses surface detection only.
- Story Circle is invite-only between friends. There's no matchmaking with strangers.

## 12. Competition fit

- **Hard requirements:**
  - Hands-only and completable silently.
  - Near-body and tray-friendly.
  - A first payoff in minute 1 and a complete episode within 10 minutes.
  - Instant pause and resume through the book.
  - Passes the take-it-away test (§9).
- **Judging:**
  - *Innovation:* any object you hand over reshapes an AI-directed show on your real table and comes back later, and the lamp's beam lights your real room.
  - *Experience:* the story starts instantly, payoff comes in minute 1, the book is the whole UI.
  - *Technical:* surface fitting in unfamiliar rooms, handing small objects to characters by hand, explicit gaze selection, synced multiplayer, 60 fps.
  - *Polish:* a single painted storybook art direction, voices, music.
- **Special awards it genuinely fits:**
  - Agentic Interaction: the director acts through the stage.
  - Reason to Come Back: your satchel carries across stories, and keepsakes return with new problems.
  - First Five Minutes.
  - Social & Multiplayer: Story Circle.

## 13. Success criteria

- A first-time user gets a payoff within the first minute and finishes episode 1 within 10 minutes, with no instructions.
- A zero-input viewer still gets a satisfying, resolved episode.
- A character reacts at the moment you let go of an object, and the object visibly matters within 6 s.
- The next episode *changes* because of the last one's recorded consequences, not just mentions them.
- In Story Circle, every participant changes the scene at least once per episode.
- Steady 60 fps on Quest 3.

## 14. Non-goals

- Chat UI, text input, or a story editor.
- Mature, horror, or under-10 content.
- Drawing and free-form creation.
- Any dependency on the passthrough camera.
- Matchmaking with strangers.

## 15. Demo video beats (under 3 min)

1. **Hook (first 10 s):** Pip's lantern goes out, you hand it back, and the relit lamp's beam sweeps across a real kitchen.
2. The book unfolding on a real kitchen table, and the cast.
3. Hand Pip something odd from the drawer, and the story bends around it.
4. One continuous intervention → consequence: talk to Wick, and the ending changes.
5. The episode's page records the kite.
6. Labeled "next evening": the kite is tangled on the lighthouse, and its owner has come looking.
7. Story Circle: two friends, each with their own satchel, each changing the scene.

## 16. Open questions

- What does the remote Story Circle avatar look like at the book's edge?
- ~~Business model~~ Decided Nov 14: **free during the competition**; decided after it.
