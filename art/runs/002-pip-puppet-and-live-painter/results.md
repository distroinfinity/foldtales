# Run 002 results

**Status:** closed. Puppet approved: "this looks great", especially the breathing and the lantern glow. The one note was a detached neck, now fixed, and the fit is saved in `art/cast/pip/rig.json`.

## What it cost

32 credits, against a cap of 100.

| Job | Model | Credits | Seconds |
|---|---|---|---|
| New master with the bigger coat | `seedream5_pro` | 5 | 114 |
| Puppet parts sheet | `seedream5_pro` | 5 | 123 |
| Fast painter test, Pip | `seedream5_flash` | 2 | 28 |
| Fast painter test, Pip | `seedream5_lite` | 4 | 66 |
| Fast painter test, Pip | `gemini_image3.1_flash` | 7 | 19 |
| New character, hedgehog | `seedream5_flash` | 2 | 24 |
| New character, hedgehog | `gemini_image3.1_flash` | 7 | 19 |

## Answers

- **Puppet:** yes. One prompt gave separate head, coat, arm, tail, legs and lantern, which cut out cleanly with `tools/cutout.py` at no credit cost. They're in `art/cast/pip/parts/`, and they join into a working puppet with code-driven acting.
- **Live painter:** `seedream5_flash`. It's the cheapest, under 30 s, and the closest match to the master. `gemini_image3.1_flash` is the fallback if we need under 20 s.
- **New characters:** the hedgehog looks like it belongs in the same book, using only a description and Wick as a style guide.

## What we learned

- **Ask for the design in the shape you need.** A "paper-doll parts sheet" with wide empty space between pieces is enough to get usable parts.
- **Pieces can touch through soft shadow.** Paper detection needs to go by color, not exact brightness, or halos and false joins appear. `tools/cutout.py` now does this.
- **Enclosed paper stays behind,** such as inside the lantern handle. The tool only removes paper joined to the border, so holes need a pass of their own. That one was fixed by hand for now.
- **The parts head faces forward,** while the master looks to the side. Pip will need a second head for profile acting.

## Still unproven

The puppet ran in a desktop browser, on a photo of your desk. It hasn't run on the Quest, and the other joints still need tuning.

## Reuse

`pip-master-v2` is Pip's master reference. The parts are product assets. The hedgehog can join the library, but it isn't part of the planned cast yet.
