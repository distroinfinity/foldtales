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

SHEET = "objects-sheet"
PAD = 6
PAGE = (246, 239, 226)
NAVY = (31, 42, 68)

# center: the piece's center on the sheet, read off the labelled contact sheet once the painting exists.
# pivot: where a paw holds it, as a percentage of the finished image.
OBJECTS = [
    {
        "id": "kite", "name": "patched paper kite", "height_m": 0.12,
        "description": "A patched paper kite in faded rust and cream, with a tail of three cloth bows.",
        "tags": ["flies", "catches-wind", "lightweight", "fragile"],
        "center": None, "pivot": None,
    },
    {
        "id": "spool", "name": "spool of thread", "height_m": 0.07,
        "description": "A wooden spool wound thick with sage-green thread, its loose end tucked in.",
        "tags": ["rope", "ties", "rolls", "lightweight"],
        "center": None, "pivot": None,
    },
    {
        "id": "ladder", "name": "little wooden ladder", "height_m": 0.15,
        "description": "A little wooden ladder with five worn rungs, long enough to lay across a gap.",
        "tags": ["climbs", "spans"],
        "center": None, "pivot": None,
    },
    {
        "id": "odd-sock", "name": "odd sock", "height_m": 0.09,
        "description": "A single cream wool sock with rust and sage stripes and a darned heel, its partner long gone.",
        "tags": ["soft", "warm", "lightweight"],
        "center": None, "pivot": None,
    },
    {
        "id": "brass-key", "name": "old brass key", "height_m": 0.075,
        "description": "An old brass key with a round looped bow. Nobody remembers what it opens.",
        "tags": ["opens", "shiny", "heavy"],
        "center": None, "pivot": None,
    },
]

PROBLEMS = []


def report(label, problems):
    print(label, problems or "ok")
    PROBLEMS.extend(f"{label}: {p}" for p in problems)


def bail():
    if PROBLEMS:
        sys.exit("FAILED:\n" + "\n".join(PROBLEMS))


def load_sheet():
    rgb = np.asarray(Image.open(RUN / f"{SHEET}.png").convert("RGB")).copy()
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
    img = Image.fromarray(rgba, "RGBA").convert("RGBa")
    width_px = max(1, round(rgba.shape[1] * height_px / rgba.shape[0]))
    return np.asarray(img.resize((width_px, height_px), Image.LANCZOS).convert("RGBA")).copy()


def crop_painted(rgba):
    top, bottom, left, right = oc.painted_box(rgba, 0)
    out = np.zeros((bottom - top + 1 + 2 * PAD, right - left + 1 + 2 * PAD, 4), "uint8")
    out[PAD:-PAD, PAD:-PAD] = rgba[top : bottom + 1, left : right + 1]
    out[out[..., 3] == 0] = 0
    return out


def contact_raw(pieces, path):
    """The raw cut with each piece's index and center, for filling in OBJECTS' centers."""
    sheet = Image.open(RUN / f"{SHEET}.png").convert("RGB").resize((1024, 1024))
    draw = ImageDraw.Draw(sheet)
    for i, (_, cx, cy) in enumerate(pieces):
        draw.text((cx / 2, cy / 2), f"{i}: ({cx:.0f}, {cy:.0f})", fill=(255, 255, 255))
    sheet.save(path)


def contact_finished(made, path):
    """All finished objects at their real relative size, on page and on night navy."""
    gap, tile_h = 40, max(a.shape[0] for a in made.values()) + 80
    width = sum(a.shape[1] for a in made.values()) + gap * (len(made) + 1)
    sheet = Image.new("RGB", (width, tile_h * 2), PAGE)
    sheet.paste(Image.new("RGB", (width, tile_h), NAVY), (0, tile_h))
    x = gap
    for a in made.values():
        piece = Image.fromarray(a, "RGBA")
        for row in (0, 1):
            sheet.paste(piece, (x, row * tile_h + tile_h - 40 - a.shape[0]), piece)
        x += a.shape[1] + gap
    sheet.save(path)


def make(obj, piece, paper):
    a = finish.remove_specks(finish.clear_magenta(finish.clear_enclosed(finish.despill(piece, paper), paper)))
    kept = oc.preservation_problems(piece, a, paper)
    a = crop_painted(a)
    top, bottom, _, _ = oc.painted_box(a)
    painted_h = bottom - top + 1
    density = painted_h / (obj["height_m"] * 1000)
    problems = kept + oc.upscale_problems(painted_h, obj["height_m"])
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
    rgb = load_sheet()
    report("sheet", [] if checks.border_is_paper(rgb) else ["paint touches the border"])
    bail()
    paper = make_pieces.paper_of(rgb)
    pieces = make_pieces.cut(rgb)
    report("cut", oc.piece_count_problems(len(pieces), len(OBJECTS)))
    contact_raw(pieces, RUN / "contact-raw.png")
    bail()
    if any(o["center"] is None or o["pivot"] is None for o in OBJECTS):
        sys.exit("FAILED: fill in each object's center and pivot from contact-raw.png")
    made, densities, used = {}, {}, set()
    for obj in OBJECTS:
        tx, ty = obj["center"]
        index = min(range(len(pieces)), key=lambda i: (pieces[i][1] - tx) ** 2 + (pieces[i][2] - ty) ** 2)
        if index in used:
            report(obj["id"], [f"shares piece {index} with another object"])
            continue
        used.add(index)
        out, density, problems = make(obj, pieces[index][0], paper)
        h, w = out.shape[:2]
        report(f"{obj['id']} {w}x{h}px {obj['height_m'] * 1000:.0f}mm sheet {density:.1f}px/mm", problems)
        made[obj["id"]], densities[obj["id"]] = out, density
    report("shared scale", oc.spread_problems(densities) if densities else ["nothing made"])
    bail()
    for obj in OBJECTS:
        folder = ART / "objects" / obj["id"]
        folder.mkdir(parents=True, exist_ok=True)
        Image.fromarray(made[obj["id"]], "RGBA").save(folder / f"{obj['id']}.png")
        (folder / "object.json").write_text(json.dumps(object_json(obj), indent=2) + "\n")
    contact_finished(made, RUN / "contact.png")
    print("wrote", ", ".join(o["id"] for o in OBJECTS))


if __name__ == "__main__":
    main()
