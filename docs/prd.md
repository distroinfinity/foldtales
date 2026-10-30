# Tabletop Theater — PRD

**One-liner:** An AI-directed pop-up storybook that unfolds on your table: cozy, serialized stories you can watch, reach into, talk to, and draw into, alone or with friends.

Track: Entertainment · Division: New Experience · Status: Draft · 2026-10-30

---

## 1. Why this exists

- **Behavior we build on:** people unwind with stories every evening: shows, audiobooks, cozy games. On a screen the story is fixed and you only watch.
- **What VR adds:** the story happens *on your table*, at a scale you can lean over and reach into. You can shelter a character in your hand, pass it a prop, and watch your own drawing walk beside it. This physical participation is the reason to wear a headset; a tablet can't do it.
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
4. **Never wait, never pretend.** AI latency is hidden in the show (narration, ink coming alive, page turns), but failures are never hidden by repeating filler. A creation you made is never silently thrown away.
5. **The surface matters.** Stage size and staging adapt to your real surface: characters stop at its edges, and a cliff can be its edge.
6. **Your strokes are the art.** Doodles stay in your own lines. Imperfection is the charm.

## 4. The viewer's role

You are **the Reader**: a giant, friendly presence the characters know is watching over their world. Characters can look up and ask the Reader for help. Only the narrator talks about the book itself.

## 5. Core loop

Open the book → the episode plays → reach in, talk, or doodle whenever you like → your intervention changes how this episode resolves → the episode ends with a storybook page recording what lasts → close the book.
Next time: "Previously on…", and your creations are back, now with problems of their own.

## 6. Features

| Tier | Feature | What it is |
|---|---|---|
| Must | **The Book** | A pop-up book and the only UI. Open it to start or resume, close it to pause, one book per series. Pages pop up into paper sets. Taking the headset off, or losing hand tracking, pauses it, and an intervention you started is kept. |
| Must | **Flagship series** | Launches with one handcrafted series and a recurring cast worth caring about: *The Lighthouse at the Edge of the Table*, with Pip (a fox afraid of the dark), Wick (a grumpy lighthouse keeper) and Moth (a curious moth who loves Pip's lantern). |
| Must | **Your own series** | Premise cards, or a spoken premise, start new series, offered once the first episode has finished. |
| Must | **Episodes** | 5–7 minute episodes, each solving one problem, with a narrator, character voices, music and lighting. 1–2 moments where a character asks the Reader for help. Ignoring them is fine. |
| Must | **Reach in** | Pick up, move, shelter, and place characters and props. Hand things to characters. Characters react physically and verbally. |
| Must | **Talk** | Pinch a character (or look and pinch) to select it, then speak. A paper ear lights up while it listens. It answers in character, and what you say can change the scene. |
| Must | **Doodle Alive** | Draw in the air with a pinched fingertip, or on the table surface for steadier lines. The drawing comes alive in your own strokes and becomes whatever the story needs: a character, an object, scenery. If the AI misreads it, tap the drawing to correct what it is. |
| Must | **Consequences & canon** | Interventions change how an episode resolves. The episode's page records what lasts (new cast members, relationships, key events). Undo any lasting change from the page. |
| Must | **Creations come back** | Doodled characters return in later episodes with needs of their own: the dragon you drew last week now has a problem only you can help with. |
| Must | **Storybook page** | Each episode adds an illustrated page, including your doodles. The series becomes a book you can reread. |
| Must | **Story Circle** | 2–4 friends share a story, either around one table in the same room or remote with the same stage on each person's own surface. The host's series plays. Everyone can reach in, talk, and doodle, with each person's ink in their own color. The director gives each person at least one moment where their contribution changes the scene. Remote friends appear as paper avatars at the book's edge. One character conversation at a time, and everyone can see who is talking. Friends-only invites. |
| Should | **Highlight clip** | The episode's best intervention-to-consequence moment, captured to share. |
| Later | Toybox | Bring doodles across series. |
| Later | Real-object cameos | Use the passthrough camera so stories can include real things on your table. Quest 3/3S only. |
| Later | Community series | Share and continue other people's series. |

## 7. Key user journeys

**First five minutes**
1. The book appears on your surface, already opening. Pip's episode starts immediately with no choices to make.
2. Pip's lantern blows out in a gust. Pip looks up at the Reader. You hand the lantern back, and Pip's relief is your first payoff (minute ~1).
3. The path ends at a gap. Pip says "If only we could cross…" You draw something, perhaps a bridge, a ladder, or a lopsided dragon. Your strokes lift off and carry Pip across, and the story continues *your* way (minute ~3).
4. A doing-nothing path also works: Wick arrives with a rope, and the episode resolves differently.
5. The episode ends with a page showing your creation (minute ~6). The premise cards appear for later.

**Returning evening:** open the book → "Previously on…" (about 20 s) → the dragon you drew is stuck in the lighthouse chimney → you help → you close the book mid-scene for a call → reopening resumes at the same moment.

**Story Circle:** the host invites a friend → the friend's surface shows the same book → both of you doodle and talk while the director makes sure each of you changes the scene → the page appears in both books.

## 8. Interaction design

| Intent | Hands | Eyes + hands (VR Glasses) | Voice |
|---|---|---|---|
| Select / grab | Pinch or grab | Look + pinch | — |
| Draw | Pinch-hold and trace in the air or on the table; open the hand to finish | Same | — |
| Talk | Pinch a character → it listens | Look + pinch → it listens | Speak |
| Correct a doodle | Tap it, pick what it is | Look + pinch | Or say it |
| Pause / resume / recenter | Close or open the book; grab the spine to move it | Look + pinch | — |

- **Hands-only, end to end.** Talking is optional: every episode can be completed silently.
- **Selection is always explicit.** Nothing triggers from gaze alone, and nothing depends on hover.
- **Stage size adapts** from tray to desk. The key action and captions stay within the central ~70° at your actual viewing distance.
- **Accessibility:** captions for all speech, one-handed play, and table-surface drawing for those who find air drawing hard.

## 9. AI behavior

| Role | Decides |
|---|---|
| **Director** (AI) | The episode's beats from the premise plus canon. Runs the show only through stage actions (place, move, speak, emote, light, music, ask the Reader, resolve). Plans the next beat while the current one plays. |
| **Characters** (AI) | In-character replies when selected and spoken to, consistent with each character's description. |
| **Doodle reader** (AI) | What a drawing is, which strokes are which parts, how it moves, and its role in the scene. |
| **Illustrator** (AI) | New paper characters and props, and storybook page art. |
| **The app** (not AI) | Physics, positions, surface bounds, episode length, moderation, and what becomes canon. |

**Failure handling:**
- **AI is slow:** one narrator bridge or ambient beat. If it's still slow, play the scene's authored beat.
- **AI fails:** the authored beat plays and your creation stays on stage.
- **Doodle misread:** you correct it with a tap.
- **Doodle can't be read at all:** it still comes alive with a simple hop, and a character asks you what it is.

**Without AI** (take-it-away test): the flagship series plays as an authored story with branches, reach-in still works, and doodles still come alive with simple motion. The adaptive story is the AI layer on top of a complete theater.

## 10. Product components

```
 Input (hands · eyes · voice)
        │
        ▼
 Intent router ──► Doodle reader ──► Puppet maker (your strokes → animated paper puppet)
        │                                   │
        ▼                                   ▼
   Director  ◄──► Series memory      Stage (book, sets, puppets, physics, surface fitting)
        │        (canon, cast,              ▲
        │         pages)                    │ stage actions
        ├──► Characters ──► Voice & music ──┤
        └──────────────────────────────────►┘
 Story Circle session: syncs stage state and player inputs across players
```

- **The Stage works without the AI.** Authored stories play on it unchanged.
- **The Director never addresses the user directly.** It only issues stage actions.
- **Series memory is the single source of truth for canon,** and only the app writes to it.

## 11. Content, privacy & safety

- Inputs (premises, speech, doodles) are moderated, and so is AI output (lines, art).
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
  - *Innovation:* your own drawing becomes a recurring character in an AI-directed show on your real surface.
  - *Experience:* the story starts instantly, payoff comes in minute 1, the book is the whole UI.
  - *Technical:* surface fitting in unfamiliar rooms, hand drawing, explicit gaze selection, synced multiplayer, 60 fps.
  - *Polish:* a single paper-and-ink art direction, voices, music.
- **Special awards it genuinely fits:**
  - Agentic Interaction: the director acts through the stage.
  - Reason to Come Back: your creations return with needs.
  - First Five Minutes.
  - Social & Multiplayer: Story Circle.

## 13. Success criteria

- A first-time user gets a payoff within the first minute and finishes episode 1 within 10 minutes, with no instructions.
- A zero-input viewer still gets a satisfying, resolved episode.
- A doodle starts moving within 2 s of finishing it, and at least 8 in 10 doodles are read correctly before any correction.
- The next episode *changes* because of the last one's recorded consequences, not just mentions them.
- In Story Circle, every participant changes the scene at least once per episode.
- Steady 60 fps on Quest 3.

## 14. Non-goals

- Chat UI, text input, or a story editor.
- Mature, horror, or under-10 content.
- Replacing your strokes with generated "finished" art.
- Any dependency on the passthrough camera.
- Matchmaking with strangers.

## 15. Demo video beats (under 3 min)

1. **Hook (first 10 s):** draw a lopsided dragon in the air. Those exact strokes lift off, swoop down, and rescue Pip. Pip names it.
2. The book unfolding on a real kitchen table, and the cast.
3. Hand Pip the lantern, and the cave lights up.
4. One continuous intervention → consequence: talk to Wick, and the ending changes.
5. The episode's page records the dragon.
6. Labeled "next evening": the dragon is stuck in the chimney, and only you can help.
7. Story Circle: two friends' ink colors in one story, each changing the scene.

## 16. Open questions

- What does the remote Story Circle avatar look like at the book's edge?
- Business model after launch (series packs vs. subscription). Needed for the "future plans" field.
