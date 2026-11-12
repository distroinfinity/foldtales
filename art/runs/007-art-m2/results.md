# Run 007 results

**Question:** can run 004 and 006's recipe paint what M2 still needs and doesn't have: a gap the ladder really spans, the drawer that slides out, a satchel for keeping, and Wick's rope? **Yes, with free fixes.** Every piece is cut out, checked and named. The painter made the chasm half as wide as asked, so the ground and rims were widened locally rather than repainted.

## What we made

| Piece | Where | Size |
|---|---|---|
| The gap set: ground, far rim, near rim, with shore-path's sky and headland | `art/sets/the-gap/` | Chasm 101 mm at Pip's depth (−50 to +51 mm) |
| Lit lamp, free from the headland's own glass | `art/fx/lamp-lit.png` | 32 × 22 mm, same outline |
| Rope and thread strung across the gap | `art/fx/rope-span.png`, `thread-span.png` | 130 mm, 5.6 and 2.6 mm thick |
| Drawer tray, front and side | `art/book/drawer/` | 190 × 125, 190 × 26, 125 × 22.7 mm |
| Satchel back, pocket, pocket flap | `art/satchel/` | Back 112 × 112 mm |
| Wick's rope | `art/objects/rope-coil/` | 69 mm, `rope` and `ties` |

Every piece meant to be handled is at Pip's density (905 px per 170 mm), so the stage can draw it with the cast at one scale. The set layers are at run 004's set density.

**Data:**
- `sets/the-gap/set.json`: shore-path's shape plus `id`, `name`, `description`, `gapM` and six marks.
- `book/drawer/drawer.json`: parts, how it attaches, `travelM`, and the five slots with the stow rules.
- `satchel/satchel.json`.
- `objects/rope-coil/object.json`.

`tests/art-m2.test.ts` checks all of it:
- the set's four library fields parse as `SetDef`
- files exist at their stated sizes
- the ladder's painted span rests at least 10 mm on each rim, and the sock is shorter than the gap
- the drawer's slots are the five presets and the stow fits
- the rope parses as `ObjectDef`

## What it cost

| Invocation | Jobs | List | Logged | Balance | Unexplained |
|---|---|---|---|---|---|
| A | `gap-key` (1K) | 5 | 5 | 112029 → 112024 | 0 |
| B | `layer-3-far-rim`, `layer-4-near-rim`, `ground`, `drawer-sheet`, `satchel-sheet` (2K) | 45 | 45 | 112024 → 111979 | 0 |

**50 credits ($0.50) at list price, against a plan of 50 and a cap of 100.** No repaints. Before each invocation the balance held for a minute and no art tool was running. Each reconciles exactly with `budget.attempted_cost` and the balance.

## What changed after painting

All free, and all checked by `make_m2.py`:

1. **The chasm came out 50 mm wide, against 92–128.** Asked for "exactly one quarter of the width", the painter gave about one eighth, and the rims left about 33 mm. That's a step for Pip, not a gap. A repaint (27 credits) carried the same risk.
   - **The ground's columns are remapped** the same way for every row. The water widens 2.5×, the rock walls 1.2×, and the plain sand on each side narrows to 0.84×. It now measures 101 mm.
   - **Each bluff is squeezed across,** holding its outer end (0.76 to 0.80), so its lip lands 4 mm behind the printed chasm at its own hinge depth.
   - Limits are in `m2_check`: sand at least 0.8×, water at most 3×, squeeze at least 0.75.
2. **The near rim's height limit** was 100 mm, and its outer reeds are 101 mm. The real limits are the fold (115 mm) and Pip's legs and paw showing. The check now measures the rim across his legs and paw: 30 mm, against a 45 mm limit. His tail passes behind the reeds, as on shore-path.
3. **Pip's mark is 25 mm past the rim, not 35,** so his paw stays clear of the right reed clump's height. He stands right where the path ends.
4. **The satchel came out smaller than planned, with a narrower pocket.** All three parts keep the sheet's one scale, set so the back is 110 mm. Nothing is upscaled. The flap turned out to be the pocket's flap, so it hinges on the pocket.
5. **The side rail came out 9.5:1 against 4.8:1.** Its painted height is kept, never upscaled, and it's squeezed only along the grain to 125 mm (0.58×). It stands 22.7 mm against the front's 26, as drawer fronts do.
6. **Rope coil: 69 mm, not 70,** because its painting was 1 px short of 70 mm.
7. **Drawer stow:** each object lies flat *behind* its standing plane and tips up about its front edge. That's the way the set's cards stand, and how the proof page draws them. The slots moved to suit.
8. **Shadow on these sheets is darker:** around (64, 11, 13), with purple-pink fringe pixels. Run 006's shadow test misses both. `m2_check.raw_for_preservation` treats them as paper, and ignores specks under 3 px, before run 006's preservation check.

## Answers

- **The gap reads.** Sky and headland are reused, so the lighthouse, its lamp anchor and the beam's origin are the same on both sets.
- **The ladder rests 23–24 mm on each rim.** The sock (90 mm) can't reach across the 101 mm gap.
- **The free lit lamp works.** The glass turns gold and keeps its painted strokes, and its alpha matches the headland's exactly.
- **No new cast art was needed.** Wick hides his logbook and holds the rope at his paw. Pip holds the spool and kite at his lantern grip.
- **The stow is physical.** Checked at 5° steps: nothing goes through a wall or the felt, each object has its own plane, and the interior clears the book's edge at full travel.

## Still unproven

Everything has been seen only on the Mac, in a flat CSS page. Nothing renders these in IWSDK yet. See the Quest list below.

- The widened chasm and squeezed bluffs at book distance in real light. On the Mac they read as painted.
- The 2.6 mm thread is faint over the dark water. It may need the stage to thicken it, or a brighter tint.
- The drawer stow is data and a CSS sketch. The client will tune timing and feel.

## Reuse

Everything named in "What we made" is product art. `make_m2.py` rebuilds all of it from this folder, and exits non-zero on any problem. `gap-key.png` is the master reference for the gap. `plan.json`'s prompts are the recipe for later sets, with the learnings in `art/README.md`.

## Review

Codex reviewed the plan read-only before any credits were spent, over three rounds: 4 P1 and 3 P2, then 1 P1 and 2 P2, then 2 P2. All were fixed, and the record is in `docs/plans/2026-11-11-art-m2.md`.

## Approval

Approved on the Mac by the owner on Nov 11, 2026, in `art/m2-proof.html`, including the free widening of the chasm. That approval is provisional. Final approval happens in the headset.

**Quest Browser, Nov 12, 2026.** The owner opened the proof in Quest Browser on the Quest 3, over USB (`adb reverse` on `CLIENT_PORT`). Every file loaded, the browser logged no errors, and it looks good so far. It is still a flat page, so it adds nothing beyond the Mac approval. **From now on the headset is used only for XR experiences** (`AGENTS.md`), so the checks below wait for tickets 1 and 2 to render these pieces in IWSDK.

## Quest test

**Superseded: don't run this flat-page check in the headset.** It is kept for the record. Serve `art/` on the Mac (`python3 -m http.server <CLIENT_PORT> --bind 0.0.0.0 -d art` from the repo root, with `CLIENT_PORT` from `.env.ports`). Open `http://<Mac's LAN IP>:<CLIENT_PORT>/m2-proof.html`.

1. **The gap reads as where the path ends,** from where you sit, within 2 seconds. The widened water and squeezed bluffs don't look stretched.
2. **Ladder:** it looks like it really spans the gap. The sock looks hopeless.
3. **Lamp:** with Light the lamp on, the lit glass reads as lit at book distance, before you notice the beam.
4. **Thread:** can you see the spool's thread across the water? If not, it needs to be thicker.
5. **Drawer:** the objects tip up and stand clearly, and Night keeps them distinct on the green felt.

**In the headset, once tickets 1 and 2 render these in IWSDK** (the real test). Items 1 to 5 above, on the immersive stage, plus the drawer's reach on a real table, grabbing from it, the satchel flap and an object going in, Wick's rope throw, and the beam in your real room.
