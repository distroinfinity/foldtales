"""Cuts painted pieces off plain paper into transparent PNGs, with no credits spent.

Usage: python3 art/tools/cutout.py [--seal=N] <image> <out-dir> [name ...]
Pieces are named in reading order (top to bottom, then left to right) when names are given.
--seal=N stops paper leaking through gaps up to about 2N pixels wide in a pencil line, for pale pieces.
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

MIN_PIECE_FRACTION = 0.0005
PAPER_BRIGHTNESS_MARGIN = 50
PAPER_MAX_COLOR = 22
FEATHER_RADIUS = 0.8


def paper_mask(rgb, seal=0):
    """Pixels joined to the image border that are close to the paper color."""
    h, w, _ = rgb.shape
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]))
    paper = np.median(border, axis=0)
    # Remove the paper's own tint, so cream paper is treated the same as white.
    neutral = rgb.astype(int) - (paper - paper.mean()).round().astype(int)
    high = neutral.max(axis=2)
    low = neutral.min(axis=2)
    # Paper keeps its brightness and stays nearly colorless, even where it's lightly shaded around a figure.
    similar = (high >= paper.mean() - PAPER_BRIGHTNESS_MARGIN) & (high - low <= PAPER_MAX_COLOR)
    allowed = similar
    if seal:
        allowed = np.asarray(Image.fromarray(similar).filter(ImageFilter.MinFilter(2 * seal + 1))).astype(bool)
    similar_all, similar = similar, allowed
    seen = np.zeros((h, w), bool)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if similar[y, x] and not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if similar[y, x] and not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and similar[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    if seal:
        grown = np.asarray(Image.fromarray(seen).filter(ImageFilter.MaxFilter(2 * seal + 1))).astype(bool)
        seen = grown & similar_all
    return seen


def pieces(foreground):
    """Connected foreground regions, largest noise removed."""
    h, w = foreground.shape
    labels = np.zeros((h, w), int)
    found = []
    for sy, sx in zip(*np.nonzero(foreground)):
        if labels[sy, sx]:
            continue
        label = len(found) + 1
        labels[sy, sx] = label
        queue = deque([(sy, sx)])
        ys, xs = [sy], [sx]
        while queue:
            y, x = queue.popleft()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and foreground[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = label
                    queue.append((ny, nx))
                    ys.append(ny)
                    xs.append(nx)
        found.append((label, len(ys), min(ys), max(ys), min(xs), max(xs)))
    keep = [p for p in found if p[1] >= MIN_PIECE_FRACTION * h * w]
    return labels, keep


def main():
    args = sys.argv[1:]
    seal = int(args.pop(0).split("=")[1]) if args and args[0].startswith("--seal=") else 0
    image, out_dir, *names = args
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    source = Image.open(image).convert("RGB")
    rgb = np.asarray(source)
    labels, keep = pieces(~paper_mask(rgb, seal))
    keep.sort(key=lambda p: (round(p[2] / (rgb.shape[0] / 3)), p[4]))
    for index, (label, area, top, bottom, left, right) in enumerate(keep):
        alpha = Image.fromarray(((labels == label) * 255).astype("uint8")).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(FEATHER_RADIUS))
        piece = source.copy()
        piece.putalpha(alpha)
        pad = 4
        box = (max(left - pad, 0), max(top - pad, 0), min(right + pad + 1, rgb.shape[1]), min(bottom + pad + 1, rgb.shape[0]))
        name = names[index] if index < len(names) else f"piece-{index}"
        piece.crop(box).save(out / f"{name}.png")
        print(f"{name}: area {area}, box {box}")


if __name__ == "__main__":
    main()
