# Run 001 results

**Status:** closed. Chosen painter: `seedream5_pro`. It's the cheapest of the four at 5 credits, and its slower speed doesn't matter for art made ahead of time. Run 002 tests faster painters for art made during a session.

## What it cost

135 credits, against a cap of 1,000. Credits and seconds per image, measured:

| Model | Credits | Seconds |
|---|---|---|
| `gen4_image` (1024) | 8 | 23–27 |
| `gemini_image3_pro` (1024) | 20 | 22–23 |
| `seedream5_pro` (1024) | 5 | 104–116 |
| `gpt_image_2_5_flare` (1920, high) | 12 | 32–43 |

## What we learned

- **Design references work.** Three of the four models kept the approved designs from rough sketches, so a sketch plus a description is enough to direct the art.
- **Reference images have limits.** `gen4_image` rejects references wider than about 2.36:1, so `refs/moth-square.png` pads the Moth sketch.
- **The docs' top prices were well above real cost.** `gpt_image_2_5_flare` at high quality cost 12 credits, against a listed range of up to 75.
- **The same style text works across models,** with one exception: `gen4_image` drifted toward ink and added a paper border.
- **"Far too big" needs stronger wording.** Most models made Pip's coat fit too well, so the prompt should describe sleeves past the paws and a hem on the ground.

## Reuse

Chosen paintings become master references. All 12 stay here, so none needs regenerating.
