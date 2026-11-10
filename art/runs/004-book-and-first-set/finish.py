"""One-off finishing steps for run 004's cut pieces. Arrays are uint8 RGBA unless noted."""
import numpy as np
from PIL import Image
from scipy import ndimage as ni

SOLID_ALPHA = 200
PAGE = (246, 239, 226)


def remove_specks(rgba, max_area=200):
    """Clear separate bits of paint smaller than max_area, such as trapped paper flecks."""
    out = rgba.copy()
    labels, count = ni.label(out[..., 3] > 40)
    if count:
        sizes = ni.sum(np.ones(labels.shape), labels, range(1, count + 1))
        small = np.isin(labels, 1 + np.nonzero(sizes < max_area)[0])
        out[small, 3] = 0
    return out


def clear_enclosed(rgba, paper_rgb, tolerance=40, min_area=200):
    """Clear pools of paper trapped inside a piece. Flecks smaller than min_area are paint, and stay."""
    out = rgba.copy()
    near = np.abs(out[..., :3].astype(int) - paper_rgb).max(axis=2) <= tolerance
    labels, count = ni.label(near & (out[..., 3] > 0))
    if count:
        sizes = ni.sum(np.ones(labels.shape), labels, range(1, count + 1))
        pools = np.isin(labels, 1 + np.nonzero(sizes >= min_area)[0])
        out[ni.binary_dilation(pools), 3] = 0
    return out


def despill(rgba, paper_rgb, band=3):
    """Pull the paper's hue out of the pixels just inside the cut edge."""
    out = rgba.copy()
    mask = out[..., 3] > 127
    edge = mask & ~ni.binary_erosion(mask, iterations=band)
    paper = np.array(paper_rgb, float)
    hue = paper - paper.mean()
    colors = out[edge, :3].astype(float)
    chroma = colors - colors.mean(axis=1, keepdims=True)
    amount = np.maximum((chroma * hue).sum(axis=1) / (hue * hue).sum(), 0)
    out[edge, :3] = np.clip(colors - amount[:, None] * hue, 0, 255).round().astype("uint8")
    return out


def clear_magenta(rgba):
    """Clear any leftover vivid magenta, including shadow on the paper, without touching rust or gold."""
    out = rgba.copy()
    r, g, b = [out[..., i].astype(int) for i in range(3)]
    out[(r - g > 70) & (b - g > 25), 3] = 0
    return out


def clear_connected(rgba, candidate):
    """Clear candidate pixels that connect to the outside of the piece, keeping enclosed ones."""
    out = rgba.copy()
    outside = out[..., 3] == 0
    labels, _ = ni.label(candidate | outside)
    touching = np.unique(labels[outside])
    out[np.isin(labels, touching[touching > 0])] = 0
    return out


def clear_white_fringe(rgba, paper_rgb, tolerance=14):
    """Eat paper-white flecks inward from the outside, stopping at the first real color."""
    out = rgba
    near = np.abs(out[..., :3].astype(int) - paper_rgb).max(axis=2) <= tolerance
    return clear_connected(out, near)


def _box(rgba, threshold=127):
    ys, xs = np.nonzero(rgba[..., 3] > threshold)
    return ys.min(), ys.max(), xs.min(), xs.max()


def trim_base(rgba, solid=0.9):
    """Cut the bottom at the lowest row whose paint covers at least `solid` of the painted width."""
    _, _, left, right = _box(rgba, SOLID_ALPHA)
    filled = (rgba[..., 3] > SOLID_ALPHA).sum(axis=1)
    rows = np.nonzero(filled >= solid * (right - left + 1))[0]
    return rgba[: rows.max() + 1].copy()


def center_on_canvas(rgba, canvas_width):
    """Keep the painted columns, and center them on a canvas of canvas_width."""
    _, _, left, right = _box(rgba, 0)
    painted = rgba[:, left : right + 1]
    if painted.shape[1] > canvas_width:
        raise ValueError(f"painted width {painted.shape[1]} is wider than canvas {canvas_width}")
    out = np.zeros((rgba.shape[0], canvas_width, 4), "uint8")
    start = (canvas_width - painted.shape[1]) // 2
    out[:, start : start + painted.shape[1]] = painted
    return out


def calibrate_paper(rgb, target=PAGE, margin=0.03):
    """Scale each channel so the outer margin's median becomes the page color. Takes and returns RGB."""
    h, w, _ = rgb.shape
    edge_y, edge_x = max(1, int(h * margin)), max(1, int(w * margin))
    border = np.concatenate((rgb[:edge_y].reshape(-1, 3), rgb[-edge_y:].reshape(-1, 3), rgb[:, :edge_x].reshape(-1, 3), rgb[:, -edge_x:].reshape(-1, 3)))
    gain = np.array(target, float) / np.median(border, axis=0)
    return np.clip(rgb * gain, 0, 255).round().astype("uint8")


def _chin(rgba):
    """Where a head seats in its collar: the center of its lowest tenth of painted rows."""
    top, bottom, _, _ = _box(rgba)
    start = bottom - max(1, int((bottom - top + 1) * 0.1)) + 1
    ys, xs = np.nonzero(rgba[start : bottom + 1, :, 3] > 127)
    return xs.mean(), ys.mean() + start


def register_head(new, forward):
    """Return uniform scale and integer dx, dy that seat `new` on the forward head's chin."""
    _, _, new_left, new_right = _box(new)
    _, _, fwd_left, fwd_right = _box(forward)
    scale = (fwd_right - fwd_left + 1) / (new_right - new_left + 1)
    new_x, new_y = _chin(new)
    fwd_x, fwd_y = _chin(forward)
    return scale, int(round(fwd_x - new_x * scale)), int(round(fwd_y - new_y * scale))


def fit_lantern(new, lit):
    """Resample `new` onto lit's canvas so their painted boxes coincide."""
    new_top, new_bottom, new_left, new_right = _box(new)
    top, bottom, left, right = _box(lit)
    size = (right - left + 1, bottom - top + 1)
    piece = Image.fromarray(new[new_top : new_bottom + 1, new_left : new_right + 1]).resize(size, Image.LANCZOS)
    out = np.zeros(lit.shape, "uint8")
    out[top : bottom + 1, left : right + 1] = np.asarray(piece)
    return out


def outline_error(a, b):
    """Largest difference between two pieces' outlines on the same canvas, in pixels."""
    a_mask, b_mask = a[..., 3] > 127, b[..., 3] > 127
    worst = 0
    for row in range(a_mask.shape[0]):
        a_cols, b_cols = np.nonzero(a_mask[row])[0], np.nonzero(b_mask[row])[0]
        if a_cols.size and b_cols.size:
            worst = max(worst, abs(int(a_cols.min()) - int(b_cols.min())), abs(int(a_cols.max()) - int(b_cols.max())))
    a_top, a_bottom, _, _ = _box(a)
    b_top, b_bottom, _, _ = _box(b)
    return max(worst, abs(int(a_top) - int(b_top)), abs(int(a_bottom) - int(b_bottom)))
