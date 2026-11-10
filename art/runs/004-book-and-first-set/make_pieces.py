"""Cuts, cleans and names run 004's pieces. Run from the repo root: python3 art/runs/004-book-and-first-set/make_pieces.py"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ni

RUN = Path(__file__).resolve().parent
sys.path.insert(0, str(RUN))
import checks  # noqa: E402
import finish  # noqa: E402

ART = RUN.parents[1]
CUTOUT = ART / "tools" / "cutout.py"
PX_PER_MM = 2720 / 420
LAYERS = [
    ("layer-1-sky", "layer-1-sky", 295, 236),
    ("layer-2-headland", "layer-2-headland-v2", 250, 200),
    ("layer-3-dunes", "layer-3-dunes", 215, 120),
    ("layer-4-foreground", "layer-4-foreground-v2", 115, 115),
]
# Where each piece sits on the trims sheet, as (x, y) of its center.
TRIMS = {"ribbon": (604, 1007), "tab-gold": (334, 1367), "tab-sage": (360, 1685), "drawer-pull": (1076, 811), "page-edge": (1346, 1304), "smoke": (1632, 678), "leaf-1": (1404, 1622), "leaf-2": (1590, 1701)}
TRIM_HOMES = {"smoke": "fx", "leaf-1": "fx", "leaf-2": "fx"}


def load_rgb(name):
    return np.asarray(Image.open(RUN / f"{name}.png").convert("RGB"))


def load_rgba(path):
    return np.asarray(Image.open(path).convert("RGBA"))


def save(array, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(array).save(path)


def paper_of(rgb):
    return tuple(np.median(np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1])), axis=0).astype(int))


def cut(rgb, seal=False):
    """Run the shared cutter on an image, returning [(rgba, center_x, center_y)]."""
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp, "in.png")
        Image.fromarray(rgb).save(src)
        args = [sys.executable, str(CUTOUT)] + (["--seal=3"] if seal else []) + [str(src), str(Path(tmp, "out"))]
        out = subprocess.run(args, check=True, capture_output=True, text=True).stdout
        found = []
        for line in out.splitlines():
            # cutout prints numpy ints as np.int64(n) on some versions.
            left, top, right, bottom = [int(n) for n in re.findall(r"\d+", line.split("box", 1)[1].replace("np.int64(", ""))]
            name = line.split(":")[0]
            found.append((load_rgba(Path(tmp, "out", f"{name}.png")), (left + right) / 2, (top + bottom) / 2))
    return found


def make_layer(name, source):
    rgb = load_rgb(source)
    assert checks.border_is_paper(rgb), f"{source}: paint touches the border"
    paper = paper_of(rgb)
    pieces = cut(rgb)
    assert len(pieces) == 1, f"{source}: {len(pieces)} pieces"
    a = finish.remove_specks(finish.clear_magenta(finish.clear_enclosed(finish.despill(pieces[0][0], paper), paper)))
    if name == "layer-2-headland":
        a = clear_sky(a)
    return finish.center_on_canvas(finish.trim_base(a), 2720)


def clear_sky(rgba):
    """The painter left sky beside the lighthouse. Cut away pale blue that joins the outside, above the sea."""
    rgb = rgba[..., :3].astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    sky = (b - r >= 14) & (rgb.mean(axis=2) >= 165)
    # The card's pale rim walls the sky in, so let the cut pass through it, but only right of the tower.
    rim = (rgb.mean(axis=2) >= 200) & (rgb.max(axis=2) - rgb.min(axis=2) <= 30)
    rim[:, : int(np.nonzero(rgba[..., 3].any(axis=0))[0].min() + rgba.shape[1] * 0.21)] = False
    sky |= rim
    sky[int(rgba.shape[0] * 0.92):] = False
    out = finish.clear_connected(rgba, sky)
    # Drop stray pencil lines the cut left behind: anything thinner than 7 px that hangs off the piece.
    solid = ni.binary_opening(out[..., 3] > 127, iterations=3)
    labels, count = ni.label(solid)
    biggest = labels == 1 + int(np.argmax(ni.sum(solid, labels, range(1, count + 1))))
    out[~ni.binary_dilation(biggest, iterations=4)] = 0
    # The card's dark right edge survives as a 14 px stroke, so end the sea a little short of it.
    right = np.nonzero(out[..., 3].any(axis=0))[0].max()
    out[:, right - 16 :] = 0
    return finish.remove_specks(out)


def make_ground():
    rgb = load_rgb("ground").copy()
    # Paint out the button and spoon the painter repeated from the dunes, using nearby wash.
    yy, xx = np.mgrid[: rgb.shape[0], : rgb.shape[1]]
    hole = np.zeros(rgb.shape[:2], bool)
    for cx, cy, rx, ry in [(470, 925, 175, 140), (600, 845, 75, 70), (735, 905, 75, 195), (782, 1090, 135, 85), (865, 885, 110, 95)]:
        hole |= ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
    keep = (~hole).astype(float)
    weight = ni.gaussian_filter(keep, 55)
    base = np.stack([ni.gaussian_filter(rgb[..., c] * keep, 55) for c in range(3)], -1) / np.maximum(weight, 1e-3)[..., None]
    # Fine paper grain, borrowed from a clean part of the same wash.
    grain = np.roll(rgb.astype(float), (430, 0), axis=(0, 1)) * 0.6
    grain -= np.stack([ni.gaussian_filter(grain[..., c], 12) for c in range(3)], -1)
    soft = ni.gaussian_filter(hole.astype(float), 14)[..., None]
    filled = np.clip(base + grain, 0, 255)
    return finish.calibrate_paper((rgb * (1 - soft) + filled * soft).round().astype("uint8"))


def make_trims():
    rgb = load_rgb("trims-sheet").copy()
    near = np.abs(rgb.astype(int) - (195, 45, 130)).max(axis=2) <= 40
    ys, xs = np.nonzero(ni.binary_opening(near, iterations=4))
    top, bottom, left, right = ys.min() + 24, ys.max() - 24, xs.min() + 24, xs.max() - 24
    paper = tuple(int(v) for v in np.median(rgb[top:bottom, left:right][near[top:bottom, left:right]], axis=0))
    outside = np.ones(rgb.shape[:2], bool)
    outside[top:bottom, left:right] = False
    rgb[outside] = paper
    pieces = cut(rgb)
    assert len(pieces) == 8, f"trims: {len(pieces)} pieces"
    made = {}
    for name, (tx, ty) in TRIMS.items():
        best = min(pieces, key=lambda p: (p[1] - tx) ** 2 + (p[2] - ty) ** 2)
        made[name] = finish.remove_specks(finish.clear_magenta(finish.clear_enclosed(finish.despill(best[0], paper), paper)))
    return made


def make_pip():
    rgb = load_rgb("pip-sheet")
    assert checks.border_is_paper(rgb), "pip sheet: paint touches the border"
    paper = paper_of(rgb)
    pieces = cut(rgb)
    assert len(pieces) == 3, f"pip sheet: {len(pieces)} pieces"
    pieces.sort(key=lambda p: p[1])
    frightened, pleading, lantern = [finish.remove_specks(finish.clear_white_fringe(p[0], paper)) for p in pieces]
    forward = load_rgba(ART / "cast/pip/heads/forward.png")
    scale, dx, dy = finish.register_head(pleading, forward)
    h, w = pleading.shape[:2]
    up = finish.remove_specks(np.asarray(Image.fromarray(pleading).resize((round(w * scale), round(h * scale)), Image.LANCZOS)))
    lit = load_rgba(ART / "cast/pip/parts/lantern.png")
    # Only the handle's opening is trapped paper. The glass is pale too, and has to stay.
    handle = lantern.shape[0] // 4
    lantern = np.concatenate((finish.clear_enclosed(lantern[:handle], paper, tolerance=25), lantern[handle:]))
    out = finish.remove_specks(finish.fit_lantern(lantern, lit))
    if finish.outline_error(out, lit) > 5:
        out = glass_in_frame(lantern, lit)
    return up, (dx, dy), out, finish.outline_error(out, lit), frightened


def glass_in_frame(unlit, lit):
    """Keep the lit lantern's brass exactly, with the painted dark glass inside it."""
    def glass(a):
        lum = a[..., :3].astype(float).mean(axis=2)
        h = a.shape[0]
        body = np.zeros(a.shape[:2], bool)
        body[int(h * 0.33) : int(h * 0.80)] = True
        labels, count = ni.label((lum > 150) & (a[..., 3] > 127) & body)
        sizes = ni.sum(np.ones(labels.shape), labels, range(1, count + 1))
        return ni.binary_fill_holes(labels == 1 + int(np.argmax(sizes)))
    target, source = glass(lit), glass(unlit)
    top, bottom, left, right = np.nonzero(target.any(axis=1))[0][[0, -1]].tolist() + np.nonzero(target.any(axis=0))[0][[0, -1]].tolist()
    s_top, s_bottom, s_left, s_right = np.nonzero(source.any(axis=1))[0][[0, -1]].tolist() + np.nonzero(source.any(axis=0))[0][[0, -1]].tolist()
    patch = Image.fromarray(unlit[s_top : s_bottom + 1, s_left : s_right + 1]).resize((right - left + 1, bottom - top + 1), Image.LANCZOS)
    out = lit.copy()
    soft = ni.gaussian_filter(target.astype(float), 1.2)[top : bottom + 1, left : right + 1, None]
    region = out[top : bottom + 1, left : right + 1, :3].astype(float)
    out[top : bottom + 1, left : right + 1, :3] = (region * (1 - soft) + np.asarray(patch)[..., :3] * soft).round().astype("uint8")
    return out


SPINE_DEPTH_MM = 315 / 2
LAMP_PX = (630, 148)
PIP_MARK_MM = (10, 175)


def stage(x_mm, depth_mm, up_mm=0.0):
    """Millimeters on the reference book (depth from the near edge) to contract stage space in meters."""
    return [round(x_mm / 1000, 4), round(up_mm / 1000, 4), round((SPINE_DEPTH_MM - depth_mm) / 1000, 4)]


def write_metadata():
    import json
    layers = []
    for order, (name, _, hinge, _) in enumerate(LAYERS):
        h, w = load_rgba(ART / "sets/shore-path" / f"{name}.png").shape[:2]
        layers.append({
            "id": name, "file": f"{name}.png", "sizePx": [w, h],
            "sizeM": [round(w / PX_PER_MM / 1000, 4), round(h / PX_PER_MM / 1000, 4)],
            "hinge": [stage(-210, hinge), stage(210, hinge)],
            "splitColumnPx": w // 2,
            "standingDeg": 0, "flatDeg": 90, "folds": "toward the reader, top first",
        })
    lamp_x = (LAMP_PX[0] - 1360) / PX_PER_MM
    lamp_up = (1280 - LAMP_PX[1]) / PX_PER_MM
    shore = {
        "note": "The shore path set, as the art proposes it. Stage space as in contracts: meters at reference size, origin at the center of the spine on the table, y up, +z toward the reader. Re-check on the Quest.",
        "reference": "Open book 0.42 x 0.315 m. Each layer image spans the full 0.42 m width at pxPerM, and splits at splitColumnPx: the left half stands on the cover's inside, the right half on the page block.",
        "pxPerM": round(PX_PER_MM * 1000, 1),
        "ground": {"file": "ground.png", "sizeM": [0.42, 0.315], "faces": "left half on the cover's inside, right half on the page block", "captionBandM": 0.045},
        "layers": layers,
        "stack": {"topToBottom": ["layer-1-sky", "layer-2-headland", "layer-3-dunes", "pip", "layer-4-foreground"], "riseOrder": "top to bottom", "closeOrder": "bottom to top, then the cover", "flatOffsetM": 0.001, "backColor": "#F6EFE2"},
        "anchors": {"lighthouseLamp": {"layer": "layer-2-headland", "px": list(LAMP_PX), "position": stage(lamp_x, 250, lamp_up)}},
        "marks": [{"id": "pip", "label": "Pip's mark", "position": stage(*PIP_MARK_MM), "heightM": 0.17, "folds": "toward the reader, hinge at the feet"}],
        "effects": {
            "smoke": {"file": "../../fx/smoke.png", "heightM": 0.045, "starts": "top of Pip's lantern, rising and fading"},
            "leaf-1": {"file": "../../fx/leaf-1.png", "heightM": 0.012, "starts": "the left page edge, carried by the gust"},
            "leaf-2": {"file": "../../fx/leaf-2.png", "heightM": 0.012, "starts": "the left page edge, a beat after leaf-1"},
        },
        "moods": {k: list(v) for k, v in checks.MOODS.items()},
    }
    book = {
        "note": "The book, as the art proposes it. Same stage space as set.json. The book is placed by its spine: closed, it covers x 0 to 0.21 m, and open, -0.21 to 0.21 m. Re-check on the Quest.",
        "closedSizeM": [0.21, 0.315], "openSizeM": [0.42, 0.315], "thicknessM": 0.03,
        "cover": {"hinge": "the spine, x = 0, along z", "closedDeg": 0, "openDeg": 180, "inside": "the left half of the set's ground"},
        "parts": {
            "cover": {"file": "cover-front.png", "face": "cover outside", "sizeM": [0.21, 0.315], "title": "blank panel in the top third, for Fraunces set by the Stage"},
            "spine": {"file": "spine.png", "face": "spine, stretched along its length", "sizeM": [0.03, 0.315]},
            "page-edge": {"file": "page-edge.png", "face": "page block sides while closed", "sizeM": [0.315, 0.025]},
            "ribbon": {"file": "ribbon.png", "attach": "the far edge of the right page at x 0.19 m, 0.04 m showing on the page as in the mockup", "sizeM": [0.012, 0.04]},
            "tab-gold": {"file": "tab-gold.png", "attach": "right fore-edge, 0.06 m from the far edge, rounded end outward", "sizeM": [0.02, 0.0113]},
            "tab-sage": {"file": "tab-sage.png", "attach": "right fore-edge, 0.1 m from the far edge, rounded end outward", "sizeM": [0.02, 0.0113]},
            "drawer-pull": {"file": "drawer-pull.png", "attach": "center of the near edge, below the pages", "sizeM": [0.044, 0.0144]},
        },
        "pageColor": "#F6EFE2",
    }
    (ART / "sets/shore-path/set.json").write_text(json.dumps(shore, indent=2) + "\n")
    (ART / "book/book.json").write_text(json.dumps(book, indent=2) + "\n")
    problems = checks.check_manifest(book, shore, ART / "book", ART / "sets/shore-path")
    print("metadata", problems or "agrees with files")


def main():
    wanted = set(sys.argv[1:])
    for name, source, hinge, limit in LAYERS:
        if (RUN / f"{source}.png").exists() and (not wanted or "layers" in wanted):
            a = make_layer(name, source)
            save(a, ART / "sets/shore-path" / f"{name}.png")
            print(name, a.shape[:2], f"{(a.shape[0] - np.nonzero(a[..., 3] > 127)[0].min()) / PX_PER_MM:.0f}mm", checks.check_layer(a, hinge, limit, PX_PER_MM))
    if not wanted or "ground" in wanted:
        save(make_ground(), ART / "sets/shore-path/ground.png")
        print("ground done")
    if not wanted or "book" in wanted:
        cover = load_rgb("cover-front")
        save(cover, ART / "book/cover-front.png")
        save(cover[:, :90], ART / "book/spine.png")
        print("cover and spine done")
    if not wanted or "trims" in wanted:
        for name, a in make_trims().items():
            save(a, ART / TRIM_HOMES.get(name, "book") / f"{name}.png")
            print(name, a.shape[:2], checks.check_cut(a, 20, 20))
    if not wanted or "metadata" in wanted:
        write_metadata()
    if not wanted or "pip" in wanted:
        up, offset, out, err, frightened = make_pip()
        save(up, ART / "cast/pip/heads/up.png")
        save(out, ART / "cast/pip/parts/lantern-out.png")
        save(frightened, RUN / "pip-up-frightened.png")
        print("up", up.shape[:2], "offset", offset, "lantern outline error", err, checks.check_cut(up, 50, 50), checks.check_cut(out, 50, 50))


if __name__ == "__main__":
    main()
