"""Checks that run 007's pieces are fit to ship. Arrays are uint8 RGBA unless noted. Each check returns problems, one string each; empty passes."""
import numpy as np
from scipy import ndimage as ni

# Set layers are at run 004's density, puppet-scale pieces at Pip's.
SET_PX_PER_MM = 2720 / 420
PIECE_PX_PER_MM = 905 / 170
SOCK_MM = 90
MIN_BEARING_MM = 10
MIN_GAP_MM = SOCK_MM + 2
MAX_RIM_OVER_MM, MAX_RIM_BACK_MM = 6, 12
RIM_SETBACK_MM = 4
MIN_SQUEEZE, MAX_SQUEEZE = 0.75, 1.05
MIN_SAND_SCALE, MAX_WATER_SCALE = 0.8, 3.0
PAGE = (246, 239, 226)
MAX_OFF_CENTER_MM = 12
SPINE_CLEAR_MM = 35
MIN_BASE_COVER = 0.85
TRAY_ASPECT_LIMIT, STRIP_ASPECT_LIMIT = 0.12, 0.25
MIN_LAMP_CHANGED = 0.40


def luminance(rgb):
    return rgb[..., :3].astype(float).mean(axis=-1)


def measure_gap(rgb, top_row, bottom_row, dark_share=0.6):
    """The chasm on the printed ground, in image columns: (left, right) of the dark band holding the center.
    Columns are averaged over the rows at Pip's depth, and dark means below dark_share of the median sand."""
    columns = luminance(rgb[top_row:bottom_row]).mean(axis=0)
    w = columns.size
    sand = np.median(np.concatenate((columns[w // 8 : w // 3], columns[2 * w // 3 : 7 * w // 8])))
    dark = columns < dark_share * sand
    labels, count = ni.label(dark)
    if not count:
        return None
    centers = [np.nonzero(labels == i + 1)[0] for i in range(count)]
    best = min(centers, key=lambda c: min(abs(int(c.min()) - w // 2), abs(int(c.max()) - w // 2)) if not c.min() <= w // 2 <= c.max() else -1)
    return int(best.min()), int(best.max())


def painted_length_mm(rgba, height_mm):
    """How long a piece's painted part really is, since its heightM includes the PNG's transparent padding."""
    rows = np.nonzero((rgba[..., 3] > 127).any(axis=1))[0]
    return (rows.max() - rows.min() + 1) * height_mm / rgba.shape[0]


def gap_problems(left_px, right_px, width_px, ladder_mm, width_mm=420):
    """The gap must be wider than the sock, leave the painted ladder resting on both rims, and sit on the spine."""
    per_mm = width_px / width_mm
    gap = (right_px - left_px + 1) / per_mm
    off = abs((left_px + right_px + 1) / 2 - width_px / 2) / per_mm
    ceiling = ladder_mm - 2 * MIN_BEARING_MM
    problems = []
    if not MIN_GAP_MM <= gap <= ceiling:
        problems.append(f"gap {gap:.0f} mm, wanted {MIN_GAP_MM}-{ceiling:.0f}")
    if off > MAX_OFF_CENTER_MM:
        problems.append(f"gap {off:.0f} mm off the spine")
    return problems


def caption_band_problems(rgb, band_share=1 / 7, tolerance=40):
    """The bottom band carries captions, so it must stay bare page color. Checked after calibrate_paper."""
    band = rgb[-int(rgb.shape[0] * band_share) :].astype(int)
    share = float((np.abs(band - np.array(PAGE)).max(axis=2) > tolerance).mean())
    return [f"caption band {share:.2f} painted"] if share > 0.02 else []


def pieces_of(rgba, min_area=200):
    labels, count = ni.label(rgba[..., 3] > 40)
    if not count:
        return labels, []
    sizes = ni.sum(np.ones(labels.shape), labels, range(1, count + 1))
    return labels, [i + 1 for i, s in enumerate(sizes) if s >= min_area]


def rim_problems(rgba, max_h_mm, px_per_mm=SET_PX_PER_MM):
    """A two-bluff layer on its full canvas: two pieces, flat bases, clear of the spine and the canvas sides, under its height limit."""
    h, w = rgba.shape[:2]
    labels, big = pieces_of(rgba)
    problems = [] if len(big) == 2 else [f"pieces:{len(big)}"]
    for i in big:
        ys, xs = np.nonzero(labels == i)
        if xs.min() == 0 or xs.max() == w - 1:
            problems.append("touches the canvas side")
        painted = xs.max() - xs.min() + 1
        if (rgba[-1, xs.min() : xs.max() + 1, 3] > 200).sum() < MIN_BASE_COVER * painted:
            problems.append("base")
    ys, _ = np.nonzero(rgba[..., 3] > 127)
    if ys.size and (h - ys.min()) / px_per_mm > max_h_mm:
        problems.append(f"too tall: {(h - ys.min()) / px_per_mm:.0f} mm")
    clear = int(SPINE_CLEAR_MM * px_per_mm)
    if (rgba[:, w // 2 - clear : w // 2 + clear, 3] > 40).any():
        problems.append("paint at the spine")
    return problems


def bluff_squeeze(outer_mm, inner_mm, chasm_edge_mm):
    """How much to scale a bluff across, holding its outer end, so its inner edge lands RIM_SETBACK_MM back from the
    printed chasm. All distances are mm from the spine. Run 007's painter made the gap far too narrow."""
    return (outer_mm - chasm_edge_mm - RIM_SETBACK_MM) / (outer_mm - inner_mm)


def squeeze_problems(k):
    return [] if MIN_SQUEEZE <= k <= MAX_SQUEEZE else [f"squeeze {k:.2f}"]


def column_map_problems(src_mm, dst_mm, water):
    """A remap of the ground's columns: knots in mm from the spine, both increasing. Sand may narrow a little,
    and only the water segment (an index pair) may widen much."""
    problems = []
    for i in range(len(src_mm) - 1):
        k = (dst_mm[i + 1] - dst_mm[i]) / (src_mm[i + 1] - src_mm[i])
        limit = MAX_WATER_SCALE if (i, i + 1) == water else 1.4
        if not MIN_SAND_SCALE <= k <= limit:
            problems.append(f"segment {src_mm[i]}..{src_mm[i + 1]} scaled {k:.2f}")
    if src_mm[0] != dst_mm[0] or src_mm[-1] != dst_mm[-1]:
        problems.append("the page edges moved")
    return problems


def remap_columns(rgb, src_mm, dst_mm, width_mm=420):
    """Resample an image's columns along a piecewise-linear map from src to dst knots, the same for every row."""
    w = rgb.shape[1]
    per_mm = w / width_mm
    out_mm = (np.arange(w) + 0.5) / per_mm - width_mm / 2
    src_x = (np.interp(out_mm, dst_mm, src_mm) + width_mm / 2) * per_mm - 0.5
    x0 = np.clip(np.floor(src_x).astype(int), 0, w - 1)
    x1 = np.clip(x0 + 1, 0, w - 1)
    t = (src_x - x0)[None, :, None]
    out = rgb[:, x0].astype(float) * (1 - t) + rgb[:, x1].astype(float) * t
    return np.clip(out, 0, 255).round().astype("uint8")


def inner_edges_mm(rgba, px_per_mm=SET_PX_PER_MM):
    """Distance from the spine to each bluff's inner edge, along the base row: (left bluff, right bluff), in mm."""
    w = rgba.shape[1]
    cols = np.nonzero(rgba[-1, :, 3] > 200)[0]
    left, right = cols[cols < w / 2], cols[cols >= w / 2]
    if not left.size or not right.size:
        return None
    return (w / 2 - left.max() - 1) / px_per_mm, (right.min() - w / 2) / px_per_mm


def rim_agreement_problems(edges_mm, ground_left_mm, ground_right_mm):
    """Each inner edge against the printed chasm's own edge at this hinge depth, all in mm from the spine.
    A rim may overhang the chasm a little, or stand back from it, but not by much."""
    if edges_mm is None:
        return ["no inner edges"]
    problems = []
    for name, edge, chasm in (("left", edges_mm[0], ground_left_mm), ("right", edges_mm[1], ground_right_mm)):
        back = edge - chasm
        if not -MAX_RIM_OVER_MM <= back <= MAX_RIM_BACK_MM:
            problems.append(f"{name} rim {back:+.0f} mm from the chasm")
    return problems




def aspect_problems(width_px, height_px, want_w, want_h, limit):
    """How far a painted piece's shape is from its target, as the share a non-uniform resize would have to fix."""
    off = abs((width_px / height_px) / (want_w / want_h) - 1)
    return [f"aspect off by {off:.2f}"] if off > limit else []


def upscale_problems(painted_w, painted_h, want_w, want_h):
    """Never upscale: a piece painted smaller than its target would blur."""
    return [f"upscale: {painted_w}x{painted_h} painted, {want_w}x{want_h} needed"] if painted_w < want_w or painted_h < want_h else []


def _below_wall_outside(x0, y0, x1, y1, half, wall_mm):
    """Whether any part of a card edge lower than the wall's top lies outside the tray. A corner test alone misses
    an edge that crosses the wall while its outer corner is already above it."""
    if min(y0, y1) >= wall_mm:
        return False
    if y0 > wall_mm or y1 > wall_mm:
        t = (wall_mm - y0) / (y1 - y0)
        xt = x0 + t * (x1 - x0)
        if y0 > wall_mm:
            x0 = xt
        else:
            x1 = xt
    return max(abs(x0), abs(x1)) > half + 0.01


def drawer_problems(slots, interior_w_mm, interior_d_mm, clearance_mm, wall_mm=26):
    """The stow, in the tray's own mm: x from the interior's center, z from its back wall. Each slot has id, length
    (painted long axis), width, flat_x (center while lying flat, long axis across the tray), stand_x (center when
    upright), plane_z (its own vertical plane) and turn (+1 or -1, the way it swings, so its low end moves inward). It lies flat, tips onto its long edge, then swings upright in its
    plane, sliding from flat_x to stand_x with its lowest point on the floor. Above the walls nothing can catch."""
    problems = []
    half = interior_w_mm / 2
    if len({s["plane_z"] for s in slots}) != len(slots):
        problems.append("two objects share a plane")
    if clearance_mm <= 0:
        problems.append("interior doesn't clear the book edge at full travel")
    for s in slots:
        if abs(s["flat_x"]) + s["length"] / 2 > half:
            problems.append(f"{s['id']}: flat past the tray's sides")
        # It tips up about its rear long edge, so flat it covers plane_z to plane_z + width.
        if s["plane_z"] < 0 or s["plane_z"] + s["width"] > interior_d_mm:
            problems.append(f"{s['id']}: past the tray's depth")
        if abs(s["stand_x"]) + s["width"] / 2 > half:
            problems.append(f"{s['id']}: upright past the tray's sides")
        for deg in range(0, 91, 5):
            t = np.radians(deg)
            cos, sin = np.cos(t), np.sin(t)
            x_c = s["flat_x"] + (s["stand_x"] - s["flat_x"]) * deg / 90
            y_c = s["length"] / 2 * sin + s["width"] / 2 * cos  # lifted so its lowest corner is on the floor
            corners = []
            for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                x = x_c + s["turn"] * (a * s["length"] / 2 * cos - b * s["width"] / 2 * sin)
                corners.append((x, y_c + a * s["length"] / 2 * sin + b * s["width"] / 2 * cos))
            if min(c[1] for c in corners) < -0.01:
                problems.append(f"{s['id']}: below the floor at {deg} degrees")
            for (x0, y0), (x1, y1) in zip(corners, corners[1:] + corners[:1]):
                if _below_wall_outside(x0, y0, x1, y1, half, wall_mm):
                    problems.append(f"{s['id']}: through a wall at {deg} degrees")
    return sorted(set(problems))


def lamp_problems(original, lit, glass_box):
    """The lit card keeps the headland's outline exactly, and really does change the glass."""
    problems = []
    if not np.array_equal(original[..., 3], lit[..., 3]):
        problems.append("alpha changed")
    top, bottom, left, right = glass_box
    region = np.abs(original[top:bottom, left:right, :3].astype(int) - lit[top:bottom, left:right, :3]).max(axis=2) > 12
    if float(region.mean()) < MIN_LAMP_CHANGED:
        problems.append(f"glass changed {float(region.mean()):.2f}")
    return problems


def spent_for_cap(listed, observed_drop):
    """What an invocation counts as toward the cap. The tool logs only finished jobs, so an interrupted one can
    charge with no log line. The larger of list price and the balance drop can't under-count it."""
    return max(listed, observed_drop)


MAX_IN_FRONT_OF_PIP_MM = 45


def height_over_mm(rgba, from_mm, to_mm, px_per_mm=SET_PX_PER_MM):
    """The tallest paint between two x positions, in mm from the spine, as a height above the layer's base."""
    w = rgba.shape[1]
    lo, hi = int(w / 2 + from_mm * px_per_mm), int(w / 2 + to_mm * px_per_mm)
    rows = np.nonzero((rgba[:, lo:hi, 3] > 127).any(axis=1))[0]
    return 0.0 if not rows.size else (rgba.shape[0] - rows.min()) / px_per_mm


def in_front_of_pip_problems(rgba, from_mm, to_mm):
    """The near rim may be tall at the page's ends, but where Pip stands it must stay low enough to show his legs."""
    h = height_over_mm(rgba, from_mm, to_mm)
    return [f"{h:.0f} mm in front of Pip"] if h > MAX_IN_FRONT_OF_PIP_MM else []


def deep_shadow(rgba):
    """The paper's shadow and tint on this run's sheets: a deep crimson such as (64, 11, 13), whose blue isn't above
    its green so run 006's shadow_tint misses it, and purple-pink fringe such as (70, 37, 61) or (197, 130, 134).
    Nothing painted here has red and blue both above green: wood, hemp, leather and rock run red over green over
    blue, the felt is green, and pencil is grey."""
    r, g, b = [rgba[..., i].astype(int) for i in range(3)]
    return ((r - g > 25) & (g < 30) & (b < 45)) | ((r - g > 20) & (b - g > 3))


def without_deep_shadow(rgba):
    """A raw cut with its deep shadow made transparent, for run 006's preservation check."""
    out = rgba.copy()
    out[deep_shadow(rgba), 3] = 0
    return out


def raw_for_preservation(rgba):
    """A raw cut as run 006's preservation check should see it: no deep shadow, and no specks or slivers under 3 px at the edge,
    which are fringe rather than paint and would otherwise flag a box that shrank by a pixel or two."""
    out = without_deep_shadow(rgba)
    solid = out[..., 3] > 127
    out[solid & ~ni.binary_opening(solid, structure=np.ones((3, 3), bool)), 3] = 0
    return out
