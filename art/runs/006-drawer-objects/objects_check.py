"""Checks that run 006's objects are fit to ship. Arrays are uint8 RGBA. Each check returns problems, one string each; empty passes."""
import json
from pathlib import Path

import numpy as np

# Pip's own density: his rig is 905 px tall for 170 mm, so objects resampled to it get his line weight.
PX_PER_MM = 905 / 170
MIN_GRAB_MM = 64
MIN_SIDE_MM = 20
MAX_SCALE_SPREAD = 1.6
MAGENTA_LIMIT = 0.001
TAGS_FILE = Path(__file__).resolve().parents[3] / "contracts" / "data" / "tags.json"


def painted_box(rgba, threshold=127):
    """(top, bottom, left, right) of the painted pixels, inclusive."""
    ys, xs = np.nonzero(rgba[..., 3] > threshold)
    return int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())


def magenta_residue(rgba):
    """Problems if paper magenta survives inside the piece: run 004's clear_magenta test, over painted pixels."""
    solid = rgba[..., 3] > 127
    r, g, b = [rgba[..., i].astype(int) for i in range(3)]
    share = float(((r - g > 70) & (b - g > 25) & solid).sum() / max(1, solid.sum()))
    return [f"magenta:{share:.4f}"] if share > MAGENTA_LIMIT else []


def size_problems(width_px, height_px, height_m):
    """Problems with an object's real size: the longest side is the grab floor, and nothing is a sliver."""
    height_mm = height_m * 1000
    width_mm = height_mm * width_px / height_px
    problems = []
    if max(width_mm, height_mm) < MIN_GRAB_MM:
        problems.append(f"under {MIN_GRAB_MM} mm: {max(width_mm, height_mm):.0f}")
    if min(width_mm, height_mm) < MIN_SIDE_MM:
        problems.append(f"sliver: {min(width_mm, height_mm):.0f} mm")
    return problems


def target_height_px(height_m):
    return round(height_m * 1000 * PX_PER_MM)


def upscale_problems(painted_height_px, height_m):
    """A piece painted smaller than its target would be blurred by resizing, so that's a problem, never a resize."""
    target = target_height_px(height_m)
    return [f"upscale: {painted_height_px} px painted, {target} needed"] if painted_height_px < target else []


def scale_spread(sheet_px_per_mm):
    """Largest over smallest sheet density across the objects. Near 1 means they were painted at one scale."""
    values = list(sheet_px_per_mm.values())
    return max(values) / min(values)


def spread_problems(sheet_px_per_mm):
    spread = scale_spread(sheet_px_per_mm)
    return [f"scale spread {spread:.2f}"] if spread > MAX_SCALE_SPREAD else []


def pivot_problems(rgba, pivot):
    """The pivot is a percentage of the image. A paw can't hold a hole, so it must land on paint."""
    h, w = rgba.shape[:2]
    x = min(w - 1, int(round(pivot[0] / 100 * (w - 1))))
    y = min(h - 1, int(round(pivot[1] / 100 * (h - 1))))
    return [] if rgba[y, x, 3] > 127 else [f"pivot {pivot} is not on paint"]


def known_tags():
    return {t["id"] for t in json.loads(TAGS_FILE.read_text())}


def tag_problems(tags, vocabulary=None):
    vocabulary = known_tags() if vocabulary is None else vocabulary
    return [f"unknown tag: {t}" for t in tags if t not in vocabulary]


def piece_count_problems(found, expected):
    return [] if found == expected else [f"pieces: {found}, expected {expected}"]


MIN_PAINT_KEPT = 0.97


def raw_paint(rgba, paper_rgb, tolerance=40):
    """Painted pixels of a raw cut: opaque and not the paper trapped inside it (between rungs, inside a bow)."""
    near = np.abs(rgba[..., :3].astype(int) - paper_rgb).max(axis=2) <= tolerance
    return (rgba[..., 3] > 127) & ~near


def preservation_problems(raw, finished, paper_rgb):
    """Finishing may clear paper, never paint. Both arrays are on the same canvas, before any crop or resize."""
    paint = raw_paint(raw, paper_rgb)
    kept = float((paint & (finished[..., 3] > 127)).sum() / max(1, paint.sum()))
    problems = [f"paint kept {kept:.3f}"] if kept < MIN_PAINT_KEPT else []
    ys, xs = np.nonzero(paint)
    top, bottom, left, right = painted_box(finished)
    if top > ys.min() + 2 or bottom < ys.max() - 2 or left > xs.min() + 2 or right < xs.max() - 2:
        problems.append("painted box shrank")
    return problems


def invocation_cap(spent, total, largest):
    """capCredits for one generate.mjs invocation. The tool starts a job while its own spend is below capCredits,
    so this lets a job start only if it still fits inside the run's total."""
    cap = total - spent - largest + 1
    if cap < 1:
        raise ValueError(f"{total - spent} of {total} left, not enough for a {largest}-credit job")
    return cap
