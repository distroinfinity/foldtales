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
- `tools/generate.mjs`: runs a plan. Use `node --env-file=.env.local art/tools/generate.mjs art/runs/<id>` from the repo root.

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
