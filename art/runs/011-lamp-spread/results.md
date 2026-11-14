# Run 011: the lamp spread, results

**Closed Nov 13, 2026.** Spent **64 credits** of the 120 cap the owner set while away: the key (5), six 2K layers and paintings (54) and the wick sheet (5). One job (the night sky) was first rejected before any spend: its reference was run 004's full 2720 px sky, over the API's 5 MB data limit, so it was retried with a 1376 px copy.

## What we made

- **`art/sets/the-lamp/`**: chapter 1's new opening spread, the top of the lighthouse up close. Sky, lamp room (193 mm), far railing, near ledge, and the gallery floor as the printed ground. `set.json` holds the lamp's lens as the beam's anchor, measured from the painting.
- **`lamp-lit.png`**: the lamp room lit, made free from its own glass (run 007's way): a soft rounded mask over the glazed band, so the dome and frame are untouched, and the alpha identical.
- **`art/sets/shore-path/layer-1-sky-night.png`**: a night sky with a moon and stars, so the shore no longer shares the gap's dusk sky. The gap keeps the dusk one.
- **`art/objects/lamp-wick/`**: the lamp's lost wick, a braided cotton curl singed at one end.

`make_lamp_spread.py` rebuilds all of it from this folder.

## What changed after painting

- **The sky came out as a panel about half the spread wide.** A mirrored copy behind it fills the width; most of it stands behind the lamp room.
- **The wick is white,** so run 006's sticker-rim stripper (which eats pale paper inward) would eat it. It's cut without that step, and without `trim_base`, which needs a flat base.
- **The wick painted finer than Pip's density** (7.4 px per mm at 66 mm), so it's kept as painted.

## What we learned

- **Reference images over 5 MB are rejected before any spend.** Downscale run 004's full-size layers before using them as a figure.
- **A close-up of a landmark from an earlier set keeps the book's style** when the earlier key is Figure 1.
- **Still to judge in the headset:** the lamp spread at book distance, the lit lamp, and whether the shore's night sky reads as a new place.
