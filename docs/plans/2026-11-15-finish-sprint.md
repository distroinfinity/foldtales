# The finish sprint: from hackathon build to a finished product

**Owner's call, Nov 15:** take Foldtales from "an unorganised hackathon build" to a finished, user-ready product, and submit that. Deadline **Nov 18, 2026**. Five lanes run in parallel, each in its own Superset workspace and branch. The `main` checkout is the **sprint master**: it starts the lanes, runs the Codex reviews, approves stories and plans, merges the PRs and keeps `docs/sprint-plan.md` current.

## Decisions (owner, Nov 15)

- **The bar:** a finished product, not a demo. Every surface, flow and journey thought through (Beat Saber as the bar for structure, `docs/sprint-plan.md` ticket 7's inventory).
- **Chapters 2 and 3** are written now, by Claude, as **one continuing story** with chapter 1 in *Tales from the Table's Edge*. Judges won't play all three; they show depth. Later chapters show as "More chapters on the way."
- **The AI Storyteller is nailed:** its positioning and presentation, the experience itself, and serving it as a finished product. **It needs sign-in.** The owner does the account setup today, guided by the AI lane.
- **Who does what:** Claude builds in every lane. **Codex reviews each stage once** (story, plan, code). The **sprint master approves** stories and plans after that review. **The owner tests in each lane's workspace** and signs off in the headset before merge.
- **Credits:** up to **400 Runway credits** across the sprint. Every run still has a written plan with its estimate (`art/README.md`), and the sprint master approves it. Budget: chapters lanes 150 each, AI 40, overhaul 30, ship 30.
- **Cut from v1:** Story Circle (M5), moved to `docs/v2-ideas.md`. Music and Talk in the written chapters stay in scope.

## Timeline

| When | What |
|---|---|
| Nov 15, tonight | Lanes start. Overhaul: walk-through and structure. Chapters: the story. AI: sign-in checklist to the owner, then its plan. Ship: plan. |
| Nov 16 | Stories and plans reviewed by Codex and approved. Build. The overhaul's structure seams land first, so the other lanes build into them. |
| Nov 17 | Build and headset sessions. **Feature freeze at the end of Nov 17.** Only fixes after that. |
| Nov 18 | Final pass on the live link, the video from real Quest recordings, the form, submit. |

## The lanes

| Lane | Branch | Owns | Doesn't touch |
|---|---|---|---|
| **A. Product overhaul** | `finish-product-overhaul` | Every surface and journey: the page in all its states, home and choosing a mode, the library shelf and contents, your collection, one set of controls inside the book (replacing the ribbon, sage tab and wrist tag), endings, settings, the first time, leaving and coming back, failure states. `client/src/landing/`, `client/src/stage/controls.ts`, the wrist tag, the end page's layout | Chapter data, the Storyteller's turn logic, the backend's auth |
| **B. Chapter 2 and the engine** | `finish-chapter-2` | The arc for chapters 2 and 3 (both stories, one writer). The engine for several chapters: the manifest's chapter list, loading a chapter by number, a saved place per chapter, `CHAPTERS` in `client/src/show/progress.ts`, the satchel carrying into later chapters, "Continue to chapter 2". Then chapter 2's data, art, voices and sound | The landing's layout (lane A presents what `libraryState()` returns) |
| **C. Chapter 3** | `finish-chapter-3` | Starts once lane B's story is approved. Chapter 3's data, art, voices and sound, on lane B's engine | The engine (asks lane B) |
| **D. The AI Storyteller** | `finish-ai-storyteller` | Positioning and copy (with the PRD), the experience inside a Storyteller story, its start, continue and past stories, its ending, cost and caps, slow or failed AI, moderation. Sign-in on end to end: the owner's setup checklist, `TT_ACCOUNTS`, Google in Quest Browser, the phone code. Talk in the written chapters, if it earns its place | The page's layout and the in-book controls (asks lane A for a slot) |
| **E. Ship and submission** | `finish-ship` | Offline cache and PWA, cold start, ≥60 fps per scene and effect, the must-pass list (`docs/hackathon.md`), the Cloudflare build-time risk, accessibility (captions, one-handed), the VR Glasses view, music (one quiet licensed bed, if it fits), licenses and credits including Runway's terms, privacy text, the form copy, the video's shot list. The exact deadline and time zone from Devpost | Features |

### Seams, so the lanes don't collide

- **Chapters to the page:** `libraryState()` in `client/src/show/progress.ts` is the agreed seam. Lane B fills it with real chapters, and lane A presents them. Its shape changes only by agreement through the sprint master.
- **The Storyteller to the page and the book:** lane A gives the Storyteller its door and its place in the one set of controls. Lane D fills them.
- **Controls:** lane A's controls model is the one way in for pause, start again, leave, switch mode, contents and satchel. Lanes B and D call it and don't add their own.
- **Contracts:** a change is its own small PR, sent to the sprint master first.
- **Shared docs:** lanes don't edit `docs/sprint-plan.md`; the sprint master does. Each lane tracks its progress in its own plan file, and adds its own dated section to `docs/playtest-notes.md`.
- **Art run numbers:** lane B 017–019, lane C 020–022, lane D 023–024, lane A 025–026, lane E 027.

## How a lane runs

1. Read `AGENTS.md`, `docs/prd.md`, `docs/technical-design.md`, `docs/design-language.md`, `docs/sprint-plan.md` (ticket 7's inventory) and this file.
2. **Stage 1, story or structure:** write it to the lane's plan file, `docs/plans/2026-11-15-<lane>.md`. Stop and report.
3. The sprint master runs **one Codex review** and approves, with changes.
4. **Stage 2, plan:** tasks, files, checks, art runs with estimates. Stop and report. Codex reviews, the sprint master approves.
5. **Stage 3, build:** the thinnest playable version first, then deepen. `pnpm check` and `pnpm test` green. Mac proofs for flat pages; emulator checks for XR. Commit on the lane's branch, push, and open a PR when it's ready to review.
6. Codex reviews the PR once. The lane fixes.
7. **First-round user testing is the lane's own** (owner, Nov 16). In the emulated headset with emulated hands, the lane plays its work as a first-time reader, end to end, then the edge paths: doing nothing, pausing, leaving and coming back, a reload, and its failure cases. It monitors the console, fps, timings and the look bar, fixes everything it finds, and re-runs until clean. Only then does it report **HEADSET GREEN**, with at most eight headset steps for the owner.
8. **The owner tests in the headset once per lane, after green,** for feel, look and sound, not to find bugs, and signs off. The sprint master merges.

Never ship test visuals, never put keys in the client, and never import from `spikes/`.
