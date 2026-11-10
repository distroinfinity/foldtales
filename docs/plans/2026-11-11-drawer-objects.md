# Drawer objects for M2 (run 006)

**Ticket:** art-drawer-objects. **Run:** `art/runs/006-drawer-objects/`. **Status:** plan, waiting on review and the owner's approval of credits.

M2 needs a drawer you can open at the gap and hand Pip anything from. The gap accepts `flies`, `climbs`, `spans` and `rope` (`docs/technical-design.md`, Objects). Anything else gets a funny failure, and Pip keeps it. This run paints the drawer's presets for episode 1.

## What we paint, and why

The smallest set that covers every accepted tag is three objects, the three the PRD names. Two failures give the director, and the demo's "hand Pip something odd" beat, a choice of joke. All five are lost household things, because the drawer is the Lost and Found. At Pip's scale (170 mm tall) they're as big as they would be to a mouse, the same joke as run 004's boulder-sized button and spoon.

| id | Name | Tags | At the gap | Height | Held at (pivot) |
|---|---|---|---|---|---|
| `kite` | patched paper kite | `flies`, `catches-wind`, `lightweight`, `fragile` | Lifts Pip over | 0.12 m, tail included | Where the spars cross |
| `spool` | spool of thread | `rope`, `ties`, `rolls`, `lightweight` | Thrown across and hauled on | 0.07 m | Center |
| `ladder` | little wooden ladder | `climbs`, `spans` | Laid across as a bridge | 0.15 m | Middle of a rail |
| `odd-sock` | odd sock | `soft`, `warm`, `lightweight` | **Fails.** Far too short to dangle across. Pip wears it as a scarf against the dark | 0.09 m | Cuff |
| `brass-key` | old brass key | `opens`, `shiny`, `heavy` | **Fails.** Pip tries to unlock the gap. Moth zips in at the shine | 0.075 m | The bow (ring) |

- **Coverage:** `flies` (kite), `rope` (spool), `climbs` and `spans` (ladder). The ladder carries two accepted tags. That's honest, and harmless: `pickProblemRule` takes the first rule that matches, so the gap's author decides which branch the ladder plays. If the owner wants a separate `spans` object, a wooden ruler is the obvious fourth, on the same sheet for no extra credits.
- **Failure tags were checked against the gap.** Neither failure carries `flies`, `climbs`, `spans` or `rope`. The sock is deliberately not `rope`. `lightweight` replaces the old `light`.
- **Colour:** kite in fox rust and cream (the one accent, and it reads against a dusk sky), spool with sage-green thread on pale wood, warm wood ladder, cream sock with rust and sage stripes and a darned heel, brass key in lamp gold. Nothing navy, so nothing disappears against Pip's coat when he holds it. Nothing pink or purple, so nothing is cut away with the magenta paper.
- **Size floor:** every object's longest side is at least 64 mm at its reference height (design language: targets at least 64 mm). Its shorter side is at least 20 mm, so nothing is a sliver. The grab volume itself (padded to 64 mm, snapping to a close hand) belongs to the client.
- **Descriptions** are one sentence each, written for the director: what it is and one detail it can play with ("A patched paper kite in faded rust and cream, with a tail of three cloth bows").

## The run

One 2K parts sheet, run 004's trims recipe with only the pieces changed: `seedream5_pro`, `2048:2048`, `art/runs/002-pip-puppet-and-live-painter/pip-master-v2.png` as Figure 1 (2.1 MB, under the 5 MB limit), flat vivid magenta paper, a margin on all four sides.

Prompt (final wording goes in `plan.json`):

> A paper-doll parts sheet, in exactly the painting style of Figure 1, of five separate lost household things for a storybook, all painted at one shared scale as if lying side by side, with wide empty space between them, none touching. Their heights relative to the ladder: the kite with its tail is four fifths of the ladder's height, the sock three fifths, and the key and the spool each half. A little wooden ladder with five rungs standing upright, with two sturdy pale-wood rails, three times as tall as it is wide, the tallest thing on the sheet. A diamond-shaped paper kite of faded rust-red and cream patches on a thin wooden cross, with a short tail of three cloth bows joined to its bottom corner, the whole kite with its tail one and a half times as tall as it is wide, no string. A wooden spool wound thick with sage-green thread, standing upright, as tall as it is wide, its loose end tucked in. A single cream wool sock with rust and sage stripes and a darned heel, lying flat, twice as tall as it is wide. An old brass key with a round looped bow, standing upright, two and a half times as tall as it is wide. Leave a wide margin of empty paper on all four sides. Each piece is complete, with a clean hard edge. No cast shadows on the paper. Hand-painted traditional watercolor with a fine graphite pencil outline, from a vintage natural history picture book. Soft pigment washes, visible paper grain, gentle edges. Natural, believable objects, not cartoons. On plain flat solid vivid magenta paper, one even color. No pink or purple on any object. No scenery, no text.

**Credits:** 9 planned (one 2K image at list price). **Cap: 36**, which allows up to three repaints (a whole sheet, or a smaller sheet for just the failed pieces) if a piece fails its checks and can't be fixed for free. The owner has said a cap of up to 100–200 is acceptable if needed. This job doesn't need that, so 36 stays the cap unless I come back with a reason. `capCredits` in `plan.json` is reset before each invocation to `objects_check.invocation_cap`: cap minus spent minus the largest job, plus 1. `generate.mjs` refuses a job once its own spend reaches `capCredits`, so a job starts only if it still fits the cap. Run 004's `safe_cap` would give 0 before the last repaint and block it. A repaint is a new job id, added only after I tell the owner why.

**Shared balance:** before the paid invocation I ask the owner to confirm no other workspace is generating, and read the balance twice a minute apart. After it I reconcile: debit list price for every attempt (`budget.attempted_cost` on the log, failures included), and compare with the balance drop and the task's own reported cost (`budget.reconcile`). Any unexplained difference is recorded in `results.md`, as run 004 did, and never counted as ours.

## Cut, finish and check

Run 004's `finish.py`, `checks.py` and `budget.py` are imported from `art/runs/004-book-and-first-set/` (merged and closed, so they won't move) rather than copied. Run 006 adds only `make_objects.py`, `objects_check.py` and `test_tools.py`.

`make_objects.py`, run from the repo root, rebuilds everything from the sheet and exits non-zero on any problem:

1. **Sheet.** `checks.border_is_paper`. If it arrives as a sheet on a sheet, crop to the magenta first (run 004's trims step).
2. **Cut** with `art/tools/cutout.py`, **without `--seal`**. **Assert exactly 5 pieces** before any finishing. Each piece is matched to its object by its centre on the sheet, from a table I fill in by eye after the painting arrives, and confirm on a labelled contact sheet.
3. **Finish** each piece with run 004's chain: `despill`, `clear_enclosed` (the gaps between ladder rungs, the key's bow, the spool's flanges), `clear_magenta`, `remove_specks`.
4. **Size.** Resample to Pip's own density, 905 px per 170 mm (5.32 px/mm), so pencil lines match his. That makes the ladder 798 px tall and the key 399 px. **Never upscale:** a piece painted smaller than its target is a problem, not a resize.
5. **Check** each finished piece, every failure a named problem:
   - `checks.check_cut`: one piece, no specks, no magenta halo at the edge.
   - Magenta left anywhere in the piece: under 0.1% of painted pixels.
   - Longest side at least 64 mm and shorter side at least 20 mm, at the object's `heightM`.
   - Shared scale: the sheet's px-per-mm across the five objects stays within 1.6×, so line weights match each other.
   - Pivot falls on paint, not on a hole.
   - **Nothing painted is lost in finishing:** at least 97% of the raw cut's paint survives (trapped paper excluded), and the painted box doesn't shrink. This catches a kite tail or bow that cleanup removes, which a piece count can't.
6. **Write** `art/objects/<id>/<id>.png` and `art/objects/<id>/object.json`, with `art: { kind: 'asset', path: 'objects/<id>/<id>.png' }`. The path is relative to `art/`, the same root the cast's `rig` paths and the contract fixtures use. `provenance: 'library'`. Every tag is checked against `contracts/data/tags.json` before writing.
7. **Contact sheet:** `art/runs/006-drawer-objects/contact.png`, all five on page colour and on night navy, for review.

**No shadow is baked into the art.** A baked shadow would hang in the air while Pip holds the object, or while it turns over. Like the cast's, the contact shadow is a soft ellipse the stage draws under the object's painted base, and it widens while the object is held (Hands and feedback). The proof page draws it so we can judge it, and `results.md` records the values for the client.

**Tests:**
- `art/runs/006-drawer-objects/test_tools.py` (unittest): the size floor, the magenta residue check, never-upscale, the shared-scale spread, the pivot check, tag validation, and the piece-count assert, each on a tiny synthetic image.
- `tests/art-objects.test.ts` (vitest, runs in `pnpm test`): every `art/objects/*/object.json` parses as `ObjectDef`, its `id` matches its folder, every tag is in `contracts/data/tags.json`, its art file exists, and its PNG's longest side is at least 64 mm at `heightM` (read from the PNG header, no new dependency). One more test asserts the drawer presets together cover `flies`, `climbs`, `spans` and `rope`, and that at least one preset carries none of them.

## The Mac proof

`art/objects-proof.html`, reference only and not product code, served from `art/` by any static server on this workspace's `CLIENT_PORT`. Pip's real rig and heads at reference scale on a table, with the five objects resting in a row like an open drawer, each with its contact shadow. Pick one and Pip holds it in his paw at its pivot, with his lantern set down lit beside him and the held object's shadow widened on the table. A 64 mm bar sits beside them, and the moods (dusk, night, gold) use run 004's values. I screenshot it in headless Chrome to check it myself before showing the owner.

## Done means

- Five objects cut out, checked and named, each `object.json` passing `tests/art-objects.test.ts`, and `make_objects.py` exiting 0.
- `pnpm test` and `python3 art/runs/006-drawer-objects/test_tools.py` pass.
- `results.md` closes the run: what was chosen, costs reconciled per invocation, what we learned, reuse. Durable learnings go in `art/README.md`.
- The owner has seen Pip holding each object in the Mac proof and approved it. That approval is provisional, as run 004's was: the final approval is in the headset, once the client can show objects.
- The owner has a short list of what to check in the headset: the 64 mm grab, objects against Pip's coat in night mood, the shadow while held, and the ladder against the real gap once the gap set exists.

## Out of scope

The gap set, the drawer itself, any code that renders or grabs objects, and the gap's authored rules. Ideas beyond this go in `docs/v2-ideas.md`.

## Review

Codex reviewed this plan in the Superset terminal before any credits were spent. It found no P0 or P1 issues, and four at P2.

1. **The prompt gave shapes but no relative sizes,** so a sheet could pass the prompt and fail the 1.6× shared-scale check. *Fixed:* the prompt gives each object's height relative to the ladder, from the `heightM` values.
2. **Finishing could remove painted features, such as a thin kite tail, and still pass,** because a piece count can't see what was lost. *Fixed:* a new preservation check (at least 97% of paint kept, painted box unchanged), tested on a synthetic kite that loses its tail.
3. **The cap formula blocked the last repaint.** `generate.mjs` refuses to start once spend ≥ `capCredits`, so run 004's `safe_cap` of 0 blocks it. *Fixed:* `invocation_cap` (remaining − largest + 1), tested at 27 of 36 spent.
4. **Done omitted the headset approval** the Art library ticket requires. *Accepted in part:* this ticket defines done as the Mac proof approved plus a headset checklist, and no client code can show objects on the Quest yet. The Mac approval is recorded as provisional, and the headset stays the final gate, as in run 004.
