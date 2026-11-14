# Ticket 2: First five minutes (ends at M2)

**Status:** Done. M2 signed off by the owner in the headset on Nov 14 (session 2, the re-cut chapter in 5:59), with one fix after: the page now turns by hand. A first play by someone new is still to do. Built end to end on Nov 13, re-cut after headset session 1, and reviewed once by Codex (PR #7).

**Goal.** M1's last moment, Pip looking up at you with a dark lantern, becomes a complete 5–7 minute authored episode. You hand the lantern back and it relights. The drawer slides open at the gap, you hand Pip anything, and that decides how he crosses. The lamp is relit and its beam sweeps your room. Doing nothing also makes a satisfying episode. This is the first build someone else plays, so handing things over has to feel good with no instructions.

**Read with:** `docs/sprint-plan.md` (ticket 2), `docs/technical-design.md` (Objects, Director), `docs/design-language.md` (Hands and feedback, the look bar), `docs/playtest-notes.md`, `art/m2-proof.html` (the approved gap, drawer, satchel and crossings), `docs/plans/2026-11-12-ticket-1-first-30-seconds.md`.

## Decisions made with the owner (Nov 13)

- **The lantern rekindles in your hand.** Pip drops it in fright. You pick it up, and a glow wakes between your fingers as you carry it to him. If you do nothing, he fetches it himself in the dark and his courage relights it. Either way, that flame relights the lighthouse.
- **A wrong gift gets a funny failure, then another try.** Pip keeps the sock as a scarf. With the key, Moth zips at the shine. The drawer stays open, and Wick arrives only if time runs out.
- **The page corner invites you.** It lifts with a gold edge. Pull it and the page turns; leave it and it turns on its own after about 6 s.
- **The ending stays.** The beam keeps turning, the object you used goes into your satchel, and "The end of chapter one" is printed on the page. The lit scene stays until you close the book.
- **The episode is data, played by a generic engine.** Ticket 3's director adds beats into the same scheduler, and the simulator runs the same code.
- **A small paid sound run (010)** for every line in the run-005 voices, plus the new foley. It gets its own plan and your window on the shared account first.
- **Ticket 5 is held** until single player is done.
- **A first-session journey, not a one-off demo.** The landing page knows whether you're new, back mid-chapter or finished. The end of the chapter is a page in the book with "Read it again". Menus are always pages of the book, never panels. The contents page (sage tab) and Tonight's lost thing are ticket 3's, and the no-headset page and About are ticket 6's.

## Re-cut after headset session 1 (owner, Nov 13)

The owner played the first version through and asked for: a shorter run before the first page turn, at least two page turns, spreads that don't feel static, and the lamp's beam as the opening wow, with the chapter as the journey to relight it. Rebuilt the same day, with the owner's go-ahead and a 200-credit cap while away (spent 106: run 011's art 64, run 012's voices 42).

**Chapter 1, "The night the light went out": three spreads, two turns.**
1. **The lamp** (new spread, run 011: the top of the lighthouse up close). The book opens on the lit lamp and the beam sweeps your room. The storm: the lamp goes dark, Pip's lantern blows out and rolls to the gallery's edge; you hand it back and it rekindles in your hand (or he fetches it, brave). The lamp's wick has blown away; Wick can't see well, so Pip goes down to the shore. **Turn the page.**
2. **The shore** (now with its own night sky). Moth turns up. The lamp's wick lies in the reeds where Pip can't reach: you reach in for it (or Moth fetches it). A kite and a spool lie on the sand; whatever you pick up comes with you in your satchel, and what you leave stays on the shore. **Turn the page.**
3. **The gap.** The drawer and your satchel open together. The crossings, Wick's rope if nobody helps, the climb, the new wick, Pip's flame to the lamp, and the beam returns. "The end of chapter one", "Read it again".

Your hands have a moment on every spread (the lantern, the wick, the gap), and what you find on the way is what you have at the end. Every path runs 5:02 to 6:47 with real voices. Captions page long lines two printed lines at a time.

## The first version, beat by beat (superseded by the re-cut above)

Times are from the book opening, along the zero-input path unless marked. Every ask has an "ignored" beat, so the show never waits on you.

| When | Scene | What happens | If you act |
|---|---|---|---|
| 0:00 | Shore path | M1's opening, unchanged up to the look-up | — |
| 0:09 | | Pip trembles, and the dark lantern slips from his paw and rolls to the page's near edge. He reaches toward it but won't go near the dark edge. He looks up: "Could you…?" | You pick it up and a glow wakes in it, growing as it nears him. He watches your hand and reaches with both paws. Let go anywhere close and it eases into his paws and flares up. The mood warms from night back toward dusk, he hops with relief, and he thanks you while looking at your face. **First payoff, 0:20–0:45** |
| 0:30 | | Ignored: he creeps to the dark edge, trembling, and takes the lantern back himself, and his courage relights it (owner's call: "Pip learns the dark"). The do-nothing viewer's payoff, at about 0:35 | — |
| 0:45 | | He sets off along the path. Moth flutters in, drawn to the flame. Two or three short narrator and Pip lines about the Lost and Found | Gifts here: see "Gifts with no open problem" |
| 1:40 | Page turn | The right page's near corner lifts with a gold edge. The pop-ups fold flat, the leaf turns, and the gap rises | Pull the corner and the leaf follows your hand |
| 2:00 | The gap | Pip walks to the near edge. The path stops. "If only we could cross…" The drawer slides toward you and the five objects stand up | Kite: lifts him over. Spool: Moth carries the thread across and he hauls along it. Ladder: laid across as a bridge, and he crawls over. Sock: far too short, so he wears it as a scarf, warmer at least, and asks again. Key: he tries to unlock the gap, Moth zips at the shine, and he asks again |
| 2:30 | | Ignored, 30 s after the ask (the contract's limit), or 30 s after a wrong gift's hint: Wick appears on the far rim, grumbling, and throws his rope across | — |
| 3:30 | The gap, continued (the lighthouse stands on this set) | Pip reaches Wick at the lighthouse way. The lamp is dark, and Wick squints at it and can't quite see to light it (gentle) | Every path: Pip offers his lantern's flame, and a spark (the ember from the found-surface moment) rises to the lamp. One ending, so no line needs to branch on how the lantern came back |
| 5:30 | | The lamp lights. The mood goes gold and the beam sweeps your room. The object you used slides into your satchel, and "The end of chapter one" is printed on the caption band | The scene stays live until you close the book |

The time-box is 5–7 minutes on every path. The narrator and small character beats fill the walks, so a fast Reader doesn't finish in 3 minutes, and bridges stretch a path that runs short.

**Gifts with no open problem** (for example, pulling the drawer on the shore path and handing Pip the kite): he takes it, turns it over and sets it down at his feet. It stays given and stays on stage. At the page turn, anything at his feet slides into your satchel, so you can hand it to him again at the gap. Nothing you give is thrown away.

**Gifts he's already tried** (the sock handed a second time): no new line, since no line ever repeats. He shakes his head, sets it down, and you hear the soft felt thud of "can't do that".

**Picking up a character.** Pinch Pip, Wick or Moth at the top of the head (reaching 5 cm up, like everything else). They lift with a small startled acting and a widening shadow, and the show holds while you have them, the way it does for a pause. Set them down anywhere on the page and they settle there, then walk back to their mark if a beat needs them. Let go off the page and they hop back onto it. Tracking lost while holding one sets them down where they were. Nobody can be picked up mid-crossing or during the page turn: they give a small shake instead.

## What makes a hand-over feel good

This is P1, and it gets tuned in the headset with you and one other person. Starting values:

- **Grab:** every object's target is at least 64 mm and reaches 5 cm straight up (the M1 lesson: real tables stop fingertips). An upright object is grabbed at its top. The nearest object wins.
- **Held:** it lifts, its contact shadow widens on whatever is below (page, drawer or your real table), and you hear a quiet rustle. It follows the pinch point at full frame rate.
- **Noticing:** within about 15 cm of a character (scaled with the stage), the character looks at it, ears and head turn, `reach` holds out both paws, and you hear a small interested sound. This is the moment that makes it feel alive, so it happens *before* you let go.
- **Handing over:** release within about 8 cm of the grip, and it eases into the paws over 150–200 ms. `take` starts in that same frame, then `examine` with a pleased or puzzled sound. No precise placing is ever needed.
- **Release elsewhere:** it settles straight down onto the page, the drawer or your scanned table, with a card-on-table sound. Nothing hangs in the air. Past the table's edge, it settles at the nearest point on the table. The lantern is the one story-critical object: if it's left off the page when its ask times out, it rolls back to the page's edge before Pip fetches it.
- **Timers wait for you, but not forever.** While you're holding something, an "ignored" beat waits until you let go, plus 3 s. That grace adds up to at most 20 s per ask, so the time-box holds. After that the show goes on (Wick arrives) and you keep what's in your hand.
- **The lantern's glow** wakes at the grab (an ember-sized glow and a soft brass sound) and grows with closeness to Pip, so the hand-over has a direction before anything is said.
- **Gaze and pinch, for VR Glasses:** look at an object and pinch, and it lifts and glows. Look at a character and pinch, and it floats to them. It's the same hand-over code, with only the selection different.

## How it's built

Engine code knows no character names (the repo test enforces this). Everything named lives in data.

| Unit | Does | Where |
|---|---|---|
| **Episode data** | Episode 1 as a contract `Spine` with two scenes, `shore-path` and `the-gap`. The lighthouse ending runs inside the gap scene, because the lighthouse stands on that set and the last scene must resolve its own problem. Beats, problems, tag rules and bridges are all checked by `checkSpine` in a test. `lantern-lost` accepts `glows`. `the-gap` accepts `flies`, `rope`, `spans`/`climbs` as `solved`, and `soft` and `opens`/`shiny` as `partial`, with a fallback for anything else. **Retries without a cycle:** the ask beat is the only beat that asks. A partial or fallback beat goes on to a hint beat with no ask, then to the ignored beat (Wick). The problem stays open in the scheduler until it's solved, so a gift during the hint still picks a rule. Every crossing beat and Wick's rope `resolve` the gap. M1's opening becomes the first beat, unchanged | `client/public/show/episode-1.json` |
| **Manifest** | Grows from one set and one beat to sets, objects (`ObjectDef`s from `art/objects/`, plus the lantern as an object over Pip's own lantern art, with no new painting), the drawer, the satchel and new cue kinds. Client schema only | `client/public/show/manifest.json`, `client/src/show/manifest.ts` |
| **Scheduler** | Generalises `runtime.ts`. It follows the beat cursor across scenes and keeps the played history: beat id plus start time on the show clock. An `ask_reader` opens its problem. A gift picks a rule (`pickProblemRule`), preempts at once, and logs `problem.attempted`. `partial` keeps the problem open, and `solved` closes it. An ask's wait and its ignored timer are the same, at most 30 s (`waitSeconds`), with the capped holding grace on top. It plays one unused bridge if a path would end before the time-box. **History** is a list of bound executions: beat id, gift bindings (`$offered`, `$receiver`), start, effective end (where a preemption cut it), and which lines started. Stage state is a pure function of that history plus the clock, and actions after a beat's cut are never applied. So resume still replays nothing, even right after a preemption | `client/src/show/` |
| **Speech** | Speaker-aware playback: each line plays in its own character's voice and position, captions include `ask_reader` lines, and a preempted line fades out within 150 ms rather than talking over the reaction | `client/src/sound/`, `client/src/show/sound-marks.ts` |
| **Object system** | Every `ShowObject` has one home at a time: page, drawer, a character's paw, your hand, your table or the satchel. Hand-over sensing, settle, the feedback states and events (`entity.grabbed`, `entity.placed`, `object.handed`, `object.used`, `object.kept`). It reuses M1's gesture core, with object proxies alongside the book's | `client/src/objects/` |
| **Drawer and satchel** | The drawer slides out from under the page block (run 007's `drawer.json`, including its three-stage stow at full travel), opened by a beat or by pulling it. The satchel sits beside the book, and its flap lifts when something goes in or you pinch the gold tab. **The table fit covers the whole arrangement:** placement and sizing fit the book plus the drawer at full travel, and the satchel goes on whichever side has room (right of the fore-edge by default, left of the cover otherwise). If it still doesn't fit, the scale steps down. Drawer travel is never shortened, since the stow needs it. The scanned table's outline is kept, so anything set down settles on it | `client/src/book/`, `client/src/stage/sizing.ts` |
| **Page turn and second set** | Both sets are built and uploaded before XR. The turn folds the pop-ups flat, sweeps a leaf (current ground on its front, the new ground on its back), swaps the set under it and rises again. The corner proxy invites you and takes priority over the fore-edge near the corner | `client/src/book/` |
| **Crossings and the lamp** | Authored cues: kite lift, ladder lay-and-crawl, thread carried by Moth, rope throw, walking between marks (legs swap at 12 poses a second), the spark rising to the lamp, the `lamp-lit` swap, and the gold mood. The beam is M1's | `client/src/show/cues.ts` and views |
| **Characters notice you** | Characters look at your real head when they speak to the Reader (M1's yaw plus the `up` head), and look at and reach for an object coming near | `client/src/puppet/` |
| **Checkpoint v2** | Adds the played history, the open problem and its timer, and every object's home. A crash mid-episode reloads to the same moment, with objects where they were | `client/src/show/checkpoint.ts` |
| **Landing that knows you** | The one button reads from saved progress: "Open the book", "Continue chapter 1" (with "Start from the beginning" under it), or "Read chapter 1 again". It's still one tap into XR. Progress is a small record of chapter and state kept in local storage beside the log, so it survives closing the browser. The 30-minute crash checkpoint stays as it is. Designed with the frontend-design skill, in the landing's existing look | `client/index.html`, `client/src/landing/` |
| **End-of-chapter page** | Once the lamp is lit, "The end of chapter one" is printed on the caption band, and "Read it again" is printed on the right page with a gold edge, pinched like the ribbon (64 mm, reaching 5 cm up). Reading again folds the pop-ups down, turns back to the shore path and plays from the top, with a fresh drawer and an empty satchel (memory across episodes is ticket 3's) | `client/src/book/`, `client/src/show/` |
| **Simulator** | Node, with no DOM: the same scheduler, spine and object rules, a virtual clock, real voice durations from the manifest, and scripted Readers | `client/src/show/simulate.ts`, `tests/episode.test.ts` |
| **Sound (run 010)** | Every line through run 005's voices and the chain, plus foley for the drawer, object pick-up and set-down, lantern rekindle and flare, page turn, kite, rope, ladder, the spark, the lamp and the satchel flap. Until it's approved, lines are captions and foley is temporary synthesized sound, as M1 did | `art/runs/010-m2-sound/`, `art/sound/m2/` |

**When the book shuts** (the M1 lesson about things left in the air): the drawer stows and closes first. Objects on the page, in a paw, mid-crossing (kite, rope, thread) and the beam's cone hide with the pop-ups. An object in your hand stays in your hand, and one on your real table stays there with its shadow. A test closes the book in every scene and asserts that nothing visible is above the closed book or off the table.

**Contracts.** I expect no change: the beats, problems, rules, events and `ShowObject` already cover this. Three meanings are client decisions, written down here: `partial` keeps a problem open, a problem stays open past its ask beat until it's solved or ignored, and the holding grace is capped. If a real contract change turns up, it goes as its own small PR first.

## Order of work

Each phase ends playable, and is checked in the emulator against the look bar before the headset.

### Phase 1: P1, handing back the lantern (the thinnest playable)
- [x] Scheduler with cursor, history, asks, preemption and ignored timers. The whole episode's data, not only scene 1.
- [x] The lantern as an object: it drops and rolls to the edge, gets picked up, glows in your hand, is noticed, handed over and flares. It settles if released elsewhere, and the ignored path plays. Checked in the emulator with an emulated hand.
- [x] Feedback states with sound. Emulator flows with hand poses: give it, drop it on the table, ignore it.
- [ ] **Headset session 1:** does handing it back feel good? Tune the noticing and snap distances live.

### Phase 2: The whole episode, every branch
- [x] Shore-path walk, Moth, the page turn (the page's outer edge lifts; pinch it), and the gap set.
- [x] The drawer (beat and pull), all five objects, the three crossings, two funny failures, and Wick's rope. Crossings leave what they used settled on the page.
- [x] Lighthouse scene, the spark, the lamp, the beam ending, the satchel and keeping.
- [x] Simulator: every path and branch.
- [ ] **Headset session 2:** the whole episode, both ways.

### Phase 3: Depth and polish
- [ ] Run 010: plan, your window, generate, check, close. Lines replace captions-only timing, through the speaker-aware playback.
- [x] Picking up, moving and setting down characters: the show holds while you have them, and they hop back to their place.
- [x] Gaze and pinch (`iwsdk-glasses-test`): look at an object and pinch, look at a character and pinch. Checked in the glasses emulator. Field of view checked on the re-cut chapter, Nov 13: seated at the book, the spread, caption, satchel, ribbon, gold tab, the open drawer at the gap and the end page all sit inside 37° across, 25° up and 43° down (the widest is the open drawer, 25° right and 29° down). Gaze and a right-hand pinch on "Read it again" restarts the chapter, and gaze and a left-hand pinch lifts the lantern.
- [x] Checkpoint v2 and recovery mid-episode ("Continue chapter 1"). The book-shut sweep in every scene.
- [x] Telemetry: frames and hitches are named by the beat playing. (Gift timings need a contract change, so they wait.)
- [x] The landing that knows you, and the end-of-chapter page with "Read it again". Landing states checked on the Mac (new, mid-chapter, finished).
- [ ] **Headset sessions, then someone else plays,** from the landing page, with no instructions while you watch: do they know how to start, and what to do at the end? Iterate until you sign M2 off.

## How it's checked

- **Unit tests:** scheduler (preemption, `partial` versus `solved`, capped holding grace, bridges), rule picks for every drawer object, hand-over geometry (noticing, snap, settle onto page, drawer or table), the drawer stow, the book-shut sweep, recovery straight after a preemption and after two different objects play the same branch, and the whole arrangement fitting on a tray-sized table and with no scanned planes.
- **Simulator** (CI, offline), with scripted Readers: nothing ever; lantern given at once, late, or dropped on the table; each of the five objects first; sock then kite; key then ladder; sock and key then the timeout; the same wrong object twice; something from the satchel; a gift with no open problem; holding an object through a whole ask; regrabbing over and over; a release in the same tick as a timeout; picking Pip up mid-scene; the page turned by hand and on its own. Each run asserts:
  - 5–7 minutes long
  - no stretch over 8 s without a line, an acting change or an open ask
  - every gift gets `take` in the same tick and its consequence within 6 s
  - every tag branch is reached
  - every path resolves
  - no line repeats
- **Emulator:** hand-pose flows for the lantern, the drawer, a gift, a dropped object, the page corner and the satchel tab, plus stills at each beat against the look bar, including leaning angles. No controller paths.
- **Glasses:** gaze and pinch for a gift, and the field-of-view mask.
- **Headset** (USB, `pnpm build:review`, adb reverse, live over CDP): P1 with you, then another person; frame rate with all three characters, the drawer and the beam; the beam at the end.

## Risks

| Risk | If it happens |
|---|---|
| Small objects are fiddly to grab (P1) | Bigger targets and a larger snap, then pinch the object and pinch Pip (the gaze path's flow, with hands) |
| The page turn looks mechanical | A simpler fold-down, swap and rise with the leaf's sweep shortened. It never cuts |
| The episode runs short when you act fast | More walk beats and bridges, checked by the simulator's time-box |
| The drawer is out of easy reach on a small table | The whole arrangement fits at a smaller scale, and the book turns so the drawer faces you |
| Frame rate with the drawer, three characters and the beam | Drawer objects share an atlas, and anything off the page isn't drawn |
| Run 010 voices sound wrong to you | Captions-only for that character until ticket 4 |

## Not in this ticket

The director and AI beats, memory across episodes, "Previously on…", Tonight's lost thing (ticket 3), Talk and music (ticket 4), Story Circle (ticket 5, held). The storybook page records only what this episode needs to show ("The end of chapter one", with what you gave in the satchel). The composed page is ticket 3's.

## Review log

Codex reviewed the plan once on Nov 13, read-only and against the code: no P0, seven P1 and one P2. All eight were real, and all are taken.

1. **P1. A retry that asks again makes a cycle** in `checkSpine`, since every ask links to every branch (reproduced). *Fixed:* only the ask beat asks. Partial and fallback beats go on to a hint beat with no ask, then to Wick, and the scheduler keeps the problem open. No contract change.
2. **P1. A lighthouse scene can't resolve.** The last scene must resolve its own problem, and the lighthouse had none. *Fixed:* the ending runs inside the gap scene, on the same set.
3. **P1. A 40 s ask is over `waitSeconds`' 30 s limit.** *Fixed:* the ask and its ignored timer are both 30 s.
4. **P1. Holding forever broke the time-box,** and a wrong gift given twice would repeat its lines. *Fixed:* the grace is capped at 20 s per ask, and a repeated gift gets a wordless "can't do that". Tests cover long holds, regrabs and a release in the same tick as a timeout.
5. **P1. Beat id plus start time can't rebuild a preempted, bound beat.** *Fixed:* history keeps bindings, the effective end and the lines that started, and actions after a cut are never applied.
6. **P1. The drawer and satchel can overhang a fitted table.** *Fixed:* the fit covers the whole arrangement, the satchel takes the side with room, the scale steps down if needed, and drawer travel is never shortened.
7. **P1. Rendered lines wouldn't play:** sound marks and lookups handle only the narrator, and nothing stops a preempted line. *Fixed:* a speaker-aware speech unit, ask captions and a 150 ms fade on preemption.
8. **P2. Picking up characters was missing,** though ticket 2 and the PRD ask for it. *Fixed:* pick up, move and set down, with rules for page turns, crossings and lost tracking.

Codex reviewed PR #7 once on Nov 13, read-only, against `origin/main`: nine findings, one high and eight medium. Eight are fixed; one is left as it is.

1. **High. Something held in a hand can't be let go after a reload.** *Fixed:* a hand isn't kept across a reload, so a restored object that was in a hand waits in the satchel, counted as handled.
2. **Medium. Helping early on the shore skips Moth's entrance,** so Pip thanks a Moth who isn't there. *Fixed:* a character's entrance is never cut. Helped early, they arrive as the help lands. Checked in the emulator.
3. **Medium. Giving the lantern to Wick solves Pip's problem.** *Left as is:* the lantern flies from Wick's paws to Pip's, which reads as Wick passing it on. Making only the one who asked able to take it would stall the story when a hand lands a little wide, between two characters standing side by side.
4. **Medium. The wick or lantern dropped into the drawer vanishes.** *Fixed:* only the drawer's own things go into it. Anything else dropped there lands on the table.
5. **Medium. The things in a closed drawer can still be picked up,** unseen and through the book. *Fixed:* something can be taken only if it and everything it hangs from is shown.
6. **Medium. When a character fetches something you're still holding, the hand thinks it still has it,** and letting go pulls it back out of their paws. *Fixed:* the hand lets go of whatever the story takes.
7. **Medium. Something picked up by looking and pinching doesn't count as handled,** so it's left behind at the page turn. *Fixed:* it counts, the same as a grab by hand.
8. **Medium. "Start from the beginning" does nothing after the first visit,** and the landing page still offers what it offered at load. *Fixed:* once the chapter has run, the landing page shows where it is now ("Continue chapter 1" with "Start from the beginning", or "Read chapter 1 again"), and starting again resets it the way "Read it again" does. Checked in the emulator.
9. **Medium. Picking up a character freezes the story but not their voice.** *Fixed:* their speech pauses with the story and carries on when you set them down. The gasp and hop play on the interface bus, so you still hear them.

