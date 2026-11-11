"""Cuts, finishes, checks and names run 006's drawer objects. Exits non-zero on any problem.
Run from the repo root: python3 art/runs/006-drawer-objects/make_objects.py
Reuses run 004's cutter wrapper, finishing chain and checks, which are merged and closed."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ni

RUN = Path(__file__).resolve().parent
ART = RUN.parents[1]
RUN_004 = ART / "runs" / "004-book-and-first-set"
sys.path.insert(0, str(RUN))
sys.path.insert(1, str(RUN_004))
import objects_check as oc  # noqa: E402
import checks  # noqa: E402  (run 004)
import finish  # noqa: E402  (run 004)
import make_pieces  # noqa: E402  (run 004: cut, paper_of)

# Each sheet and the pieces it must cut into. The objects sheet still holds its first, too-small spool.
SHEETS = {"objects-sheet": 5, "spool-sheet": 1}
RIM_DEPTH = 20
RIM_MAX_SHARE = 0.15
PAD = 6
PAGE = (246, 239, 226)
NAVY = (31, 42, 68)

# source: which sheet. center: the piece's center on it, from contact-raw-<sheet>.png. grip: where a paw holds it,
# in that sheet's pixels, read off the painting; None means the piece's center. The pivot written to object.json
# is the grip as a percentage of the finished image. rim: the sheet painted a white sticker border to strip.
OBJECTS = [
    {
        "id": "kite", "name": "patched paper kite", "height_m": 0.12,
        "description": "A patched paper kite in faded rust and cream, with a tail of three cloth bows.",
        "tags": ["flies", "catches-wind", "lightweight", "fragile"],
        "source": "objects-sheet", "center": (828, 1024), "grip": (830, 822),
    },
    {
        "id": "spool", "name": "spool of thread", "height_m": 0.07,
        "description": "A wooden spool wound thick with sage-green thread, a loose end curling free.",
        "tags": ["rope", "ties", "rolls", "lightweight"],
        "source": "spool-sheet", "center": None, "grip": None, "rim": True,
    },
    {
        "id": "ladder", "name": "little wooden ladder", "height_m": 0.15,
        "description": "A little wooden ladder with five worn rungs, long enough to lay across a gap.",
        "tags": ["climbs", "spans"],
        "source": "objects-sheet", "center": (351, 1016), "grip": (236, 1080),
    },
    {
        "id": "odd-sock", "name": "odd sock", "height_m": 0.09,
        "description": "A single cream wool sock with rust and sage stripes and a darned heel, its partner long gone.",
        "tags": ["soft", "warm", "lightweight"],
        "source": "objects-sheet", "center": (1137, 1202), "grip": (1205, 940),
    },
    {
        "id": "brass-key", "name": "old brass key", "height_m": 0.075,
        "description": "An old brass key with a round looped bow. Nobody remembers what it opens.",
        "tags": ["opens", "shiny", "heavy"],
        "source": "objects-sheet", "center": (1740, 1274), "grip": (1736, 1044),
    },
]

PROBLEMS = []


def report(label, problems):
    print(label, problems or "ok")
    PROBLEMS.extend(f"{label}: {p}" for p in problems)


def bail():
    if PROBLEMS:
        sys.exit("FAILED:\n" + "\n".join(PROBLEMS))


def load_sheet(name):
    rgb = np.asarray(Image.open(RUN / f"{name}.png").convert("RGB")).copy()
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1])).astype(int)
    r, g, b = np.median(border, axis=0)
    if not (r - g > 70 and b - g > 25):
        # A sheet on a sheet (run 004's trims): crop to the magenta paper and fill outside it with that paper.
        near = (rgb[..., 0].astype(int) - rgb[..., 1] > 70) & (rgb[..., 2].astype(int) - rgb[..., 1] > 25)
        ys, xs = np.nonzero(ni.binary_opening(near, iterations=4))
        top, bottom, left, right = ys.min() + 24, ys.max() - 24, xs.min() + 24, xs.max() - 24
        inside = near[top:bottom, left:right]
        paper = tuple(int(v) for v in np.median(rgb[top:bottom, left:right][inside], axis=0))
        outside = np.ones(rgb.shape[:2], bool)
        outside[top:bottom, left:right] = False
        rgb[outside] = paper
        print("sheet on a sheet: cropped to the magenta paper")
    return rgb


def resample(rgba, height_px):
    """Resize premultiplied, so the paper hidden under transparent pixels can't bleed into the edge."""
    img = Image.fromarray(rgba).convert("RGBa")
    width_px = max(1, round(rgba.shape[1] * height_px / rgba.shape[0]))
    return np.asarray(img.resize((width_px, height_px), Image.LANCZOS).convert("RGBA")).copy()


def crop_painted(rgba):
    top, bottom, left, right = oc.painted_box(rgba, 0)
    out = np.zeros((bottom - top + 1 + 2 * PAD, right - left + 1 + 2 * PAD, 4), "uint8")
    out[PAD:-PAD, PAD:-PAD] = rgba[top : bottom + 1, left : right + 1]
    out[out[..., 3] == 0] = 0
    return out


def contact_raw(name, pieces):
    """The raw cut with each piece's index and center, for filling in OBJECTS' centers."""
    sheet = Image.open(RUN / f"{name}.png").convert("RGB")
    k = 1024 / sheet.width
    sheet = sheet.resize((1024, round(sheet.height * k)))
    draw = ImageDraw.Draw(sheet)
    for i, (_, cx, cy) in enumerate(pieces):
        draw.text((cx * k, cy * k), f"{i}: ({cx:.0f}, {cy:.0f})", fill=(255, 255, 255))
    sheet.save(RUN / f"contact-raw-{name}.png")


def contact_finished(made, path):
    """All finished objects at their real relative size, on page and on night navy."""
    gap, tile_h = 40, max(a.shape[0] for a in made.values()) + 80
    width = sum(a.shape[1] for a in made.values()) + gap * (len(made) + 1)
    sheet = Image.new("RGB", (width, tile_h * 2), PAGE)
    sheet.paste(Image.new("RGB", (width, tile_h), NAVY), (0, tile_h))
    x = gap
    for a in made.values():
        piece = Image.fromarray(a)
        for row in (0, 1):
            sheet.paste(piece, (x, row * tile_h + tile_h - 40 - a.shape[0]), piece)
        x += a.shape[1] + gap
    sheet.save(path)


def clear_shadow(rgba, paper):
    """Clear trapped paper, then eat the paper's crimson shadow inward from every transparent edge, holes included.
    Despill only after, or it neutralises the shadow's tint and the shadow stays as a dark fringe."""
    a = finish.clear_enclosed(rgba, paper)
    a = finish.clear_connected(a, oc.shadow_tint(a))
    return finish.remove_specks(finish.clear_magenta(finish.despill(a, paper)))


def grip_percent(piece, center, grip, crop_box, scale_box):
    """A grip point given in sheet pixels, as a percentage of the finished image.
    The raw piece is centered on `center` on the sheet. `crop_box` is (top, left) of crop_painted's box on the
    piece, and `scale_box` the finished image's (height, width) over the cropped one's."""
    h, w = piece.shape[:2]
    x = grip[0] - (center[0] - w / 2) - crop_box[1] + PAD
    y = grip[1] - (center[1] - h / 2) - crop_box[0] + PAD
    return [round(100 * x / scale_box[1], 1), round(100 * y / scale_box[0], 1)]


def strip_rim_pass(rgba, outer_px):
    """Eat sticker-border paper inward from every transparent edge, never deeper than RIM_DEPTH. The flood may
    cross the border's own outer pencil line (outer_px) and runs through pale paper, stopping at the object's line."""
    painted = rgba[..., 3] > 0
    band = painted & ~ni.binary_erosion(painted, iterations=RIM_DEPTH)
    outer = painted & ~ni.binary_erosion(painted, iterations=outer_px) if outer_px else np.zeros_like(painted)
    rgb = rgba[..., :3].astype(int)
    pale = (rgb.min(axis=2) > 150) & (rgb.max(axis=2) - rgb.min(axis=2) < 60)
    return finish.clear_connected(rgba, outer | band & (pale | oc.shadow_tint(rgba)))


def strip_rim(rgba, paper):
    """Clear trapped paper first so holes count as edges, then two passes, which reach cream tucked into corners."""
    a = finish.clear_enclosed(rgba, paper)
    # Slivers of border the flood cut off are separate specks, not part of the object.
    return finish.remove_specks(strip_rim_pass(strip_rim_pass(a, 5), 0))


def make(obj, piece, center, paper):
    problems = []
    if obj.get("rim"):
        stripped = strip_rim(piece, paper)
        share = float(((piece[..., 3] > 127) & (stripped[..., 3] <= 127)).sum() / (piece[..., 3] > 127).sum())
        problems += [f"rim took {share:.2f}"] if share > RIM_MAX_SHARE else []
        piece = stripped
    a = clear_shadow(piece, paper)
    kept = oc.preservation_problems(piece, a, paper)
    top0, _, left0, _ = oc.painted_box(a, 0)
    a = crop_painted(a)
    obj["pivot"] = grip_percent(piece, center, obj["grip"] or center, (top0, left0), a.shape[:2])
    top, bottom, _, _ = oc.painted_box(a)
    painted_h = bottom - top + 1
    density = painted_h / (obj["height_m"] * 1000)
    problems += kept + oc.upscale_problems(painted_h, obj["height_m"])
    target = round(oc.target_height_px(obj["height_m"]) * a.shape[0] / painted_h)
    out = finish.remove_specks(resample(a, target))
    h, w = out.shape[:2]
    problems += checks.check_cut(out, 20, 20, paper_rgb=paper)
    problems += oc.magenta_residue(out)
    problems += oc.size_problems(w, h, obj["height_m"])
    problems += oc.pivot_problems(out, obj["pivot"])
    problems += oc.tag_problems(obj["tags"])
    return out, density, problems


def object_json(obj):
    return {
        "id": obj["id"],
        "name": obj["name"],
        "description": obj["description"],
        "tags": obj["tags"],
        "art": {"kind": "asset", "path": f"objects/{obj['id']}/{obj['id']}.png"},
        "size": {"heightM": obj["height_m"]},
        "pivot": list(obj["pivot"]),
        "provenance": "library",
    }


def main():
    cuts = {}
    for name, count in SHEETS.items():
        rgb = load_sheet(name)
        report(name, [] if checks.border_is_paper(rgb) else ["paint touches the border"])
        bail()
        pieces = make_pieces.cut(rgb)
        report(f"{name} cut", oc.piece_count_problems(len(pieces), count))
        contact_raw(name, pieces)
        cuts[name] = (pieces, make_pieces.paper_of(rgb))
    bail()
    made, densities, used = {}, {}, set()
    for obj in OBJECTS:
        pieces, paper = cuts[obj["source"]]
        tx, ty = obj["center"] or pieces[0][1:]
        index = min(range(len(pieces)), key=lambda i: (pieces[i][1] - tx) ** 2 + (pieces[i][2] - ty) ** 2)
        if (obj["source"], index) in used:
            report(obj["id"], [f"shares piece {index} with another object"])
            continue
        used.add((obj["source"], index))
        out, density, problems = make(obj, pieces[index][0], pieces[index][1:], paper)
        h, w = out.shape[:2]
        report(f"{obj['id']} {w}x{h}px {obj['height_m'] * 1000:.0f}mm sheet {density:.1f}px/mm", problems)
        made[obj["id"]], densities[obj["id"]] = out, density
    report("shared scale", oc.spread_problems(densities) if densities else ["nothing made"])
    bail()
    for obj in OBJECTS:
        folder = ART / "objects" / obj["id"]
        folder.mkdir(parents=True, exist_ok=True)
        Image.fromarray(made[obj["id"]]).save(folder / f"{obj['id']}.png")
        (folder / "object.json").write_text(json.dumps(object_json(obj), indent=2) + "\n")
    contact_finished(made, RUN / "contact.png")
    print("wrote", ", ".join(o["id"] for o in OBJECTS))


if __name__ == "__main__":
    main()
