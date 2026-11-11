# Art library

Generated art is a product asset, not a temp file. Credits are only spent on planned runs that teach us something or produce something we keep.

## Rules

1. **Plan first.** Every run has a `plan.json` before anything generates: the question it answers, how we'll decide, and what stays reusable afterward.
2. **Reuse before generating.** Check this folder and earlier runs' learnings first. The tool skips any job whose image already exists, so reruns never pay twice.
3. **Record everything.** The tool logs the prompt, model, settings, seconds and credits for each image in the run's `manifest.jsonl`.
4. **Close each run.** Write `results.md` with what was chosen, what we learned and where images may be reused. Add durable learnings below.
5. **Change one thing at a time** between runs, so we know what caused a difference.
6. **Keep the cap.** Each plan sets a credit cap, and the tool stops at it.

## Layout

- `refs/`: approved design references that generations work from.
- `runs/<id>/`: each planned run, with its plan, images, manifest and results.
- `cast/<who>/`: finished puppet pieces and each character's `rig.json`. These are product assets.
- `book/`: the book's cover, spine, page edge, ribbon, tabs and drawer pull, with `book.json` saying where each goes.
- `sets/<set>/`: a set's layers and printed ground, with `set.json` giving hinges, sizes and anchors in stage space.
- `fx/`: small effect pieces such as smoke and leaves.
- `m1-proof.html`: the M1 moment with the real pieces, in CSS 3D. Reference only.
- `cast/prototype.html`: the approved acting for all three characters. Reference only.
- `objects/<id>/`: finished objects, each a PNG plus an `object.json` that matches `ObjectDef`. `objects-proof.html` shows Pip holding them. Reference only.
- `book-mockup.html`: the approved page, lettering and controls. Reference only.
- `tools/generate.mjs`: runs a plan. Use `node --env-file=.env.local art/tools/generate.mjs art/runs/<id>` from the repo root. Needs `RUNWAYML_API_SECRET` in `.env.local`.
- `tools/cutout.py`: cuts painted pieces off plain paper, for no credits. Needs Python with `numpy` and `Pillow`.

## What we've learned

- **Painter for prepared art:** `seedream5_pro`, 5 credits and about 110 s an image (run 001).
- **Design references work.** A rough sketch plus a written description keeps an approved design across models (run 001).
- **Listed prices can overstate real cost.** Check `manifest.jsonl`, not the price range (run 001).
- **Be specific about shape.** "Far too big" wasn't enough for Pip's coat, so describe sleeves past the paws and a dragging hem (run 001).
- **Painter for art made during a session:** `seedream5_flash`, 2 credits and under 30 s an image, the closest match to prepared art (run 002).
- **One image can make a puppet.** A "paper-doll parts sheet" with wide space between pieces gives parts that cut out cleanly, at no extra credits (run 002).
- **AI-invented characters can match.** A description plus one painted character as a style guide fits the same book (run 002).
- **Seat the head in the collar.** Center it over the neck opening, pivot at the chin, keep its slide small, and add a soft shadow under the chin (Pip's `rig.json`).
- **Pale pieces need contrasting paper.** Cream wings on cream paper get eaten when cut out, even with the tint removed. Tested for free on run 001's Moth, before spending credits.
- **A speaking character costs 10 credits to prepare.** One parts sheet and one sheet of six heads. Talking and blinking heads from one sheet line up within 5 pixels once aligned (run 003).
- **Pale fur can leak through a pencil line.** Use `cutout.py --seal=3`. Cut very pale pieces out on flat colored paper instead of white (run 003).
- **Leave paper on all four sides.** `cutout.py` takes the paper's color from the image border, so a piece painted to the edge gets inverted (run 004).
- **Flat vivid magenta paper suits many-colored scenery,** and needs no `--seal`. Sealing on textured colored paper keeps the whole image (run 004).
- **Expect the painter to fill in what's behind a piece.** It painted sky behind a cut-out lighthouse twice. Say "no sky at all", and cut the rest away by color (run 004).
- **Give heights as a fraction of width.** "Low" isn't enough (run 004).
- **Register new heads against the puppet's real head and body, not their sheet** (run 004).
- **The shared Runway account needs a clear window you've confirmed, and a reconcile after every invocation.** The tool measures spend from the balance, so another workspace's charges look like yours (run 004).
- **2K costs 9 credits.** Keep reference images at 1K, under the 5 MB limit (run 004).
- **A drawer of five objects costs about 14 credits.** One 2K parts sheet, plus a 1K repaint for any piece painted too small (run 006).
- **A shared sheet doesn't keep relative sizes,** even when the prompt states them. Measure each piece's px per mm, and repaint a small one alone at 1K with its own crop as Figure 1 (run 006).
- **Shadow on magenta paper is deep crimson,** about (98, 9, 36), and survives `clear_magenta` as a dark fringe. Eat blue-over-green pixels inward from every edge before despill (run 006).
- **"Die-cut paper piece" paints a white sticker border** around a single object. Use parts-sheet wording for objects. A border that does appear strips for free with a flood bounded near the edge (run 006).
- **Objects are finished at Pip's density,** 905 px per 170 mm, with no baked shadow. The stage draws the contact shadow, so it can widen while the object is held (run 006).
- **Voices come from a closed list.** `eleven_v4` on Runway takes only its 49 presets, with no descriptions, so sweep them once (`art/tools/generate-voice.mjs`, run 005).
- **Voice lines cost per call.** A line of 200 characters or fewer is exactly 1 credit, so budget by line count, not characters (run 005).
- **The balance is shared.** Cap spending from each task's reported cost, and treat balance drops only as a sign someone else is spending (run 005).
