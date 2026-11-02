# Run 003 results

**Status:** closed. You chose to keep going without polishing the fit further, so joints stay at a first fit. Tune them on the Quest.

## What it cost

25 credits, against a cap of 40. That includes 5 credits lost when the network dropped during Moth's first attempt: the image was charged, but the tool gave up waiting for it. `tools/generate.mjs` now keeps checking through a dropout.

| Job | Model | Credits | Seconds |
|---|---|---|---|
| Pip's six heads | `seedream5_pro` | 5 | 97 |
| Wick's parts | `seedream5_pro` | 5 | 123 |
| Wick's six heads | `seedream5_pro` | 5 | 114 |
| Moth's parts, lost attempt | `seedream5_pro` | 5 | n/a |
| Moth's parts | `seedream5_pro` | 5 | 119 |

## Answers

- **Parts:** yes. Wick and Moth both cut out cleanly and join back into the characters from run 001.
- **Swappable heads:** yes for talking and blinking. One sheet gives a matched set, and those heads land within 5 pixels of the forward head once aligned. Wick's grumpy head sits 18 pixels off, which the rig corrects.
- **Side heads:** yes. They read as the same characters turned.
- **Moth on blue paper:** yes. The pale wings survive cutting out, and the colors still match run 001.

## What we learned

- **Six heads on one sheet is enough for a speaking character,** so we don't need separate mouth and eyelid pieces. That sets the recipe: one parts sheet and one heads sheet, 10 credits a character.
- **Alignment can be measured.** Comparing each head to the forward head gives the offset for the rig, with no hand placement.
- **Pale fur can leak through gaps in a pencil line.** `cutout.py --seal=3` stops this. Wick's side heads needed it.
- **Paper trapped between fine feathers needs its own pass.** Moth's antenna had a one-off to clear the blue.

## Still unproven

All three ran in a desktop browser on a photo of your desk, not yet on the Quest. Wick's arms are stiff. Pip's and Wick's three-quarter heads are cut out but not yet wired into a rig.

## Reuse

Everything in `art/cast/` is a product asset. The two sheet prompts in `plan.json` are the recipe for any new character.
