"""The lit lamp room, made free from the headland's own painting. Keeps its outline exactly, and turns pale glass gold."""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ni

ART = Path(__file__).resolve().parents[2]
HEADLAND = ART / "sets" / "shore-path" / "layer-2-headland.png"
# The lamp room on the 2720 px headland: the card, and the glass inside it, as (top, bottom, left, right).
CARD = (70, 215, 540, 745)
GLASS = (120, 190, 592, 705)
DEEP, BRIGHT = np.array([196, 124, 44], float), np.array([255, 226, 150], float)


def smooth(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def lit_card():
    """(original crop, lit crop, glass box relative to the crop)."""
    top, bottom, left, right = CARD
    crop = np.asarray(Image.open(HEADLAND).convert("RGBA"))[top:bottom, left:right].copy()
    g_top, g_bottom, g_left, g_right = GLASS
    box = (g_top - top, g_bottom - top, g_left - left, g_right - left)
    rgb = crop[..., :3].astype(float)
    lum = rgb.mean(axis=2)
    inside = np.zeros(lum.shape, bool)
    inside[box[0] : box[1], box[2] : box[3]] = True
    # Glass is everything in the box lighter than the iron bars, and the bars stay as they are.
    glass = ni.gaussian_filter(smooth(62, 92, lum) * inside, 0.8)
    # Brightest at the lens, low in the middle of the panes, so it reads as a flame rather than a filled box.
    yy, xx = np.mgrid[: lum.shape[0], : lum.shape[1]]
    cy, cx = box[0] + (box[1] - box[0]) * 0.62, (box[2] + box[3]) / 2
    heart = np.exp(-(((xx - cx) / 42) ** 2 + ((yy - cy) / 30) ** 2))
    tone = np.clip(smooth(70, 215, lum) * 0.55 + heart * 0.75, 0, 1)[..., None]
    gold = DEEP * (1 - tone) + BRIGHT * tone
    out = rgb * (1 - glass[..., None]) + gold * glass[..., None]
    # Warm the iron and stone right around the glass a little: light spilling onto its frame.
    spill = ni.gaussian_filter(inside.astype(float), 9)[..., None] * (1 - glass[..., None]) * 0.42
    out = out * (1 - spill) + (out * np.array([1.32, 1.05, 0.62])) * spill
    lit = crop.copy()
    lit[..., :3] = np.clip(out, 0, 255).round().astype("uint8")
    return crop, lit, box


if __name__ == "__main__":
    import sys
    a, b, _ = lit_card()
    pair = Image.new("RGB", (a.shape[1] * 2 * 3 + 30, a.shape[0] * 3), (60, 80, 120))
    for i, x in enumerate((a, b)):
        im = Image.fromarray(x).resize((x.shape[1] * 3, x.shape[0] * 3), Image.LANCZOS)
        pair.paste(im, (i * (x.shape[1] * 3 + 30), 0), im)
    pair.save(sys.argv[1])
