# Chapter 3, "The longest night": the build plan

Lane C of the finish sprint (`docs/plans/2026-11-15-finish-sprint.md`), task `C-chapter-3`, branch `finish-chapter-3` (from lane B's `finish-chapter-2` at `ed7571e`). Stage 1, for Codex's review and the sprint master's approval. Stage 2 is folded in: once this is approved, lane C builds.

**What lane C builds:** chapter 3's content only: its data (spine, beats, branches, lines, carry rules), its snowy pages, its voices and its sound. **What it builds from:** the story, chapter 3's section of `docs/plans/2026-11-15-finish-chapters.md` (lane B is its writer and owns every change to it), the draft spine `docs/plans/finish-chapters/episode-3.draft.json` with its `.carry` and `.canon` drafts, the dependency table in `docs/plans/2026-11-15-finish-chapters-build.md`, and the approved API shapes (`docs/plans/2026-11-16-finish-api-shapes.md`, with amendment 1). **What it doesn't touch:** the engine (`show/runtime.ts`, `show/chapters.ts`, `show/progress.ts`, `stage/`, `room-fx/`, `objects/`, `index.ts`, `landing/`), contracts (chapter 3 needs no change there), `docs/sprint-plan.md`, and anything already painted (Thimble, the landing, the sets, the objects: reused, never repainted).

## The bar, and where chapter 3 meets it

| Chapter 1's bar | Chapter 3 |
|---|---|
| About six minutes | 5:18 quick to 6:55 late-wrong on the drafts, on the real scheduler (below). Re-timed from the real voices |
| Hands only; Talk cut | No microphone anywhere. Every ask is a give, a pinch or a walk |
| Completable silently | Every ask has an ignored path, and each ends with Pip, Thimble or the beam doing it: `frost-thimble`, `log-return`, `wick-rope-self` |
| A hand moment on every spread | 1: give something soft or warm to wipe the frost. 2: bring Wick's logbook back from **your room**. 3: get Wick across the gap |
| A wow by minute 1 | `room snow` at 0:07 on every path: snow round you, settling on your real table (built and approved) |
| One signature moment, saved for the peak | The stars on your ceiling as Wick names them, and the Fox, Pip's star (`the-sky`, 4:02 on the quick path). Built and approved; nothing before it uses the ceiling |
| Room effects only as the story lists | `snow`, `hunt`, `clear`, `night-sky`, `stars-lantern`, `stars-kite`, `stars-fox`, `shooting-star`, `day`. Nothing else; a test fails if anything else appears |
| No test visuals | Snowy pages made from the book's own paint (run 020); no placeholder sets. If a snowy piece fails the look bar and its repaint does too, that spread ships on its approved unsnowy set, not on a test visual |

## Chapter 3's data, in order

Built from the drafts exactly: titles, ids and lines as written. Trims are allowed (lane C, reported); a new line goes through the sprint master. Everything below is data in `client/public/` and `art/`, plus one new test file.

### Files

| File | What it holds |
|---|---|
| `client/public/show/episode-3.json` | The spine: three scenes, 36 beats, three bridges, from `episode-3.draft.json`. Each scene's `setId` points at its snowy set (below) |
| `client/public/show/episode-3.canon.json` | The facts `frost`, `logbook`, `wick-across`, `keeper`; histories for the sock, kite and ladder, and a neutral default; the reader-facing `page` line on each fact (E3's shape; text below, for approval) |
| `client/public/show/episode-3.carry.json` | Two slots: after `opening` (Thimble's carry line), after `lost` (the beacon) |
| `client/public/show/manifest.json` | Additive only: chapter 3's entry in E1's `chapters` list (episode, canon, carry, `onStage`, `where`); the three snowy sets; `art/sound/ch3` and the snowy set folders in `artFolders`; chapter 3's `voiceLines`; chapter 3's sound cues if lane B's sound-cue mechanism lands (run 022) |
| `art/sets/the-lamp-snow/`, `the-landing-snow/`, `the-gap-snow/` | Snowy pieces and a `set.json` each. Unchanged pieces (the skies, the headland) are referenced from the base set, as the gap already references the shore's sky |
| `art/sound/ch3/` | Chapter 3's finished lines and sounds |
| `art/runs/020-snowy-pages/`, `021-chapter-3-voices/`, `022-chapter-3-sound/` | The run plans (written with this plan), their tools, manifests and results |
| `client/src/show/chapter-3.test.ts` (new) | Chapter 3's checks (under "Checks") |
| `docs/playtest-notes.md` | Lane C's own dated section: the emulator walk and the owner's headset session |

### Scene by scene

`*` marks a beat that needs one of lane B's prerequisites; the table under "Prerequisites" names which, and its fallback.

**1. `the-frost`** on `the-lamp-snow`. On stage at the start (manifest `onStage` for chapter 3): Pip at `pip`, Wick at `wick`, Thimble at `thimble`*, Moth at `moth-lamp`*. Drawer: sock, ladder, key, kite. Problem `frost`: `soft`/`warm` → `frost-wipe`; else `frost-puzzled`; ignored 18 s → `frost-thimble`.

| Beat | What's built | Uses |
|---|---|---|
| `opening` | Book opens lit, gold light, the beam; then **the wow:** `room snow` with the narrator's first line | `open-book`, `lamp-lit`, `beam`, `snow` (all built) |
| `thimble-snow` / `carry-thread` / `carry-rope` / `carry-ladder`* | Thimble's first line, by chapter 2's `landing` fact | Carry slot (E4); default `thimble-snow` |
| `errand`* | Wick to the lamp, then out by the stair (fades there); the frost: `lamp-out` and dusk light | Exit mark `stair` (E8) |
| `frost-ask` | Pip asks, waits 18 s, opens the drawer | Built |
| `frost-wipe` / `frost-puzzled` / `frost-thimble` | The wipe (lamp relit, beam); the wrong gift set down; Thimble polishes it clear | Built cues; Thimble walks to `lamp` |
| `too-long`, `page-one` | Thimble keeps the light; Pip asks the Reader to come; the page invite | Built |

**2. `lost-in-the-snow`** on `the-landing-snow`*. Object: `logbook`* (from Wick's part). Problem `the-glint`: `pages` → `log-found`; else `glint-puzzled`; ignored 20 s → `log-return`.

| Beat | What's built | Uses |
|---|---|---|
| `page-turn-landing` | Page turn; Pip to `landing-in`, Moth to `moth-landing`* | The landing's marks (E10) |
| `the-snow` | Pip to `pip-step`; footprints gone; then `room hunt object:logbook at room:couch`: the beam hunts your room and stops on the logbook | `hunt` (built; headset walk owed). The logbook starts as E7 says (on its mark, or in the room) |
| `glint-ask` | Opens as the hunt ends; its 20 s run out with the hunt's own return at 28 s | Built |
| `log-found` / `glint-puzzled` / `log-return`* | Taken from your hand; the wrong thing set down ("the shiny thing I need, the one the light found", true wherever it is); or `use` pulls it to Pip from wherever it is | `use` from the room (E7) |
| `lost` | "Every lost thing follows the light home…" | — |
| `beacon-moth` / `beacon-kite`* / `beacon-ladder`* | **The visible consequence.** Default: Moth takes the light up. With chapter 2's `light-high` = kite (or ladder) and that thing in your satchel: it comes out of the satchel to `pip-step` and the lantern rises on it | Carry slot with `has` (E4), `place` from the satchel (E9), `light-up` (E5) |
| `calling`, `page-two` | "Wick! Follow the light!"; the light comes down; the invite | `light-down` (E5) |

**3. `home-by-the-light`** on `the-gap-snow`. Object: `rope-coil` on `rope-far`*. Problem `wick-across`: `rope` → `wick-rope`; `spans`/`climbs` → `wick-ladder`; `flies` → `wick-kite`; else `wick-puzzled`; ignored 24 s → `wick-rope-self`. The drawer still holds whatever spread 1 didn't use (objects are the episode's, not the scene's), and the satchel what you kept.

| Beat | What's built | Uses |
|---|---|---|
| `page-turn-gap` | Pip on the far side, Moth hovering, Wick at the near edge, the rope coiled | `rope-far` (E10) |
| `the-edge`, `wick-ask` | Wick can't find the edge; Pip asks, 24 s, drawer open | Built |
| `wick-rope` / `wick-ladder` / `wick-kite`* / `wick-puzzled` / `wick-rope-self`* | Wick crosses to `wick-lands` by line, laid ladder or kite; or Pip spots Wick's own rope and throws it himself (the silent path is Pip's growth) | `wick-*` crossings (E6), `use` (built for set objects) |
| `across`* | Pip gives Wick the logbook; Wick hands it back with the lamp: "They're yours, keeper." | Linked part: Wick's logbook part hidden while the object is on stage (E8) |
| `the-sky` | **The signature:** `clear`, `night-sky`, `stars-lantern`, `stars-kite`, `stars-fox`, `shooting-star`, each with Wick's naming | All built and approved |
| `morning`* | Home up the steps; Thimble at `lamp-thimble`*; `day` takes the sky away; the new keeper puts out the lamp (`lamp-out`, dusk light) | `lamp-thimble`, `lamp-wick`, `lamp-pip`, `moth-lamp` |
| `chapter-end` | `keep`, the two closing lines (both already voiced), `chapter-end` | Built |

**Carry** (`episode-3.carry.json`, as drafted): after `opening`, chapter 2's `landing` = thread / rope / ladder picks Thimble's line (default `thimble-snow`); after `lost`, `light-high` = kite with `has: kite`, or ladder with `has: ladder`, picks the beacon (default `beacon-moth`). Chapter 3 played without chapter 2 is whole: both defaults.

**Canon `page` lines** (new reader-facing text for E3's end card; at most three are shown; second person; honest about who did it). For the sprint master's approval:

| Fact = value | `page` |
|---|---|
| `frost` = reader | You wiped the frost off the lamp's glass. |
| `frost` = thimble | You watched Thimble polish the lamp's glass clear. |
| `logbook` = reader | You found Wick's logbook out in your room. |
| `logbook` = beam | You watched the beam bring Wick's logbook home from your room. |
| `wick-across` = rope | You saw Pip throw Wick a line across the gap. *(true on `wick-rope` and `wick-rope-self`, so it claims no help)* |
| `wick-across` = ladder | You gave Pip the ladder that got Wick across the gap. |
| `wick-across` = kite | You gave Pip the kite that flew Wick over the gap. |
| `keeper` = pip | You saw Wick hand Pip the lamp, and Pip's star come out on your ceiling. |

**Where** (one line per scene, E1's `where`): "Stopped at the lamp, in the snow." / "Stopped at the foot of the steps." / "Stopped at the gap, in the snow."

## What chapter 3 reuses (no credits, no repaints)

- **Cast:** Pip, Wick, Moth as built; **Thimble** from lane B's run 017 (rig, heads, voice preset), by id.
- **Sets:** the lamp (run 011), the gap (run 007), the landing (lane B's run 018). Snow is added over their own paint (run 020); nothing is repainted unless the free pass fails, and then only that piece.
- **Objects:** sock, ladder, key, kite, spool, rope-coil (run 006); `logbook` from Wick's part (lane B, E10).
- **Room effects, all built and approved:** snow, hunt, clear, night-sky, the three constellations, shooting-star, day.
- **Cues:** `open-book`, `lamp-lit`, `lamp-out`, `beam`, `set-down`, `page-invite`, `page-turn`, `keep`, `chapter-end`; lane B's `light-up`, `light-down`, `wick-rope`, `wick-ladder`, `wick-kite`.
- **Voices:** run 005's presets (narrator Wanda, Pip Mabel, Wick Arjun) and Thimble's from lane B's run 017/019. Two closing lines are already voiced from chapter 1.
- **Foley:** every existing sound (page, fold, set-down, rope, creak, whoosh, lamp, satchel, chime).
- **Art references:** run 014's `snow-cover.png` (the painted snow texture) and `snow-flakes.png`.

## Prerequisites from lane B, and their fallbacks

Lane B's early engine PR goes to `main` around Nov 16, 15:00 IST; its cutoff for chapter 3's prerequisites is **Nov 16, 18:00 IST**. Lane C rebases onto `main` once it's in. Anything missing at the cutoff uses the fallback below, and lane C tells the sprint master that day. Fallbacks marked *(table)* are the ones the dependency table or story name; the rest are lane C's proposals, all data-only.

| Needed for | From lane B | If it misses the cutoff |
|---|---|---|
| Loading chapter 3 at all | E1: `chapters` in the manifest, `loadChapter(3)`, `?chapter=3` | *(table)* `?chapter=n` on a review build through today's code path. Without either, nothing of chapter 3 can be walked in the emulator: lane C asks the sprint master the same day |
| Thimble's line, the beacon | E4: carry slots with `has` | Defaults only (`thimble-snow`, `beacon-moth`). **The visible consequence is lost**, reported |
| Wick leaving by the stair | E8: exit mark `stair` | Wick walks to `edge-step` and stays there, half-seen in the dark as the frost comes. The lines don't change; the picture is weaker. Reported |
| Pip's logbook coming home | E7: `use` from the room | The hunt's own return brings the logbook back to the page at 28 s; `log-return` drops the `use` and keeps `take` |
| The hunt itself | Built; its headset walk is owed | *(story)* `room hunt` becomes `place object:logbook at pip-step` + `cue beam`: the logbook glints on the page, and you pick it up there. Nothing else changes |
| The beacon | E5: `light-up`, `light-down` | Pip holds his lantern high (`raise`) with `cue beam`, and the narrator carries "up went the little light". Kite and ladder picks drop to the default. Reported |
| The borrowed kite or ladder | E9: `place` from the satchel | The kite and ladder picks drop to `beacon-moth` (E5 still lands). Reported |
| Wick's crossings | E6: `wick-rope`, `wick-ladder`, `wick-kite` | Chapter 1's `cross-*` cues are Pip's, so no data fallback moves Wick across: lane C asks lane B to finish them before anything else. If they can't land, the sprint master decides |
| Handing the logbook over | E8: Wick's linked logbook part | No clean data fallback: Wick's rig always draws its logbook part, so he'd stand at the gap holding a logbook while Pip says "You dropped this." Lane C asks lane B to land it with E6, first. If it can't, the sprint master decides between a Wick rig without the part for this chapter (lane B's rig data) and cutting the handover's two `give` actions and Pip's "You dropped this" line |
| Marks, the landing, Thimble, `logbook` | E10, runs 017 and 018 | Thimble: *(table)* a non-speaking page character; her lines go to Pip and the narrator, in lane B's rewrite of the draft. The landing: spread 2 on a snowy shore path (`shore-path-snow`, lane C's own set file, with its own marks under the landing's names) |
| The end card | E3: the canon `page` line | The page lines wait; the end card shows what E3 can compose |
| The contents page | E2: `CHAPTERS` row and `where` | See ask 3 |
| Re-timing | `tools/chapter-timings.ts` (landed) | — |

**Three small asks of lane B,** none of them a new engine feature, each needed only for the reason given:

1. **Load only the chapter's sets.** Today `paint/assets.ts` loads the art of every set in the manifest. With the landing and three snowy sets, chapter 1 would load chapter 3's snow too: more load time and texture memory on the Quest for nothing. A filter to the sets the chapter's scenes name (or E1's per-chapter data doing the same). Without it, lane C keeps the snowy sets lean (only changed pieces, unchanged ones by reference) and measures load and fps per spread.
2. **A cue that names its own sound.** Chapter 2's new sounds (run 019's splash and nib) need a way to play a new sound from a cue; today only cue *kinds* have sounds. If that lands as "a cue entry may name its sound", chapter 3 uses it for run 022's three sounds. If not, run 022 isn't spent and chapter 3 plays on existing foley.
3. **A review seed for carry.** A way to start chapter 3 with chosen chapter 2 facts and satchel (for example `?carry=landing:thread,light-high:kite&satchel=kite` on review builds), so every pick can be walked in the emulator without playing chapter 2 first. Without it, lane C seeds the series log in the emulator's browser before load.

## Art: run 020, snowy pages

**Why:** chapter 3 reuses all three of its sets. "Each spread a new place" is what playtests asked for; snow is what makes them new.

**How (free first):** `art/runs/020-snowy-pages/make_snow.py` (numpy and Pillow, like `cutout.py`), from each piece's own paint and run 014's `snow-cover.png`:

- **Keep every piece's alpha exactly** (run 007's lit-window lesson), so outlines, hinges, anchors and marks can't move.
- **Snow lies on top:** on standing layers, a cap along each upward-facing edge, derived from the alpha, with a soft uneven lower edge and a pale blue-grey shadow under it, filled from the painted snow texture. The gap's dune tops and the landing's steps and rock tops get caps; the grass tufts a dusting.
- **Sand becomes snow:** on the gap's pale sand, keep lightness and strokes and move the colour toward the snow's cream-white with blue-grey hollows. Cliff faces, rocks' sides and water keep their paint. No snow on the sea.
- **The gallery floor:** snow drifted against the rim and the foot of the lamp room, flagstones showing through a thin dusting in the middle.
- **The lamp's glass:** a rime of frost feathering in from the panes' edges on `lamp-room.png`, so `lamp-out` reads as "the glass is frosting over" and the hand moment reads as wiping it. `lamp-lit.png` (swapped over the lamp room when lit) gets the same cap on the dome and only a faint rime at the very edges, so the wipe shows. The morning's `lamp-out` shows the edge rime, which is true of a winter morning.
- **Unchanged pieces** (the lamp's sky, the shore's night sky and headland) are referenced from their sets, not copied.
- The landing's pieces go through the same recipe once lane B's run 018 has finished them.

**Decide by:** each snowy spread in the emulator (`?chapter=3`, `?jump=<beat>`) beside its unsnowy self, against the look bar: it reads as the same painted page under snow, not a filter; nothing moved (marks and crossings land where they did); fps holds. The owner judges in the headset at the end.

**Paid, only for a piece the free pass fails:** that piece repainted once at 2K from its own image (downscaled under 5 MB as Figure 1), "the same piece exactly, now under fresh snow", standing pieces on magenta and cut with run 006's recipe. Then **keep the original's alpha** and take only the repaint's snow inside it (with a few pixels of cap above the top edge), so a repaint that drifts can't move anything. Candidates, in the order they're most likely to need it: the gap's ground, the landing's ground, the lamp's ground, the gap's near rim, the gap's far rim.

| Run 020 | Estimate | Cap |
|---|---|---|
| Free pass, every piece | 0 | 0 |
| 2K repaints, 9 credits each (three expected, the grounds) | 27 | 45 (all five) |

Each paid job runs only after the free pass is judged, names the piece and why, and is reconciled against its known price (9) in **lane B's per-job cost ledger** once it lands in `art/tools/generate.mjs`; until it does, lane C runs one job per invocation and reconciles each against its price, never from the shared balance (runs 004, 015). The plan is `art/runs/020-snowy-pages/plan.json`; the five candidates are written there as `candidateJobs`, and a candidate moves into `jobs` only once its free version has failed.

## Voices: run 021

**The deduplicated line ledger** (every distinct line in the draft and its bridges by contract line id, against the manifest's voiced lines and chapter 2's draft; full list in the appendix):

| | Lines |
|---|---|
| Distinct lines | 78 |
| Already voiced (chapter 1's two closing lines) | 2 |
| Shared with chapter 2 | 0 |
| **To voice** | **76**: narrator 18 (3 of them bridges), Pip 31, Wick 18, Thimble 9 |
| Played in more than one beat, voiced once | 4: "Wick's logbook! He never goes anywhere without it." (2 beats), "And up went the little light, high above the snow." (3), "Hold still, Wick. And catch!" (2), "Hmph. Now where did you learn that?" (2) |
| Over 200 characters | 0, so each is exactly 1 credit (run 005) |

This matches Codex's count of 76.

**How:** `art/runs/021-chapter-3-voices/build_plan.mjs` (run 012's, extended to the bridges) writes the voice jobs from the final `client/public/show/episode-3.json` once its lines freeze, skipping every line already in `manifest.voiceLines` (including any chapter 2 voices first). Presets: narrator Wanda, Pip Mabel, Wick Arjun (run 005), Thimble from `art/cast/thimble/voice.json` (lane B's run 017/019; chapter 3's voice run waits for it). Run through `art/tools/generate-sound.mjs` (it caps from each task's reported cost), finished with run 010's `finish.mjs` into `art/sound/ch3/`, then `voiceLines` added and every path re-timed from the rendered voices.

| Run 021 | Estimate | Cap |
|---|---|---|
| 76 lines at 1 credit | 76 | 84 (8 retakes after the owner listens on the Quest) |

**If a trim is needed** (real voices run long, or the cap): first the three bridges (3 lines, only heard when a reader is slow), then lane C's time trims, each reported to lane B (the story's owner): `the-edge`'s narrator line (Wick's own lines carry it), `across`'s "Forty years of lost things coming home, all in here.", `too-long`'s "He's been gone too long. Much too long."

## Sound: run 022

Only if lane B's sound-cue mechanism lands (ask 2). Three short sounds, from the story's list, each played from a cue chapter 3 already has a beat for:

| Sound | Seconds | Where |
|---|---|---|
| `snow-steps`: small soft footsteps crunching in fresh snow | 3 | `the-snow` (Pip walks to `pip-step`) and `morning` (home up the steps) |
| `frost-tinkle`: a faint crystalline creak of glass frosting over | 2 | `errand`, with the frost's `lamp-out` |
| `chair-creak`: an old armchair settling under someone sleepy | 2 | `morning`, on "fell asleep in his comfy chair" |

| Run 022 | Estimate | Cap |
|---|---|---|
| 7 seconds at 1 credit a second, finished like run 010 (quiet foley needs up to +19 dB) | 7 | 9 |

## Money

| Run | Estimate | Cap |
|---|---|---|
| 020 snowy pages | 27 | 45 |
| 021 chapter 3 voices | 76 | 84 |
| 022 chapter 3 sound | 7 | 9 |
| **Lane C** | **110** | **138 of 150** |

Nothing is spent before the sprint master approves each run. 12 credits stay unallocated.

## Checks

- **`pnpm check`** (typecheck, tests, bundle) green on every push.
- **`client/src/show/chapter-3.test.ts`:** `episode-3.json` parses and passes `checkSpine` against the real manifest; every carry pick and default resolves to a beat; every problem has a fallback and an ignored path, and the zero-input path reaches `chapter-end`; the only room effects are the story's nine, and nothing touches the ceiling before `the-sky`; each snowy set's marks, anchors and hinges equal its base set's; once run 021 lands, every line is in `voiceLines` and every voice file exists.
- **The simulator, four readers, every carry pick:** `node tools/chapter-timings.ts client/public/show/episode-3.json --carry client/public/show/episode-3.carry.json` (the `--cues` and `--objects` overrides drop away once E10 lands). Every path inside 5–7 minutes; first turn by about 1:40; no quiet over 8 s; no repeated line. On the drafts today:

| Chapter 3 (drafts, real scheduler, unvoiced lines at 1.3×) | Quick | Zero input | Late wrong gift | Holding |
|---|---|---|---|---|
| Default | turn 1:36, end 5:18 | 1:58, 6:29 | 2:15, 6:55 | 2:10, 6:49 |
| Thimble's carry line (each of three) | 1:37–1:38, 5:20 | 1:59–2:00, 6:30–6:31 | 2:16–2:17, 6:47–6:56 | 2:11–2:12, 6:50–6:51 |
| The beacon with the kite or the ladder | 1:36, 5:19 | 1:58, 6:29 | 2:15, 6:55 | 2:10, 6:49 |

  The late-wrong path sits at the scheduler's 7:00 time-box (it shortens waits to finish by 7:00). That's the margin to watch once real voices are in; the trims above are the answer if it goes over.
- **`TT_EPISODE=show/episode-3.json node tools/director-sim.ts`** green.
- **The emulator walk** (IWSDK skills; `?chapter=3`, `?jump=<beat>`, `?speed=4`, the carry seed): each snowy spread against its unsnowy self; the frost with the sock, with a wrong gift, ignored; the hunt in the living room and the painted room (walk and pinch, look and pinch, ignored); every beacon (Moth, kite, ladder); every crossing (rope, ladder, kite, wrong gift, Wick's own rope); the handover with the linked part; the sky in full; the morning (the lamp lit on the far lighthouse until Pip puts it out); the end card's page lines; pause and resume in each spread; Read it again. Screenshots and telemetry fps per spread in lane C's section of `docs/playtest-notes.md`.
- **The headset (the owner, before merge):** chapter 2 then chapter 3, continuing from the end page; the snow by minute 1; the hunt walked (owed since Nov 15); the stars at the peak; the snowy pages against the look bar; the voices by ear. Sign-off before merge.

## Order of work

| When (IST) | Lane C |
|---|---|
| Nov 16, after approval | `episode-3.json`, `.canon.json`, `.carry.json` from the drafts; `chapter-3.test.ts`; timings on the current manifest with the overrides. Run 020's free pass on the lamp and the gap; emulator screenshots of the snowy sets through chapter 1's review path. Run 021's `build_plan.mjs` (dry run) |
| Nov 16, from 15:00 | Rebase onto `main` with lane B's engine. Chapter 3's manifest entry; run it with `?chapter=3`. The landing's snow once run 018 is in. Any paid repaints, each approved |
| Nov 16, evening | Lines freeze (with any trims); run 021 once Thimble's voice is chosen; re-time from the voices. Run 022 if ask 2 landed |
| Nov 17 | The emulator walk, every branch; the owner in the headset; fixes; PR at stage 3's end. Feature freeze at the end of Nov 17 |

## Asks for the sprint master

1. **Approve this plan, and runs 020–022:** estimate 110, caps 138 of lane C's 150.
2. **Approve the new reader-facing text:** the eight canon `page` lines and the three `where` lines above. No new spoken lines.
3. **Chapter 3's `CHAPTERS` row** in `show/progress.ts`: the story's handoff gives it to lane C ("one line, which lane B leaves ready"), but this lane's brief says not to edit `progress.ts`. Either lane B adds the row (or reads it from the manifest's chapter list), or lane C makes that one-line edit with your say-so.
4. **Lane B's three small asks** (load only the chapter's sets; a cue that names its sound; a carry seed for review), passed on if you agree.

## Appendix: the line ledger

From `docs/plans/finish-chapters/episode-3.draft.json` and its bridges, by contract line id (`lineIdOf`), against `client/public/show/manifest.json` and `episode-2.draft.json`. Re-run when the lines freeze; run 021's jobs are written from the frozen file, not from this list.

| # | Speaker | Line | Beats | Chars | Status |
|---|---|---|---|---|---|
| 1 | narrator | On the longest night of the year, the snow came all the way to the edge of the table. | opening | 85 | **to voice** |
| 2 | pip | Snow! It's snowing on the Reader too! Look! | opening | 43 | **to voice** |
| 3 | thimble | I've never seen snow from dry land before! | thimble-snow | 42 | **to voice** |
| 4 | thimble | I've wound Grandmother's thread back on its spool. Every inch of it. | carry-thread | 68 | **to voice** |
| 5 | thimble | The last time I was this cold, somebody threw me a rope. | carry-rope | 56 | **to voice** |
| 6 | thimble | The last time I was this cold, I crossed a ladder to get home. | carry-ladder | 62 | **to voice** |
| 7 | wick | Longest night of the year. I'll fetch the oil up from the store, same as every night. | errand | 85 | **to voice** |
| 8 | pip | I'll go! You can't see the steps in the... | errand | 42 | **to voice** |
| 9 | wick | Forty winters I've walked those steps, lad. I don't need eyes for them. | errand | 71 | **to voice** |
| 10 | narrator | And down he went, one paw on the wall, counting every step. | errand | 59 | **to voice** |
| 11 | pip | The glass is frosting over! The light can't get out! | errand | 52 | **to voice** |
| 12 | thimble | And Wick will need it to find his way back! | errand | 43 | **to voice** |
| 13 | pip | Have you got anything to wipe it clear? | frost-ask | 39 | **to voice** |
| 14 | pip | That's it! Rub, rub, rub... | frost-wipe | 27 | **to voice** |
| 15 | pip | There! Shine all the way down the steps! | frost-wipe | 40 | **to voice** |
| 16 | pip | Thank you! But that won't wipe the frost. | frost-puzzled | 41 | **to voice** |
| 17 | pip | Something soft, maybe? Something warm? | frost-puzzled | 38 | **to voice** |
| 18 | narrator | Thimble had polished a great many thimbles in her time. She knew exactly what to do. | frost-thimble | 84 | **to voice** |
| 19 | thimble | A bit of elbow grease, and... there! | frost-thimble | 36 | **to voice** |
| 20 | narrator | The lamp shone. The snow fell. And the old keeper didn't come back. | too-long | 67 | **to voice** |
| 21 | pip | He's been gone too long. Much too long. | too-long | 39 | **to voice** |
| 22 | thimble | Go and find him, Pip. I'll keep the light till you're back. | too-long | 59 | **to voice** |
| 23 | pip | But a keeper never leaves the light. | too-long | 36 | **to voice** |
| 24 | thimble | Then I'll be the keeper for a bit. I know what this light means to someone lost. | too-long | 80 | **to voice** |
| 25 | pip | Will you come with me? Into the snow? | too-long | 37 | **to voice** |
| 26 | narrator | So down went the little fox, a hundred and twelve steps, into the longest night. | too-long | 80 | **to voice** |
| 27 | narrator | At the bottom of the steps, the snow had covered everything. The path, the rocks, and every footprint. | the-snow | 102 | **to voice** |
| 28 | pip | Wick? Wick! Where are you? | the-snow | 26 | **to voice** |
| 29 | pip | His footprints just stop. The snow's filled them in. | the-snow | 52 | **to voice** |
| 30 | narrator | Then something glinted. Not on the page, but out in the Reader's room. | the-snow | 70 | **to voice** |
| 31 | pip | There! Can you bring it to me? | glint-ask | 30 | **to voice** |
| 32 | pip | Wick's logbook! He never goes anywhere without it. | log-found, log-return | 50 | **to voice** |
| 33 | pip | Thank you. But it's the shiny thing I need, the one the light found. | glint-puzzled | 68 | **to voice** |
| 34 | narrator | And the light, being a lighthouse light, brought it the rest of the way home. | log-return | 77 | **to voice** |
| 35 | pip | He's lost. Wick's lost, out in the snow. | lost | 40 | **to voice** |
| 36 | pip | Every lost thing follows the light home. But how can he follow it, if he can't see it? | lost | 86 | **to voice** |
| 37 | pip | Then the light will just have to be bigger than the dark. Moth? | beacon-moth | 63 | **to voice** |
| 38 | narrator | And up went the little light, high above the snow. | beacon-moth, beacon-kite, beacon-ladder | 50 | **to voice** |
| 39 | pip | The kite from the night Thimble came! Can I borrow it again? | beacon-kite | 60 | **to voice** |
| 40 | pip | The ladder from the night Thimble came! Can I borrow it again? | beacon-ladder | 62 | **to voice** |
| 41 | pip | Wick! Wick! Follow the light! | calling | 29 | **to voice** |
| 42 | wick | Pip? Is that your light, lad? Brightest little light I ever saw. | the-edge | 64 | **to voice** |
| 43 | narrator | The old keeper stood at the edge of the gap, with the snow coming down, and no way to tell where the ground stopped. | the-edge | 116 | **to voice** |
| 44 | wick | Forty winters on this shore, and tonight I can't find my own way home. | the-edge | 70 | **to voice** |
| 45 | pip | I got over this gap once, with help. Can you help me get him across? | wick-ask | 68 | **to voice** |
| 46 | pip | Hold still, Wick. And catch! | wick-rope, wick-rope-self | 28 | **to voice** |
| 47 | wick | Hmph. Now where did you learn that? | wick-rope, wick-rope-self | 35 | **to voice** |
| 48 | pip | One rung at a time, Wick. I've got you. | wick-ladder | 39 | **to voice** |
| 49 | wick | Don't look down, eh? Easy for some. | wick-ladder | 35 | **to voice** |
| 50 | wick | A kite? At my age? | wick-kite | 18 | **to voice** |
| 51 | wick | Oh. Oh my. Hmph. Rather nice, actually. | wick-kite | 39 | **to voice** |
| 52 | pip | I don't think that'll get him over. | wick-puzzled | 35 | **to voice** |
| 53 | pip | Something long, maybe? Something to hold on to? | wick-puzzled | 47 | **to voice** |
| 54 | narrator | Then Pip saw it. Wick's own rope, right where he'd left it, the night the light went out. | wick-rope-self | 89 | **to voice** |
| 55 | wick | Hmph. Not bad, keeper. Not bad at all. | across | 38 | **to voice** |
| 56 | pip | You dropped this. The light found it, all the way out in the Reader's room. | across | 75 | **to voice** |
| 57 | wick | Forty years of lost things coming home, all in here. | across | 52 | **to voice** |
| 58 | wick | You brought us all home tonight, lad. Time you kept the lamp. | across | 61 | **to voice** |
| 59 | wick | The lamp, and the log, and all of it. They're yours, keeper. | across | 60 | **to voice** |
| 60 | pip | Mine? But who'll grumble at me? | across | 31 | **to voice** |
| 61 | wick | I'll grumble from my comfy chair. Loudly. | across | 41 | **to voice** |
| 62 | narrator | And just then, the snow stopped, the clouds opened, and the whole sky came out. | the-sky | 79 | **to voice** |
| 63 | wick | I don't need eyes for the stars, lad. I know them all by heart. | the-sky | 63 | **to voice** |
| 64 | wick | There's the Lantern. Every keeper's first star. | the-sky | 47 | **to voice** |
| 65 | wick | And the Kite, with her long tail. | the-sky | 33 | **to voice** |
| 66 | pip | And that one? It looks like a fox. | the-sky | 34 | **to voice** |
| 67 | wick | Don't know that one. Must be new. | the-sky | 33 | **to voice** |
| 68 | wick | They say every keeper gets a star. Looks like that one's yours. | the-sky | 63 | **to voice** |
| 69 | pip | A shooting star! Quick, make a wish! | the-sky | 36 | **to voice** |
| 70 | narrator | They climbed the hundred and twelve steps together. And the old keeper didn't count them once. | morning | 94 | **to voice** |
| 71 | thimble | Welcome home, keepers. I kept her shining, every minute. | morning | 56 | **to voice** |
| 72 | narrator | And when the stars had faded, and the morning came over the edge of the table... | morning | 80 | **to voice** |
| 73 | narrator | ...the new keeper put out the lamp himself, for the very first time. And the old keeper fell asleep in his comfy chair. | morning | 119 | **to voice** |
| — | narrator | And whatever the Reader gave that night, the book kept safe, for another time. | chapter-end | 78 | voiced (ch 1) |
| — | narrator | Because lost things, as you'll find, have a way of coming back. | chapter-end | 63 | voiced (ch 1) |
| 74 | narrator | The snow fell, soft as a held breath. | bridge-snow | 37 | **to voice** |
| 75 | narrator | Up at the top, a small mouse kept the great lamp turning. | bridge-mouse | 57 | **to voice** |
| 76 | narrator | Somewhere out in the white, an old badger counted his steps. | bridge-counting | 60 | **to voice** |
