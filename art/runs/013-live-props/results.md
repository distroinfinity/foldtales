# Run 013 results

**Status:** closed. The recipe works, and it's now the live painter's (`backend/src/storyteller/paint.ts`).

## What it cost

8 credits against a cap of 16 (shared balance 110,817 before, 110,809 after).

| Job | Model | Credits | Seconds |
|---|---|---|---|
| teapot | `seedream5_flash` | 2 | 23 |
| umbrella | `seedream5_flash` | 2 | 28 |
| mug | `seedream5_flash` | 2 | 28 |
| hat | `seedream5_flash` | 2 | 28 |

## Answers

- **Cut out in Node:** yes. All four cut into one piece each with `cutout.ts` (coverage 6.7% to 27.7%), none touching the border. The soft crimson shadows under the teapot and the hat go with the paper, and no magenta fringe is left. The mug's handle hole comes out clean.
- **Style:** yes. With the approved kite on magenta as Figure 1, flash holds the watercolour and pencil line, and each object reads at once as what was asked.
- **Time:** 23–28 s an image, so a character's trip to fetch it covers it.

## What we learned

- **One reference keeps the style for flash.** The kite on magenta paper is enough; no parts sheet needed for a single object.
- **"No kite" in the prompt** keeps the reference from being copied into the painting.
- **Magenta keying in Node:** treat a pixel as paper when red and blue are alike and well above green, scaled to the paper measured at the border. Blue, red, white, green and yellow paint all survive; pink and purple objects would not, which the prompt forbids.

## Reuse

The prompt template and the style reference are the live recipe. The four images are tests, not product assets; the headset judges the first live ones.
