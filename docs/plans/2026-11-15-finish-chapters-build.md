# Chapters 2 and 3: the build plan

Lane B, stage 2, branch `finish-chapter-2`. Builds the story in `docs/plans/2026-11-15-finish-chapters.md` (stage 1, approved with changes; this plan assumes its revision). For Codex's review and the sprint master's approval.

**Built against the approved API shapes** (`docs/plans/2026-11-16-finish-api-shapes.md`, section 1, PR #20). Lane A's host owns `client/src/index.ts` and runs **one mode per page load**; lane B supplies chapter data through `client/src/show/chapters.ts` and `client/src/show/progress.ts`, and patches `show/runtime.ts` and `client/src/memory/`. Lane B doesn't edit `index.ts`. **Stub pushed** (`651cb4c`): `loadChapter(1)` returns today's chapter in the agreed `ChapterData` shape, and `subscribeLibrary()` fires on `writeProgress()`.

**Order:** the contracts PR first, then **chapter 3's engine prerequisites** (so lane C can build on them by the end of Nov 16), then the rest of the engine and **chapter 2**. Thimble's art goes first of the paid runs, so her look is approved in the headset by the end of Nov 16. Feature freeze is the end of Nov 17.

## Stage 2 rulings (sprint master, Nov 16), and where they stand

Approved with changes after Codex's review (0 P0, 6 P1, 3 P2). Runs 017–019 approved at their caps (150 in all).

**The critical path, as an early engine PR to main through the sprint master (target Nov 16, 15:00 IST), separate from chapter 2's content PR:**

| | What | Status |
|---|---|---|
| — | The image runner's per-run ledger and cap check before each job (finding 7), before run 017 | **Done** (`art/tools/ledger.mjs`). Run 017 spent 15 of 20 by our own ledger while the shared balance fell 57 |
| — | Contracts: tags `thread`, `pages`; `boat-home`; `CONTRACT_VERSION` 6 (on top of lane D's v5) | PR #23, rebased to v6 |
| a | `loadChapter(n)` with the chapter's spine and opening placement: `ChapterData.onStage`, `loadStageAssets(..., { spine })`, the manifest's optional `chapters` list (amendment 2) | **Done** on `finish-chapters-engine` |
| b | Progress and places per chapter, and the account adapter: `readLocalChapters(store, seriesId, now)`, `writeLocalChapters(store, seriesId, book)`, `forgetLocalChapters(store)` in `show/progress.ts`, for lane D's boundary (finding 6; the four cases tested) | **Done** |
| c | Every keeper's light carried in every chapter (`startingObjects()` in `stage/build.ts`); `light-high` on the landing | Lights **done**; the mark lands with run 018's set |
| d | `boat-home` in `room-fx/state.ts` and `room-fx/sea.ts`; `SeaView.frame({ ..., book })` | **Done**, tested (pure, resume-safe) |

**Amendment 2's field names** (sent to the sprint master): `ChapterData.onStage: ReadonlyArray<{ cast: string; mark: string }>`; `loadStageAssets(manifest, artBase, renderer, { allowKtx2, onProgress, spine })`, where the host passes `chapter.episode`; `SeaView.frame({ now, nowMs, head, floorY, bookOpen, book })`, where the host passes the book's world position as it already does for the night sky. Host call sites (lane A): `manifest.onStage` → `chapter.onStage` at its three uses in `index.ts`, the `spine` option, and the sea's `book`.

**`LibraryState.storyteller`** becomes lane D's `StorytellerSnapshot` once `client/src/storyteller/provider.ts` is on main (its stub is on lane D's branch). Until then the field stays as it is, so the landing doesn't break.

**Everything else is optional, cutoff Nov 16, 18:00 IST.** What misses it falls back to existing staging, and the story line changes as written here:

| Item | Chapter | If it misses the cutoff |
|---|---|---|
| `light-up` / `light-down` (E5) | 2: `high-*`, `she-sees` | No light leaves Pip's paw. Kite: **Pip**: "A kite! Fly up high, so she can see where I am!" while Pip raises the lantern (`emote raise`) and the kite is set down by him. Ladder: Pip climbs to `light-high` on the rocks (`move`) and raises the lantern. Moth: **Narrator**: "And the moth, who could never leave a light alone, flew round and round it, until it winked like a signal." `she-sees` becomes: **Pip**: "It's very dark down here. But she can see my light. That's what matters." (helping despite fear, per finding 6's second option) |
| | 3: `beacon-*` | See the story file's lane C table: the default beacon only, Pip raising the lantern on the top step |
| Thimble's and Wick's crossings (E6) | 2, 3 | **No longer needed:** the landing names its rock `near-edge` and its step `far-side`, so chapter 1's crossing kinds carry Thimble with data alone; chapter 3's Wick crosses to `far-side` after Pip steps aside to `lighthouse-way`. Settle, next beat and restore are tested for each |
| `use` from the room (E7) | 2: `letter-tide` | `place object:bottle at lantern-edge`, then Pip takes it (if `place` won't move a room object, Moth "brings" it with the same `place`, and the narrator line becomes "But the moth, who loves anything that shines, made such a fuss that the bottle came up after all.") |
| | 3: `log-return` | The hunt's own return (built); Pip picks the logbook up at the book |
| Exit mark, linked part, `place` from the satchel (E8, E9) | 3 | The story file's lane C table (the stair behind the lamp room's glass; the brass key instead of the logbook; the default beacon only) |
| Thimble's look approved in the headset by the end of Nov 16 | 2, 3 | A non-speaking page card from run 017's master; her lines go to Pip and the narrator |
| The hunt's headset walk (lane B owns pass or fail, in the owner's Nov 16 session) | 3 | The logbook glints on the page instead |

**Other rulings:** finding 5, `exit` and link metadata stay client-only and are stripped from the shared library, checked by `StageLibrary.parse(libraryOf(...))` (test added); finding 8, branch and carry-combination coverage for the late-wrong and holding readers after real voices land, first-turn acceptance by reader (quick ≤ 1:45; zero input ≤ 2:05; late wrong ≤ 2:20), and a full unaccelerated zero-input walk; finding 9, run 019's builder takes scene beats and `spine.bridges`, dedupes by line id, and asserts every playable line has a voice.

## Timeline

| When | Lane B | Lane C can |
|---|---|---|
| Nov 16, morning | C0 contracts PR, sent to the sprint master. Run 017 (Thimble) once approved. E1–E4 (chapters, saved places, satchel carry, carry slots) | Read the story and the drafts; plan runs 020–022 |
| Nov 16, midday | E5–E10 (the staging pieces). Run 018 (the landing). Thimble rigged; **chapter 3's prerequisites pushed**, the commit named to the sprint master | Build `episode-3.json` from the draft on that commit, and run it with `?chapter=3` |
| Nov 16, evening | Chapter 2's data on the real engine; lines frozen; run 019 (voices). **Thimble and the landing in the headset** (owner) | Voices and art |
| Nov 17 | E11 and E13 (boat-home, the library's Storyteller part). Chapter 2 in the headset; fixes; PR | Headset, fixes, PR |

Lane B opens one PR at stage 3's end, as the brief says. Lane C works from the pushed engine commit until then. (If the sprint master would rather merge the engine early, it can be its own PR at midday on Nov 16.)

## C0. The contracts PR (first, small, its own)

`contracts/` only, one PR, sent to the sprint master before any chapter data depends on it:

- `contracts/data/tags.json`: `thread` ("Fine thread wound for sewing, light enough to throw and haul on") and `pages` ("Bound pages to read or write in").
- `ROOM_EFFECTS` in `contracts/src/stage-actions.ts`: `'boat-home': { ms: 9000, what: false }` ("the circling paper boat turns out of its circle and sails toward the book").
- Tests in `contracts/` for both. No version bump is needed for additions (to confirm with `contracts/src/version.ts` at the time).

## The engine for several chapters

Each task names its files, what it does, how it's checked, and an estimate. **Files:** the shapes doc gives lane B `show/progress.ts`, `show/chapters.ts`, `show/runtime.ts` and `client/src/memory/`. These tasks also touch files no lane claims there: `show/manifest.ts`, `show/checkpoint.ts`, `objects/objects.ts`, `objects/hands.ts`, `room-fx/state.ts`, `room-fx/sea.ts`, `puppet/`, and the show's data under `client/public/show/` and `art/`. Lane B takes those unless the sprint master says otherwise. Anything the host must call is a function lane B exports; the call site in `index.ts` is lane A's.

| # | Task | Files | Done when | Est. |
|---|---|---|---|---|
| **E1** | **The chapter list and `loadChapter(n)`.** The manifest gains `chapters: [{ n, episode, canon, carry, onStage: [{ cast, mark }], where: [<one line per scene>] }]`; `episode` and `onStage` stay as chapter 1's for one release. `loadChapter(n)` returns the agreed `ChapterData` (title from the episode, `episode` narrowed to the `Spine` with its carry choice already wired in, `canon`, `next`, `where(beatId)`). The host prepares the book from it for this page load; `?chapter=n` is the review shortcut, read by the host. One chapter per page load: no switching inside XR | `show/manifest.ts`, `show/chapters.ts` | Stub done (`651cb4c`). Then: `loadChapter(2)` and `(3)` resolve with their data; chapter 1 plays exactly as before (`pnpm test`, the simulator) | 3 h |
| **E2** | **Progress and a saved place per chapter.** `writeProgress()` records each chapter's own state (`tt.chapters`: `{ n: state }`), and keeps today's `tt.progress` record as the furthest chapter, never moving back, so lane D's account sync (which reads it) is unchanged. Checkpoints keyed by episode (`tt.checkpoint.chapter-2`), so `readCheckpoint(store, now, { seriesId, episodeId })` finds chapter n's place; the latest is also kept under `tt.checkpoint` for the same reason. `libraryState()` fills `where` from the saved place (the scene its scheduler was in). `CHAPTERS` gains chapter 2; chapter 3's row is left ready for lane C | `show/checkpoint.ts`, `show/progress.ts` | Unit tests: resume chapter 2 while chapter 1 is finished; reread chapter 1 without losing chapter 2's place; old single-key checkpoints and progress still read; `subscribeLibrary` fires on each write | 2 h |
| **E3** | **The satchel carries, and the recorded page.** At a chapter's start, `memoryOf` (in `memory/memory.ts`, unused so far) over the series log gives the keepsakes from the latest finished chapter, with their histories. A scene object whose id is among them isn't placed; the keepsake stands in for it. **Needs one addition to the agreed shape** (ask 3): `ChapterData.satchel: ShowObject[]`, which the host stages in the satchel as it stages the Storyteller's keepsakes. The recorded page (`page.composed`, which the host's end card reads): `text` is up to three reader-facing lines, from a new `page` line on each canon fact ("You held Pip's lantern until it woke up again."; chapter 1's canon gains them too), and `keepsakes` are object ids that have names in the library | `memory/memory.ts`, `show/chapters.ts`, `client/public/show/episode-1.canon.json` | Unit tests: the kite kept in chapter 1 is in chapter 2's satchel and not on the sand; "Give it back" removes it; chapter 2's end keeps the bottle; every page has at most three lines, all in the second person | 3 h |
| **E4** | **Carry slots.** `episode-N.carry.json`: `slots: [{ after, otherwise, pick: [{ when: { fact, is, has? }, beat }] }]`. In `loadChapter`, `after`'s `next` is set to the first matching pick (by fact, and by the object being in the satchel if `has` names one) or `otherwise`, so `ChapterData.episode` is the spine as it will play. The choice is saved in the runtime's snapshot (`show/runtime.ts`), so a resume plays the same path even if a fact changed since. The spine is checked (`checkSpine`) after the choice | `show/carry.ts` (pure), `show/chapters.ts`, `show/runtime.ts` | Unit tests for every pick in both chapters and the defaults; `tools/chapter-timings.ts` runs every pick | 2 h |
| **E5** | **`light-up` and `light-down`** (one new cue kind each). Target `object:$offered` or a named object: by its tags, a `flies` object rises with the lit lantern hanging under it, its string to Pip's paw; a `climbs`/`spans` object stands upright at the set's `light-high` mark with the lantern at its top. Target `cast:moth`: Moth takes the lantern and flutters up to `light-high`. Pip is left without his light (the lantern's light object moves with it). `light-down` brings the lantern back to Pip's paw and sets the object down at his feet, still given (kept at the end) | `show/runtime.ts` (cue kinds), `show/manifest.ts` (`CueKind`), `stage/` lantern glow | Emulator: all three in chapter 2's spread 2 and chapter 3's beacon; restore mid-cue lands at its end | 4 h |
| **E6** | **Crossings for any traveller.** Already data (`travels: { who, to }`). Two small parameters: `layFrom: 'to'` (the ladder laid from the helper's side, for Thimble and Wick) and `span: 'thread-span'` on a rope-style throw (Grandmother's thread thrown from the step). A crossing with no object (`thimble-heave`, the tide's lift) uses the kite arc alone | `show/runtime.ts` `crossingPose`, manifest cues | Emulator: each of `thimble-*` and `wick-*` | 2 h |
| **E7** | **Things that come from the room.** A scene object can start in the room (the bottle, the logbook) instead of on a mark. `use` on an object anywhere (your floor, beside the book, drifting home) brings it to the user's paw along the beam. Seated, the bottle can be called to the hand by look and pinch, as the hunt's lost thing can | `objects/objects.ts`, `objects/hands.ts`, `show/runtime.ts` | Emulator: the bottle at your feet, picked up, handed over, and called to the hand; ignored, it comes to Pip. The logbook the same after the hunt | 3 h |
| **E8** | **Exit marks and linked parts.** A mark flagged `exit` hides a character who arrives there (a 0.4 s fade); a later `place` brings them back. A rig part linked to an object (Wick's `logbook` part to the `logbook` object) hides while that object is on stage | `show/manifest.ts` (mark flag, rig link), `show/runtime.ts`, `puppet/` | Emulator: Wick leaves by the stair in chapter 3; his logbook part shows in chapter 2 and not in chapter 3 until he holds it | 2 h |
| **E9** | **`place` a satchel object** onto a mark (chapter 3's beacon borrows the kite or ladder): it leaves the satchel with the satchel's flap animation and lands on the mark; it's kept again at the end | `objects/objects.ts`, `show/runtime.ts` | Unit test and emulator | 1 h |
| **E10** | **Library data:** Thimble's cast entry (rig, voice, acting, height 0.07 m) from run 017; the landing set from run 018 with marks (`landing-in`, `pip-step`, `step`, `moth-landing`, `rock`, `pip-side`, `wick-steps`); marks on the lamp (`moth-lamp`, `thimble`, `stair` as an exit), the shore (`water-edge`, `light-high`), the gap (`rope-far`, `wick-lands`, `lamp-thimble`); objects `logbook` (from Wick's part, finished at Pip's density for free) and `thimble-boat` (paper boat art); `thread` on the spool; the new cues and their sound marks | `client/public/show/manifest.json`, `art/cast/thimble/`, `art/sets/the-landing/`, `art/objects/` | `checkSpine` passes on both drafts against the real library | 3 h |
| **E11** | **`boat-home`, the signature's peak.** In `room-fx/state.ts` and `room-fx/sea.ts`: from where the boat is on its circle, it turns and sails across the floor toward the point below the book, slowing, and fades as it reaches the table's foot. The sea stays. Restore lands it gone | `room-fx/state.ts`, `room-fx/sea.ts` | Emulator in the living room and the painted room; then the owner in the headset | 3 h |
| **E12** | **"Continue to chapter 2"**, by the agreed shape: one chapter per page load, so it isn't an in-session swap. Lane B supplies `ChapterData.next` and `libraryState().next`; the host's end card offers it and starts a new page load on chapter 2 (lane A's entry target). Lane B's part is the data and tests | `show/chapters.ts`, `show/progress.ts` | Unit test: after chapter 1 is finished, `next` is chapter 2 and `libraryState().next` says so | 0.5 h |
| **E13** | **The library's Storyteller part.** `LibraryState.storyteller` becomes lane D's `StorytellerSnapshot` from `storytellerSnapshot()` in `client/src/storyteller/provider.ts`, and `subscribeLibrary()` also fires on lane D's `subscribeStoryteller()`. Lands when lane D's provider is on `main`; until then the current field | `show/progress.ts` | Unit tests on `libraryState()` for every chapter state, with a stubbed provider | 1 h |

**Chapter 3's prerequisites** are E1–E10 (E4's carry, E5's beacon, E7's logbook, E8's stair and linked part, E9's borrowed kite or ladder). They come first, together, by midday on Nov 16. E11–E13 serve chapter 2 and the product, and land by the freeze. Where a task needs the host to do something new (stage `ChapterData.satchel`, read `?chapter=n`), lane B names the call and lane A adds it in `index.ts`.

## The dependency table

Every new action, cue and shared asset, who owns it, its targets and what's true when it has finished.

| Id | Kind | Targets | Completion state | Owner | Used by |
|---|---|---|---|---|---|
| `thread`, `pages` | Tags (C0) | — | In the vocabulary; `checkSpine` accepts them | B | Ch 2 `the-rocks`, ch 3 `the-glint` |
| `boat-home` | Room effect (C0, E11) | No object | No room boat; the sea stays on | B | Ch 2 `she-sees` |
| `light-up` | Cue kind (E5) | `object:<flies or climbs/spans>`, `cast:moth` | Lit lantern at `light-high` (on the kite, atop the ladder, or with Moth); Pip has no light | B | Ch 2 `high-*`, ch 3 `beacon-*` |
| `light-down` | Cue kind (E5) | None | Lantern lit in Pip's paw; the object at his feet, still given; Moth back by Pip | B | Ch 2 `she-sees`, ch 3 `calling` |
| `thimble-thread` | Cue (crossing, E6) | `object:$offered` | Thimble on the bottom step (`step`), the thread span shown, then put away | B | Ch 2 `in-by-thread` |
| `thimble-rope`, `thimble-ladder`, `thimble-kite` | Cues (crossings) | `object:$offered` | Thimble on the step; the ladder laid from Pip's side | B | Ch 2 `in-by-*` |
| `thimble-heave` | Cue (crossing, no object) | None | Thimble on the step | B | Ch 2 `rocks-tide` |
| `wick-rope`, `wick-ladder`, `wick-kite` | Cues (crossings) | `object:$offered`, `object:rope-coil` | Wick at `wick-lands`, beside Pip on the far side | B | Ch 3 `wick-*` |
| `use` from the room | Engine (E7) | `bottle`, `logbook` | The object in the user's paw, wherever it was | B | Ch 2 `letter-tide`, ch 3 `log-return` |
| `place` from the satchel | Engine (E9) | `object:kite`, `object:ladder` | The object on the mark, out of the satchel | B | Ch 3 `beacon-kite`, `beacon-ladder` |
| Exit mark | Engine (E8) | `the-lamp` `stair` | The character hidden until placed again | B | Ch 3 `errand` |
| Linked part | Engine (E8) | Wick `logbook` ↔ object `logbook` | Part hidden while the object is on stage | B | Ch 3 |
| Carry slots | Engine (E4) | `episode-N.carry.json` | `after.next` chosen at the start, saved with the checkpoint | B | Ch 2, ch 3 |
| **Thimble** | Shared asset | Rig, heads, voice | In the library; look approved in the headset by the end of Nov 16, **or** a non-speaking page character (her lines go to Pip and the narrator, lane B rewrites both chapters' drafts) | B (run 017, rig, run 019 voice) | Ch 2, ch 3 |
| **The landing** | Shared asset | `the-landing` set and marks | In the library | B (run 018) | Ch 2 spread 3, ch 3 spread 2 |
| **`logbook`** | Shared asset | Object from Wick's part | In the library with `pages`, `message`, `heavy` | B | Ch 3 |
| `thimble-boat` | Object | Paper boat art | In the library | B | Ch 2 |
| Snowy pages | Art | The lamp, the landing, the gap | Lane C's call (run 014's `snow-cover.png` or repaints) | C | Ch 3 |

Existing cues reused as they are: `open-book`, `lamp-lit`, `lamp-out` (chapter 3's frost), `beam`, `set-down`, `page-invite`, `page-turn`, `keep`, `chapter-end`. Existing room effects reused: `sea`, `bottle`, `boat`, `tide-in`, `tide-out`, `sea-off`, `snow`, `clear`, `hunt`, `night-sky`, `stars-lantern`, `stars-kite`, `stars-fox`, `shooting-star`, `day`.

## Chapter 2's build

| # | Task | Done when |
|---|---|---|
| B1 | `client/public/show/episode-2.json`, `.canon.json`, `.carry.json` from the drafts in `docs/plans/finish-chapters/` | `checkSpine` passes; `pnpm test` covers the chapter (spine valid, every path resolves, every pick reachable) |
| B2 | Run 017, rig Thimble (head offsets measured, as Pip's) | Thimble stands on the landing beside Pip in the emulator; the owner approves her look in the headset (Nov 16) |
| B3 | Run 018, the landing's `set.json` and marks, measured | The crossings land where they should in the emulator |
| B4 | Lines frozen, run 019 (voices and two sounds), re-timed from the real voice | `tools/chapter-timings.ts` inside 5–7 min on every path, first turn by about 1:45; `node tools/director-sim.ts` with `TT_EPISODE=show/episode-2.json` green |
| B5 | The emulator walk, every branch (`?chapter=2`, `?jump=<beat>`, `?speed=4`): the bottle seated and standing, every `light-up`, every crossing, `boat-home`, pause and resume in each spread, Read it again, Continue from chapter 1 | Screenshots and the telemetry's fps per spread recorded in the lane's `docs/playtest-notes.md` section |
| B6 | The owner in the headset: chapter 1 then chapter 2, continuing from the end page | Sign-off, before merge |

## Checks

- `pnpm check` (typecheck, tests, bundle) green on every push.
- New unit tests: `show/carry.ts` (every pick and default, saved choice), `show/progress.ts` (per-chapter progress, `libraryState()` for each state, `where`, `next`, `subscribeLibrary`), `show/chapters.ts` (`loadChapter` for each chapter, the carry choice wired in, `satchel`), `show/checkpoint.ts` (per-chapter keys, the old key), `memory/memory.ts` (satchel across chapters, scene objects replaced by keepsakes), `room-fx/state.ts` (`boat-home`), `contracts` (the tags, the effect).
- `node tools/chapter-timings.ts <episode> --carry <carry>` for both chapters (four readers, every pick). Against the real manifest once E10 lands, the `--cues` and `--objects` overrides drop away.
- `TT_EPISODE=show/episode-2.json node tools/director-sim.ts` for chapter 2 (the AI layer stays off for written chapters, but the scheduler's guarantees are the same).
- Emulator checks with the IWSDK skills; the headset only for what IWSDK renders (Thimble, the landing, the sea's signature, the whole chapter).

## Timings, on the real scheduler

`tools/chapter-timings.ts` on the drafts, lines not yet voiced timed at 1.3× the caption estimate, new cues at the nominal times in `docs/plans/finish-chapters/cues.draft.json`, `boat-home` as 9 s. Four readers: **quick** answers each ask after 4 s; **zero input**; **late wrong gift** gives the wrong thing 2.5 s before each ask runs out, then nothing; **holding** holds something through every ask. "Turn" is when the first page can be turned.

| Chapter 2 | Quick | Zero input | Late wrong gift | Holding |
|---|---|---|---|---|
| Default (chapter 1 not played) | turn 1:40, end 5:18 | 1:58, 6:19 | 2:15, 6:55 | 2:10, 6:39 |
| With a chapter 1 carry line (each of four) | 1:44–1:45, 5:22–5:23 | 2:02–2:03, 6:23–6:24 | 2:19, 6:56 | 2:14–2:15, 6:43–6:44 |

| Chapter 3 | Quick | Zero input | Late wrong gift | Holding |
|---|---|---|---|---|
| Default | turn 1:36, end 5:18 | 1:58, 6:29 | 2:15, 6:55 | 2:10, 6:49 |
| Thimble's carry line (each of three) | 1:37–1:38, 5:20 | 1:59–2:00, 6:30–6:31 | 2:16–2:17, 6:47–6:56 | 2:11–2:12, 6:50–6:51 |
| The beacon with the kite or the ladder | 1:36, 5:19 | 1:58, 6:29 | 2:15, 6:55 | 2:10, 6:49 |

Every run ends inside 5–7 minutes, with no quiet over 8 s and no repeated line. The late-wrong path sits at the scheduler's own time-box (it shortens waits to finish by 7:00), which is the margin to watch when real voices come in. **Quick-path beat starts**, chapter 2: the sea at 0:28, the bottle's ask at 0:44, the first turn at 1:40, the boat at about 1:55, the light up and `boat-home` at 2:23–2:30, the landing at 3:08, home at 4:32, the end page at 5:00. Chapter 3: the frost's ask at 0:51, the turn at 1:36, the hunt at about 2:05, the beacon at 2:32, the gap at 2:53, **the stars at 4:02**, morning at 4:39.

## Lines and money

**The deduplicated line ledger** (every distinct line in each draft, by the contract's line id, against the manifest and the chapter before):

| | Distinct lines | Already voiced | To voice | By speaker | Over 200 characters |
|---|---|---|---|---|---|
| Chapter 2 | 83 | 4 | **79** | narrator 17, Pip 42, Wick 10, Thimble 10 | 0 |
| Chapter 3 | 78 | 2 | **76** | narrator 18, Pip 31, Wick 18, Thimble 9 | 0 |

**Capped budgets per chapter.** 1 credit a line (run 005), 5 a 1K image, 9 a 2K image, 1 a second of sound.

| Lane B (chapter 2 and the shared assets) | Estimate | Cap |
|---|---|---|
| Run 017, Thimble: master, parts sheet, heads sheet (1K) | 15 | 20 |
| Run 018, the landing: key (1K), ground and two layers (2K) | 32 | 41 |
| Run 019, chapter 2's voices (79), two sounds (4), Thimble's audition if needed (3) | 86 | 89 |
| **Total** | **133** | **150** |

**Trim order before spending past an estimate:** the landing's rope branch (2 lines), the four chapter 1 carry lines (4), the three bridges (3), then a 1K landing key instead of a repaint. Every run reconciles each job against its known price (run 015's lesson) and stops at its cap.

| Lane C (chapter 3, for its own plan) | Estimate |
|---|---|
| Voices, 76 lines | 76 |
| Sound (snow underfoot, a frost tinkle) | about 6 |
| Snowy pages | 0 with `snow-cover.png`, about 27 for three 2K repaints |
| **Total** | 82–109 of its 150 |

## The run plans

Written under `art/runs/` with their estimates and caps, per `art/README.md`. **Nothing is spent until the sprint master approves.**

- **017-thimble** (`art/runs/017-thimble/plan.json`): estimate 15, cap 20. A master from Pip's reference, then a parts sheet and a heads sheet from the master, on slate-blue paper.
- **018-the-landing** (`art/runs/018-the-landing/plan.json`): estimate 32, cap 41. Key from the shore's night sky and headland (`ref-headland.png`, made for free from the shore set), then the ground, the far rocks and the near steps. The ground's rock and step are placed by fractions of width, and measured and remapped for free if off (run 007's lesson).
- **019-chapter-2-voices** (`art/runs/019-chapter-2-voices/plan.json`): estimate 86, cap 89. Voice jobs written by a `build_plan.mjs` from the final `episode-2.json` (run 012's), plus a small splash and a nib scratching.

## Risks and fallbacks

| Risk | Fallback |
|---|---|
| Thimble's look isn't approved by the end of Nov 16 | A non-speaking page character (a single card with simple motion, from her master), her lines given to Pip and the narrator in both drafts |
| `boat-home` doesn't look right on the floor | The room boat fades where it is as the narrator turns it home, and the page boat arrives on the next spread |
| The hunt fails its headset walk | Chapter 3's logbook glints on the page instead (story file, lane C's handoff) |
| Real voices run long | The trim order above, then `who-goes` and `ashore`'s second lines |
| Lane A's host isn't ready to stage chapter n when lane B's data is | `?chapter=n` on a review build through today's code path, kept until the host lands, so chapters 2 and 3 can still be walked |

## Asks for the sprint master

1. Approve this plan and runs 017–019 (133 estimated, 150 capped).
2. The contracts PR (C0) goes to you first thing; nothing depends on it before you've seen it.
3. **One addition to the agreed shape:** `ChapterData.satchel: ShowObject[]`, the keepsakes carried from earlier chapters, which the host stages in the satchel. Without it the satchel can't carry into chapter 2 (the brief's "the satchel … carrying into later chapters").
4. Account sync reads `tt.progress` and `tt.checkpoint`; E2 keeps both as "the furthest chapter" and "the latest place", so lane D's code needn't change. A guest reset should also clear the per-chapter keys (`tt.chapters`, `tt.checkpoint.<episode>`): a one-line change in `client/src/account/index.ts`, through you.
5. Chapter 1's title on the page: "The lamp goes out" (`CHAPTERS`) or "The night the light went out" (the episode).
6. Confirm that lane B takes the unclaimed files these tasks touch (listed under "The engine for several chapters").

## Progress: the emulator pass, round 1 (Nov 16, IWSDK emulator, emulated Quest 3, hands only)

Run on `finish-chapter-2` after #35 (lane A's host reads `?chapter=n`). Screenshots in `docs/plans/finish-chapters/emu/`.

**Seen working**
- The page, then "Open the book" into chapter 2: the book lands on the living room's coffee table, the lamp spread opens with the beam, Pip, Wick and Moth placed (`03-opening.png`).
- **The signature:** the sea washes in across the floor round the reader at about 0:30 and the bottle washes up at their feet (`09-ch2-sea-live.png`); the paper boat circles on its 1.55 m ring (`10-ch2-paper-boat.png`); chapter 1's `?room=sea` too (`08-ch1-room-sea-live.png`). (An earlier "no sea" was my screenshots: taken after chapter 1's review sea had faded, or looking ahead past the ring.)
- **Carry, live:** with chapter 1 finished on the silent path in this browser, chapter 2 played `carry-rope` after its opening.
- **Zero input, end to end:** the bottle comes up on the tide, Moth carries the light, the tide sets Thimble down, Wick comes, the log, the sea goes out, the end page prints "The end of chapter 2" with three reader-facing lines (`14-chapter-end.png`); no stall; ended about 6:25. Two runs, one resumed from a saved place mid-chapter.
- The landing spread with its caption and the drawer open (`05-landing.png`); spread 1's letter (`11-letter-read.png`).
- Console: no errors from the chapter. The only error is `/api/v1/device` (500): the account backend isn't running in a client-only dev session.

**Found and fixed**
1. **Seated, the bottle at your feet is out of reach** (the emulated seated hand was 1.21 m from it; the most a hand reaches is 0.66 m). *Fixed:* a washed-up bottle still at your feet after 12 s floats up onto the table beside the book (`BOTTLE_UP_MS` in `show/runtime.ts`, the same move as looking at it and pinching), and the bottle's ask waits 22 s instead of 16. Checked in the emulator: the bottle sat on the table at `[0.18, 1.2, -0.48]`, within reach, until the ask ran out.
2. **`boat-home` had no book to sail to:** the host didn't pass the book's position to the sea (amendment 2). *Fixed:* one line in `index.ts`, as for the night sky.

**Not established in the emulator:** a gift by the emulated hand. Three tries (the kite on spread 2, the kite on spread 3, the floated bottle on spread 1) moved or reached the thing, but none registered as a hand-over, so each ask ran to its ignored path. The run-sequence reported no warnings on the last; lane A records the same limit (the in-book hand checks are hand-distance code the emulator doesn't drive reliably). Gifts are covered by `tests/handover.test.ts` and by chapter 1's headset sessions; the owner's headset pass checks them by feel.
