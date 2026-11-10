"""Checks that run 004's sheets and cut pieces are fit to ship."""
from pathlib import Path

import numpy as np
from scipy import ndimage as ni

MOODS = {"dusk": (0.86, 0.90, 1.00), "night": (0.45, 0.55, 0.70), "gold": (1.00, 0.88, 0.66)}
SPECK_AREA = 200
HALO_LIMIT = 0.05


def border_is_paper(rgb, tolerance=30):
    """True when the image's border is one even paper and something is painted inside it."""
    h, w, _ = rgb.shape
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1])).astype(int)
    paper = np.median(border, axis=0)
    if (np.abs(border - paper).max(axis=1) <= tolerance).mean() < 0.97:
        return False
    inset_y, inset_x = max(1, h // 50), max(1, w // 50)
    interior = rgb[inset_y:-inset_y, inset_x:-inset_x].astype(int)
    return bool((np.abs(interior - paper).max(axis=2) > tolerance).mean() >= 0.05)


def check_cut(rgba, min_w, min_h, paper_rgb=None):
    """Problems with a cut piece, one string each. Empty means it passes."""
    if rgba.shape[2] != 4:
        return ["no alpha"]
    problems = []
    mask = rgba[..., 3] > 40
    labels, count = ni.label(mask)
    sizes = ni.sum(mask, labels, range(1, count + 1)) if count else np.array([])
    big, small = int((sizes >= SPECK_AREA).sum()), int((sizes < SPECK_AREA).sum())
    if big != 1:
        problems.append(f"pieces:{big}")
    if small:
        problems.append(f"specks:{small}")
    if count:
        ys, xs = np.nonzero(mask)
        if xs.max() - xs.min() + 1 < min_w or ys.max() - ys.min() + 1 < min_h:
            problems.append("small")
    if paper_rgb is not None and count:
        solid = rgba[..., 3] > 200
        band = solid & ~ni.binary_erosion(solid, iterations=3)
        near = np.abs(rgba[band, :3].astype(int) - paper_rgb).max(axis=1) <= 30
        if near.mean() > HALO_LIMIT:
            problems.append(f"halo:{near.mean():.2f}")
    return problems


def check_layer(rgba, hinge_mm, max_h_mm, px_per_mm):
    """check_cut, plus whether a layer stands on a straight base, folds onto the page and sits on the spine."""
    problems = check_cut(rgba, 1, 1)
    ys, xs = np.nonzero(rgba[..., 3] > 127)
    height_mm = (rgba.shape[0] - ys.min()) / px_per_mm
    if height_mm > max_h_mm or height_mm > hinge_mm:
        problems.append("too tall")
    if (rgba[-1, :, 3] > 200).sum() < 0.85 * (xs.max() - xs.min() + 1):
        problems.append("base")
    if abs((xs.min() + xs.max() + 1) / 2 - rgba.shape[1] / 2) > rgba.shape[1] * 0.01:
        problems.append("off center")
    return problems


def _lightness(rgb):
    c = np.asarray(rgb, float).reshape(-1, 3) / 255
    linear = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    y = (linear * np.array([0.2126, 0.7152, 0.0722])).sum(axis=1)
    return float(np.mean(np.where(y > 0.008856, 116 * np.cbrt(y) - 16, 903.3 * y)))


def value_margin(backdrop_rgb, coat_rgb):
    """How much lighter the backdrop is than the coat, in L*."""
    return _lightness(backdrop_rgb) - _lightness(coat_rgb)


def cut_count(out_dir):
    return len(list(Path(out_dir).glob("*.png")))
