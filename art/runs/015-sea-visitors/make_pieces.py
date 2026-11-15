"""Run 015: cuts the sea and visitors sheets into finished pieces, for no credits.
Run from the repo root: python3 art/runs/015-sea-visitors/make_pieces.py
Reuses run 014's cutting, cleaning, checks and tiling (which reuse runs 004 and 006). Writes:
  art/room-fx/sea/waves.png              6 curling wave crests in one strip (512 x 320 px cells)
  art/room-fx/sea/foam-1..4.png          4 strips of lacy foam
  art/room-fx/sea/water.png              the night water, made to repeat (1024 px square)
  art/objects/paper-boat/paper-boat.png, paper-boat-turned.png
  art/objects/bottle/bottle.png     the bottle with its message
  art/room-fx/gulls/gull-perched.png, gull-up.png, gull-down.png
and contact sheets in this run's folder. The pieces keep their thin white paper edge, as run 014's stars."""
import importlib.util
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RUN = Path(__file__).resolve().parent
ART = RUN.parents[1]
spec = importlib.util.spec_from_file_location("run014", ART / "runs" / "014-room-weather-sky" / "make_pieces.py")
r14 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r14)


def cut_sheet(name, expected):
    rgb = np.asarray(Image.open(RUN / f"{name}.png").convert("RGB")).copy()
    paper = r14.make_pieces.paper_of(rgb)
    found = r14.make_pieces.cut(rgb)
    flat = [f for row in r14.rows(found, rgb.shape[0]) for f in row]
    if len(flat) != expected:
        r14.PROBLEMS.append(f"{name}: {len(flat)} pieces, expected {expected}")
        return None
    out = []
    for i, (a, *_ ) in enumerate(flat):
        raw = a.copy()
        a = r14.clean(a, paper)
        r14.check(f"{name}-{i + 1}", a, raw, paper)
        out.append(r14.crop(a))
    return out


def save(a, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(a).save(path, optimize=True)


def sea():
    pieces = cut_sheet("sea-sheet", 10)
    if pieces is None:
        return
    waves, foam = pieces[:6], pieces[6:]
    (ART / "room-fx" / "sea").mkdir(parents=True, exist_ok=True)
    r14.strip(waves, 512, 320).save(ART / "room-fx" / "sea" / "waves.png", optimize=True)
    for i, f in enumerate(foam):
        save(f, ART / "room-fx" / "sea" / f"foam-{i + 1}.png")


def water():
    """The night water, made to repeat by blending it with its half-offset self (run 014's way)."""
    im = Image.open(RUN / "water-wash.png").convert("RGB")
    side = min(im.size)
    im = im.crop(((im.width - side) // 2, 0, (im.width + side) // 2, side)).resize((1024, 1024), Image.LANCZOS)
    a = np.asarray(im).astype(float)
    shifted = np.roll(np.roll(a, 512, axis=0), 512, axis=1)
    y, x = np.mgrid[0:1024, 0:1024] / 1023.0
    w = (np.sin(np.pi * x) * np.sin(np.pi * y))[..., None] ** 0.6
    out = (a * w + shifted * (1 - w)).clip(0, 255).astype(np.uint8)
    (ART / "room-fx" / "sea").mkdir(parents=True, exist_ok=True)
    Image.fromarray(out).save(ART / "room-fx" / "sea" / "water.png", optimize=True)


def visitors():
    pieces = cut_sheet("visitors-sheet", 6)
    if pieces is None:
        return
    boat, boat_turned, bottle, perched, up, down = pieces
    save(boat, ART / "objects" / "paper-boat" / "paper-boat.png")
    save(boat_turned, ART / "objects" / "paper-boat" / "paper-boat-turned.png")
    save(bottle, ART / "objects" / "bottle" / "bottle.png")
    for name, a in (("gull-perched", perched), ("gull-up", up), ("gull-down", down)):
        save(a, ART / "room-fx" / "gulls" / f"{name}.png")


def contact():
    sheet = Image.new("RGBA", (1600, 900), (31, 42, 68, 255))
    files = [ART / "room-fx" / "sea" / "waves.png", *(ART / "room-fx" / "sea" / f"foam-{i}.png" for i in range(1, 5)),
             ART / "objects" / "paper-boat" / "paper-boat.png", ART / "objects" / "bottle" / "bottle.png",
             *(ART / "room-fx" / "gulls" / f"{n}.png" for n in ("gull-perched", "gull-up", "gull-down"))]
    x, y, row_h = 20, 20, 0
    for f in files:
        if not f.exists():
            continue
        im = Image.open(f).convert("RGBA")
        im.thumbnail((700, 260))
        if x + im.width > 1580:
            x, y, row_h = 20, y + row_h + 20, 0
        sheet.alpha_composite(im, (x, y))
        x += im.width + 20
        row_h = max(row_h, im.height)
    sheet.convert("RGB").save(RUN / "contact.png")


def main():
    sea()
    water()
    visitors()
    contact()
    warnings = [p for p in r14.PROBLEMS if p.endswith("painted box shrank")]
    failures = [p for p in r14.PROBLEMS if p not in warnings]
    if warnings:
        print("warnings (soft pale edges):", ", ".join(w.split(":")[0] for w in warnings))
    if failures:
        print("\n".join(failures))
        sys.exit(1)
    print("all pieces pass")


if __name__ == "__main__":
    main()
