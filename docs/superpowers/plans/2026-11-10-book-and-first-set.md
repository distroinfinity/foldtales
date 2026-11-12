# Book and First Set Implementation Plan

**Status:** ✅ Done. Run 004 closed and merged in PR #1. Approved on the Mac by the owner on Nov 11, 2026. The final approval waits for ticket 1 to show the pieces in the headset.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paint, cut out, register and name every piece M1 needs (the book, the shore path set, Pip's look up, the unlit lantern), close run 004, and show the result on the Mac.

**Architecture:** One planned run in two paid phases. Phase A picks a composition and proves a cutting paper. Phase B paints from the chosen key. Small Python one-offs in the run folder finish the pieces and check them, and one reference page proves the pieces make the moment.

**Tech Stack:** `seedream5_pro` through `art/tools/generate.mjs`, Python 3 with numpy, Pillow and scipy, `art/tools/cutout.py`, one static HTML page with CSS 3D.

**Spec:** `docs/superpowers/specs/2026-11-09-book-and-first-set-design.md`

## Global Constraints

- Run folder: `art/runs/004-book-and-first-set/`. Run from the repo root: `node --env-file=.env.local art/tools/generate.mjs art/runs/004-book-and-first-set`.
- Do not edit `art/tools/generate.mjs` or `art/tools/cutout.py`. One-off steps live in the run folder.
- Keys stay in `.env.local`. Never print or copy them. Nothing goes to Claude artifacts or Claude Docs.
- **No paid invocation without the owner's approval by question card**, and each invocation needs the owner's confirmation that the other workspace won't generate from before the first job until after the final balance read.
- Total run cap 120 credits. Before each invocation, `capCredits` = 120 − spent so far − 9, and the queue at list price must fit within 120 − spent so far.
- **Spent so far** debits list price for every attempted job, whether it logged `done` or `FAILED`. Any balance change that doesn't match stops the run and goes to the owner. That covers lost images and top-ups.
- **The queue is every job without an output file**, because that's what the tool runs. A failed job that's being replaced comes out of `plan.json` first.
- List prices: 5 credits at 1K ratios, 9 at 2K ratios. Reference images stay under 5 MB, so keys are 1K.
- Reference size: closed book 210 x 315 mm, open spread 420 x 315 mm. Origin at the near end of the spine, x right, y away from the reader, z up. Page color `#F6EFE2`.
- Layers: `layer-1-sky` hinge y 295, height ≤ 236. `layer-2-headland` hinge y 250, height ≤ 200. `layer-3-dunes` hinge y 215, height ≤ 120. `layer-4-foreground` hinge y 70, height ≤ 65 at the sides, under 30 in the center. Pip's mark y 175, right of center, about 170 mm tall. Flat stack from the top: sky, headland, dunes, Pip, foreground. Near 45 mm of page stays bare.
- Nothing important in the center 6% of any layer. The lighthouse lamp is unlit. No painted beams, lit windows or directional cast shadows. Title lettering is never painted.
- Commit to this branch as you go. Do not push.

## Review Focus

- The painter ignores the paper margin and paints to the image border: the sheet is rejected before cutting, because `cutout.py` would invert it (Task 1 test).
- A layer comes out in several pieces, or trapped paper remains: extraction counts are asserted against `cutout.py`'s real output before finishing (Task 1 test).
- A job fails after being charged, or balance moves more than list price: every attempt is debited at list price and a mismatch stops the run (Task 1 test).
- The new head or unlit lantern doesn't land on Pip's real body: the swap check fails before anything reaches `rig.json` (Task 1 test).
- The set goes muddy when tinted, or the dunes get darker than Pip's coat: the value check fails (Task 1 test).

---

### Task 1: Finishing and checking tools, and the free lantern fix

**Files:**
- Create: `art/runs/004-book-and-first-set/finish.py`, `art/runs/004-book-and-first-set/checks.py`, `art/runs/004-book-and-first-set/budget.py`, `art/runs/004-book-and-first-set/test_tools.py`
- Modify: `art/cast/pip/parts/lantern.png`

**Interfaces (all numpy arrays are uint8 RGBA unless noted):**
- `finish.remove_specks(rgba, max_area=200) -> rgba`: zero alpha on components smaller than `max_area`.
- `finish.clear_enclosed(rgba, paper_rgb, tolerance=40) -> rgba`: zero alpha on enclosed regions close to the paper color.
- `finish.despill(rgba, paper_rgb, band=3) -> rgba`: in the band inside the alpha edge, pull color away from the paper hue.
- `finish.trim_base(rgba, solid=0.9) -> rgba`: crop below the lowest row where opaque pixels cover at least `solid` of the painted width.
- `finish.center_on_canvas(rgba, canvas_width) -> rgba`: pad left and right so the painted bbox center is the canvas center, keeping height.
- `finish.calibrate_paper(rgb, target=(246,239,226), margin=0.03) -> rgb`: per-channel gain from the median of the outer margin.
- `finish.register_head(new, forward) -> (scale, dx, dy)`: uniform scale so bbox widths match, offset so the chin anchors match. The chin anchor is the centroid of the lowest 10% of opaque rows, which is where the head seats in the collar.
- `finish.fit_lantern(new, lit) -> rgba`: resample `new` onto `lit`'s canvas, matching bbox and top edge.
- `finish.outline_error(a, b) -> int`: largest per-row difference between the left or right alpha edges, in pixels.
- `checks.border_is_paper(rgb, tolerance=30) -> bool`: at least 97% of the border is within tolerance of its median, and at least 5% of interior pixels are not.
- `checks.MOODS`: `{'dusk': (0.86,0.90,1.00), 'night': (0.45,0.55,0.70), 'gold': (1.00,0.88,0.66)}`, multiplied into RGB. The proof page uses the same values.
- `checks.cut_count(out_dir) -> int`: PNGs that `cutout.py` wrote.
- `checks.check_cut(rgba, min_w, min_h) -> list[str]`: problems, one string each: `no alpha`, `pieces:N`, `specks:N`, `halo:<frac>`, `small`.
- `checks.check_layer(rgba, hinge_mm, max_h_mm, px_per_mm) -> list[str]`: adds `base`, `too tall`, `off center`.
- `checks.value_margin(backdrop_rgb, coat_rgb) -> float`: difference in mean L* (backdrop minus coat).
- `budget.price(ratio) -> int`, `budget.pending_jobs(plan, run_dir) -> list`, `budget.queue_cost(jobs) -> int`, `budget.safe_cap(spent, total=120, largest=9) -> int`, `budget.assert_queue_fits(jobs, spent, total=120)`, `budget.attempted_cost(log_text, plan) -> int`, `budget.reconcile(listed, observed_delta) -> dict` with `listed`, `observed`, `unexplained`.

- [x] **Step 1: Write failing tests in `test_tools.py` using `unittest` and synthetic images**

```python
def test_full_bleed_sheet_is_rejected(self):
    img = np.full((100, 200, 3), (60, 90, 160), 'uint8')
    img[:20] = (190, 40, 120)                       # paper only along the top
    self.assertFalse(checks.border_is_paper(img))

def test_margined_sheet_passes(self):
    img = np.full((100, 200, 3), (190, 40, 120), 'uint8')
    img[20:80, 20:180] = (60, 90, 160)
    self.assertTrue(checks.border_is_paper(img))

def test_two_pieces_are_reported(self):
    self.assertIn('pieces:2', checks.check_cut(two_blocks(), 10, 10))

def test_specks_are_removed_and_reported(self):
    self.assertTrue(any(p.startswith('specks') for p in checks.check_cut(block_with_specks(), 10, 10)))
    self.assertEqual(checks.check_cut(finish.remove_specks(block_with_specks()), 10, 10), [])

def test_trim_base_makes_a_solid_bottom_row(self):
    out = finish.trim_base(ragged_bottom_block())
    self.assertGreaterEqual((out[-1, :, 3] > 200).sum(), 0.9 * painted_width(out))

def test_center_on_canvas(self):
    out = finish.center_on_canvas(off_center_block(), 400)
    self.assertEqual(out.shape[1], 400)
    self.assertLessEqual(abs(bbox_center_x(out) - 200), 1)

def test_layer_too_tall(self):
    self.assertIn('too tall', checks.check_layer(tall_block(600), 100, 100, 2.0))

def test_shifted_head_is_measured(self):
    forward = head_shape(0, 0); shifted = head_shape(7, -3)
    s, dx, dy = finish.register_head(shifted, forward)
    self.assertAlmostEqual(s, 1.0, places=2); self.assertEqual((dx, dy), (-7, 3))

def test_lantern_outline(self):
    self.assertLessEqual(finish.outline_error(lantern_shape(), lantern_shape()), 0)
    self.assertGreaterEqual(finish.outline_error(lantern_shape(), wider_lantern_shape(8)), 8)

def test_dark_backdrop_fails_margin(self):
    navy = (31, 42, 68)
    self.assertLess(checks.value_margin((40, 50, 75), navy), 25)
    self.assertGreater(checks.value_margin((200, 195, 175), navy), 25)

def test_calibrate_paper_hits_target(self):
    out = finish.calibrate_paper(block_on_paper((250, 248, 244)))
    self.assertLessEqual(np.abs(np.median(out[:3].reshape(-1, 3), axis=0) - (246, 239, 226)).max(), 1)

def test_prices(self):
    self.assertEqual(budget.price('1376:768'), 5); self.assertEqual(budget.price('2720:1530'), 9)

def test_queue_must_fit_remaining(self):
    with self.assertRaises(ValueError):
        budget.assert_queue_fits([{'ratio': '2720:1530'}] * 3, spent=95)

def test_pending_counts_every_job_without_a_file(self):
    plan = {'jobs': [{'id': 'a', 'ratio': '1376:768'}, {'id': 'b', 'ratio': '1376:768'}]}
    with tempfile.TemporaryDirectory() as d:
        Path(d, 'a.png').write_bytes(b'x')
        self.assertEqual([j['id'] for j in budget.pending_jobs(plan, d)], ['b'])

def test_failed_attempts_are_debited(self):
    plan = {'jobs': [{'id': 'a', 'ratio': '2720:1530'}, {'id': 'b', 'ratio': '2720:1530'}]}
    self.assertEqual(budget.attempted_cost('done a: 100s, 9 credits\nFAILED b: rejected', plan), 18)

def test_border_allows_an_empty_center(self):
    img = np.full((100, 200, 3), (190, 40, 120), 'uint8')
    img[60:90, 15:60] = (60, 90, 160); img[60:90, 140:185] = (60, 90, 160)   # the foreground's shape
    self.assertTrue(checks.border_is_paper(img))

def test_cutout_reports_a_split_layer(self):
    with tempfile.TemporaryDirectory() as d:
        sheet = np.full((400, 700, 3), (190, 40, 120), 'uint8')
        sheet[150:350, 60:300] = (60, 90, 160); sheet[150:350, 400:640] = (60, 90, 160)
        Image.fromarray(sheet).save(Path(d, 's.png'))
        subprocess.run([sys.executable, 'art/tools/cutout.py', '--seal=3', str(Path(d, 's.png')), str(Path(d, 'o'))], check=True, capture_output=True)
        self.assertEqual(checks.cut_count(Path(d, 'o')), 2)

def test_safe_cap(self):
    self.assertEqual(budget.safe_cap(spent=15), 96)

def test_reconcile_shows_unexplained_spend(self):
    r = budget.reconcile(listed=14, observed_delta=23)
    self.assertEqual(r, {'listed': 14, 'observed': 23, 'unexplained': 9})
```

Helpers (`two_blocks`, `block_with_specks`, `ragged_bottom_block`, `off_center_block`, `tall_block`, `head_shape`, `lantern_shape`, `wider_lantern_shape`, `block_on_paper`, `painted_width`, `bbox_center_x`) are small numpy shape builders in the test file. `halo` measures paper-colored pixels in the 3 px band inside the alpha edge, and needs a paper color from `check_cut(..., paper_rgb=None)`.

- [x] **Step 2: Run the tests and confirm they fail**

Run: `python3 art/runs/004-book-and-first-set/test_tools.py`
Expected: FAIL with an import error for `finish`.

- [x] **Step 3: Implement `finish.py`, `checks.py` and `budget.py` to the interfaces above**

Use `scipy.ndimage` for components and hole filling. L* comes from the standard sRGB conversion.

- [x] **Step 4: Run the tests and confirm they pass**

Run: `python3 art/runs/004-book-and-first-set/test_tools.py`
Expected: `OK`

- [x] **Step 5: Clean the lit lantern and verify**

Apply `remove_specks` to `art/cast/pip/parts/lantern.png` and save in place. Check: size is still 138 x 286, `check_cut` reports no specks and one piece, and no pixel changes outside the removed specks.

- [x] **Step 6: Commit**

```bash
git add art/runs/004-book-and-first-set art/cast/pip/parts/lantern.png
git commit -m "Add run 004 finishing tools and clean the lantern"
```

---

### Task 2: Phase A, paint the keys and test the paper

**Files:**
- Create: `art/runs/004-book-and-first-set/plan.json`, `art/runs/004-book-and-first-set/notes-phase-a.md`
- Output: `key-plain.png`, `key-lost-things.png`, `paper-test.png`, `manifest.jsonl`, `log-a.txt`

**Interfaces:**
- Consumes: `budget.assert_queue_fits`, `budget.safe_cap`, `budget.reconcile`, `checks.border_is_paper`, `finish.*` from Task 1.
- Produces: the chosen key path, and the paper word `{PAPER}` used by every Phase B prompt.

- [x] **Step 1: Write `plan.json`**

Top-level fields: `id`, `question` ("Can seedream5_pro paint a book and layered paper set that sit in the same book as Pip, and cut out cleanly?"), `why`, `decideBy`, `learnEvenIfRejected`, `reusableOutput`, `capCredits`, `jobs`. All jobs use `seedream5_pro`. `capCredits` is `budget.safe_cap(0)` = 111, and `assert_queue_fits` bounds the queue at 15.

`STYLE` is: `Hand-painted traditional watercolor with a fine graphite pencil outline, from a vintage natural history picture book. Soft pigment washes, visible paper grain, gentle edges.`

Jobs, each with ratio `1376:768`:

| id | refs | prompt |
|---|---|---|
| `key-plain` | `art/runs/002-pip-puppet-and-live-painter/pip-master-v2.png` | `A wide landscape in exactly the painting style of Figure 1, but without the fox or any character. A quiet shore below a lighthouse at gentle early dusk. A tall old stone lighthouse stands on a far headland in the left third, and its lamp room is dark and unlit. A strip of calm sea lies below the headland. Low pale sand dunes cross the middle, with a sandy path winding through them. Low clumps of reeds and a few stones sit at the far left and far right in the near foreground, dipping away to nothing in the center. A pale, soft dusk-blue sky with a faint moon. Mid-to-high values throughout, never dark, no night. The center right of the picture is open and calm, for a small character to stand in. No light sources, no beams, no lit windows, no directional cast shadows. {STYLE} No text.` |
| `key-lost-things` | same | Same prompt, with this inserted before `A pale, soft dusk-blue sky`: `Washed up among the dunes are three large lost household things, big as boulders: a brass button half sunk in the sand, a silver thimble, and a teaspoon standing upright like a post.` |
| `paper-test` | same | `A single die-cut paper stage piece, flat-on, in exactly the painting style of Figure 1: a low pale sand dune with tufts of sage-green reeds and a thin strip of pale blue sea along its top. Its silhouette has a clean hard edge traced with a fine pencil line, and a perfectly straight flat bottom edge. Leave a wide margin of empty paper on all four sides, with nothing touching the edge of the image. {STYLE} On plain flat solid vivid magenta paper, one even color. No text.` |

- [x] **Step 2: Confirm the queue fits**

Run a one-liner calling `budget.assert_queue_fits(budget.pending_jobs(plan, run_dir), spent=0)`.
Expected: no error, queue cost 15, and three jobs listed.

- [x] **Step 3: Ask the owner by question card**

The card states: the whole plan in one line, Phase A 15 credits, planned total 83, cap 120, and what stops it. It asks for approval and confirmation that the other workspace will stay quiet for about 6 minutes. Stop until answered.

- [x] **Step 4: Run Phase A in the background, teeing to `log-a.txt`**

Run: `node --env-file=.env.local art/tools/generate.mjs art/runs/004-book-and-first-set 2>&1 | tee art/runs/004-book-and-first-set/log-a.txt`
Expected: three `done` lines, no `FAILED`.

- [x] **Step 5: Reconcile**

Compute `attempted_cost` from the log and compare with this invocation's `total spent` using `budget.reconcile`, then start the ledger in `notes-phase-a.md`. Expected: `unexplained` 0. If it's not 0, stop and tell the owner before anything else is queued.

- [x] **Step 6: Test the paper**

Run `checks.border_is_paper` on `paper-test.png`, then `python3 art/tools/cutout.py --seal=3 <paper-test> <scratchpad>`. Open the cut on navy and on cream. Pass means one piece, the pale sand and blue sea both survive, and no pink fringe that `despill` can't remove. If it fails, choose per-layer papers against each layer's palette and write them in `notes-phase-a.md`.

- [x] **Step 7: Ask the owner to pick a key by question card, showing the two images**

Open both keys for the owner by path, with the plain shore and lost-things versions named. Stop until answered. Record the choice and copy the chosen file to `key.png`.

- [x] **Step 8: Commit**

```bash
git add art/runs/004-book-and-first-set
git commit -m "Paint run 004 keys and test the cutting paper"
```

---

### Task 3: Phase B, paint the book, the set and Pip's additions

**Files:**
- Modify: `art/runs/004-book-and-first-set/plan.json`
- Output: `layer-1-sky.png`, `layer-2-headland.png`, `layer-3-dunes.png`, `layer-4-foreground.png`, `ground.png`, `cover-front.png`, `trims-sheet.png`, `pip-sheet.png`, `log-b.txt`

**Interfaces:**
- Consumes: `key.png`, `{PAPER}` from Task 2.
- Produces: the eight files above.

- [x] **Step 1: Add the jobs to `plan.json`, keeping the Phase A jobs**

Set `capCredits` to `budget.safe_cap(spent_so_far)`. Jobs (all `seedream5_pro`):

`LAYER` is `Figure 1 is the composed scene. Paint only {what} from Figure 1, as a single die-cut paper stage piece, flat-on, in exactly the same painting style and colors. {shape} Its silhouette has a clean hard edge traced with a fine pencil line, and a perfectly straight flat bottom edge. Leave a wide margin of empty paper on all four sides, with nothing touching the edge of the image. The center of the piece stays free of important detail. Paint the whole piece continuously, including every part that other pieces would normally hide, right down to its straight bottom edge, with no gaps or holes. {STYLE} Pale, gentle dusk values. No lit windows, no beams, no directional cast shadows. On plain flat solid vivid {PAPER} paper, one even color. No text.`

| id | ratio | refs | fill |
|---|---|---|---|
| `layer-1-sky` | `2720:1530` | `key.png` | what: `the sky`. shape: `A wide band of pale dusk-blue sky with a faint moon, its top edge cut in soft rolling cloud shapes.` |
| `layer-2-headland` | `2720:1530` | `key.png` | what: `the far headland, lighthouse and strip of sea`. shape: `The lighthouse stands in the left third, dark and unlit, on a low rocky headland, and the land falls to a strip of calm sea toward the right. Pale cool values.` |
| `layer-3-dunes` | `2720:1530` | `key.png` | what: `the low sand dunes`. shape: `A long, low, pale band of sand dunes with a few chunky tufts of grass, its top edge rising and falling gently. Lighter in value than a navy coat by a wide margin.` Add the chosen key's lost things here, if any. |
| `layer-4-foreground` | `2720:1530` | `key.png` | what: `the foreground reeds and stones`. shape: `Chunky clumps of reeds and a few stones rising at the far left and far right, and dipping almost to nothing across the middle. The reeds are bold clump shapes, not thin strands.` |

| id | ratio | refs | prompt |
|---|---|---|---|
| `ground` | `2304:1728` | `key.png` | `The printed page of an open picture book, seen flat from directly above, in exactly the painting style of Figure 1. Soft pale sand and a winding path, painted as flat watercolor washes with no horizon and no perspective, fading gently to bare warm white paper at all edges. The bottom sixth of the image is bare paper. A faint darkening down the exact center line where the two pages meet. {STYLE} No characters, no text, no border, not a photo of a book.` |
| `cover-front` | `1664:2496` | `pip-master-v2.png` | `The front cover of an old storybook, filling the whole image edge to edge, seen perfectly flat. Deep navy blue cloth with visible watercolor texture, in the painting style of Figure 1. A restrained gold-stamped ornamental border, a small gold-stamped lighthouse emblem in the lower half, and an empty plain panel in the upper third for a title to be added later. {STYLE} No text, no letters, no fox, no perspective, no book edges, no background.` |
| `trims-sheet` | `2048:2048` | `pip-master-v2.png` | `A paper-doll parts sheet, in exactly the painting style of Figure 1, of separate pieces for a storybook, with wide empty space between them, none touching: a rust-red cloth ribbon bookmark with a notched end, hanging straight; a gold cloth tab with a rounded end; a sage-green cloth tab with a rounded end; a small brown leather drawer pull with a brass handle; a long thin horizontal strip of stacked cream page edges with fine pencil lines; one opaque pale grey die-cut curl of paper smoke with a pencil outline; two small brown autumn leaves. Leave a wide margin of empty paper on all four sides. Each piece is complete, with a clean hard edge. {STYLE} On plain flat solid vivid {PAPER} paper, one even color. No scenery, no text.` |
| `pip-sheet` | `1024:1024` | `art/runs/003-cast-puppets/pip-heads-sheet.png`, `art/runs/002-pip-puppet-and-live-painter/pip-parts-sheet.png` | `A sheet for the fox character and lantern in Figures 1 and 2, in exactly the same painting style. Three separate pieces with wide empty space between them, none touching. First, the fox's head with ears, chin lifted, looking up toward someone far above with big frightened eyes. Second, the same head and angle, chin lifted, looking up with a small hopeful pleading look. Both heads exactly the same size as the heads in Figure 1, ending cleanly at the chin ruff. Third, the same brass lantern as in Figure 2, exactly the same shape and size, but its flame has gone out: dark clear glass, a burnt wick and no glow. Leave a wide margin of empty paper on all four sides. {STYLE} Natural animal anatomy, gentle and dignified, not a cartoon. On plain white paper. No scenery, no ground, no text.` |

- [x] **Step 2: Confirm the queue fits and the cap is set**

Assert `budget.assert_queue_fits` against `budget.pending_jobs` and the ledger's spend so far, and print the exact job list. Expected queue cost 68, eight jobs.

- [x] **Step 3: Ask the owner by question card to confirm the exclusive window**

States Phase B: 68 credits, about 16 minutes, how much remains under the cap. Stop until answered.

- [x] **Step 4: Run in the background, teeing to `log-b.txt`, and reconcile**

Same command as Task 2. Expected eight `done` lines, then reconcile this invocation only, from `log-b.txt`, and add it to the ledger. Expected `unexplained` 0. If a job failed, stop and work out from the balance whether it was charged before queuing anything.

- [x] **Step 5: Look at every painting against Pip and the mockup**

Reject anything with text, a lit lamp, a picture of a book, or a frame around the whole image. The cover's gold ornament is wanted. A repaint is a new job id such as `layer-3-dunes-v2`, changes one thing, removes any failed job it replaces from `plan.json`, and needs the budget check, the exact queue shown to the owner, and an exclusive window again. Repaints beyond the three budgeted go to the owner.

- [x] **Step 6: Commit**

```bash
git add art/runs/004-book-and-first-set
git commit -m "Paint run 004 layers, book and Pip's additions"
```

---

### Task 4: Cut out, register and name the finished pieces

**Files:**
- Create: `art/runs/004-book-and-first-set/make_pieces.py`, `art/book/book.json`, `art/sets/shore-path/set.json`, and the PNGs listed in the spec's Files section
- Modify: `art/cast/pip/rig.json`

**Interfaces:**
- Consumes: Task 1 functions, Task 3 images.
- Produces: `art/book/`, `art/sets/shore-path/`, `art/fx/`, `art/cast/pip/heads/up.png`, `art/cast/pip/parts/lantern-out.png`, and the metadata for Task 5.

- [x] **Step 1: Write `make_pieces.py`, reproducible from the run folder**

Before anything is finished, assert piece counts from `cutout.py`: one output for each layer, eight for trims and effects (ribbon, gold tab, sage tab, drawer pull, page edge, smoke, two leaves), three for Pip's sheet. For each layer: `checks.border_is_paper`, then `cutout.py --seal=3`, then `despill`, `clear_enclosed`, `remove_specks`, `trim_base`, `center_on_canvas(…, 2720)`. Ground: `calibrate_paper`. Spine: a 48 px strip from the cover's left edge, without any border ornament. Trims: cutout with the piece names from the prompt in the tool's reading order, verified by eye.

Pip's sheet is on white paper, matching run 003's heads: `checks.border_is_paper`, `cutout.py --seal=3`, `clear_enclosed` on the lantern's handle, and a look at the pale fur. Choose the better of the two up heads by eye (the choice is mine, and the owner can overrule it in the proof), then `register_head` against `heads/forward.png`, saved with its aspect kept. Render a composite of `up` on Pip's real coat using the rig, and only write `up` to `rig.json`'s `head.offsets` once it seats in the collar. Save `lantern-out` through `fit_lantern`. If `outline_error` is over 5, paste its glass region inside the lit lantern's frame instead.

- [x] **Step 2: Run it and check every piece**

Expected: `check_cut` and `check_layer` return no problems for all pieces. Hinges and heights use `px_per_mm = 2720/420`.

- [x] **Step 3: Write `book.json` and `set.json`**

Follow the spec's list of required fields. Measure the lighthouse lamp position by eye on the finished `layer-2-headland`. Add to `rig.json`: `"parts.lantern.variants": { "out": "parts/lantern-out.png" }`, same placement and pivot as the lantern.

- [x] **Step 4: Write and run a check that names and files agree**

`checks.check_manifest(book_json, set_json, root)` returns missing or unreferenced PNGs. Expected: `[]`. Add a test first in `test_tools.py`: a manifest that names a missing file returns that name, and an unreferenced PNG is reported.

- [x] **Step 5: Run the value check**

Project the reference eye (y −500, z 420) through Pip at his mark onto the finished layers to get the actual backdrop behind his body, his head and the unlit lantern. Apply each of `checks.MOODS` to the backdrop and to Pip's coat, and to the lantern's glass. Expected `checks.value_margin` at least 25 under dusk and gold, at least 12 under night.

- [x] **Step 6: Commit**

```bash
git add art/runs/004-book-and-first-set art/book art/sets art/fx art/cast/pip
git commit -m "Cut out and register the book, shore path and Pip's additions"
```

---

### Task 5: The Mac proof page

**Files:**
- Create: `art/m1-proof.html`

**Interfaces:**
- Consumes: pieces and JSON from Task 4, `art/cast/pip/rig.json`.

- [x] **Step 1: Write the single-file page, with no imports from anywhere else**

Uses CSS 3D with real sizes at a fixed px-per-mm, and reads `book.json`, `set.json` and `rig.json` with `fetch`. Holds three motions only: the book unfolding (cover, then halves rise back to front with a small overshoot), the room dim, and the lantern moment (swap to `lantern-out`, smoke and leaves, head swap to `up`). The two halves of a layer are one image with two background positions. Mouse movement moves the perspective origin. Controls: `Open the book`, `Replay`, mood `dusk / night / gold`, hide sky. Header comment says it's reference only, in the style of `book-mockup.html`. Title set in Fraunces, printed on the blank cover panel.

- [x] **Step 2: Serve it and verify**

Serve from `art/` with `set -a; . ../.env.ports; set +a; python3 -m http.server "$CLIENT_PORT"`. Open with the `superset:browser` skill, or headless Chrome if that's unavailable. Screenshot closed, mid-unfold, open, lantern out with Pip looking up, and two mouse extremes. Confirm no console errors, no missing images, and that the layers visibly shift against each other.

- [x] **Step 3: Compare with the look bar and fix art faults**

Anything that fails by eye goes back to Task 3 Step 5 or Task 4. No debug text on screen other than the controls.

- [x] **Step 4: Commit**

```bash
git add art/m1-proof.html
git commit -m "Add the M1 reference proof page"
```

---

### Task 6: Close the run and hand over

**Files:**
- Create: `art/runs/004-book-and-first-set/results.md`
- Modify: `art/README.md`

- [x] **Step 1: Write `results.md`**

Same shape as run 003: what it cost per job (observed and list, shown separately), the ledger across invocations, answers to the question, what we learned, still unproven, and reuse.

- [x] **Step 2: Add durable learnings to `art/README.md`**

Paper margin on all four sides because the tool reads paper from the border. Which paper worked for multi-colored scenery. Register new heads against the puppet, not the sheet. How to stay inside a cap on a shared account. Add `art/book/`, `art/sets/` and `art/fx/` to the Layout section.

- [x] **Step 3: Verify the whole delivery**

Run: `python3 art/runs/004-book-and-first-set/test_tools.py` and the Task 4 checks again.
Expected: all pass, and spend is at or below 120 credits.

- [x] **Step 4: Commit**

```bash
git add art/runs/004-book-and-first-set art/README.md
git commit -m "Close run 004"
```

- [x] **Step 5: Ask the owner to approve the result on the Mac by question card**

Give the proof page URL and what to look at. State what was verified and how, and what still needs the headset: does the book hold up as card from the side, is the parallax worth it, is Pip legible against the dunes in real room light, does the dim plus the unlit lantern read as "the light went out", and does the spine seam show.
