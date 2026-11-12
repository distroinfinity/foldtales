"""Finishes run 008: cuts the three room flats off their magenta paper with run 006's finishing (shadow eaten
inward, despill, magenta cleared), checks them, and writes art/room/ with room.json.
Exits non-zero on any problem. Run from the repo root: python3 art/runs/008-reading-room/make_room.py"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RUN = Path(__file__).resolve().parent
ART = RUN.parents[1]
sys.path.insert(0, str(ART / "runs" / "006-drawer-objects"))
sys.path.insert(1, str(ART / "runs" / "004-book-and-first-set"))
import make_objects as mo  # noqa: E402  (run 006)
import make_pieces  # noqa: E402  (run 004: cut, paper_of)
import objects_check as oc  # noqa: E402  (run 006)

OUT = ART / "room"
FLATS = ["flat-window", "flat-shelves", "flat-lamp"]
MAX_SIDE = 2048
# Toy-theater flats in a loose arc around a seated reader, in metres from the reader's chair, facing them.
LAYOUT = {
    "flat-window": {"heightM": 2.0, "distanceM": 2.0, "azimuthDeg": -50},
    "flat-shelves": {"heightM": 2.1, "distanceM": 2.2, "azimuthDeg": 0},
    "flat-lamp": {"heightM": 1.8, "distanceM": 2.0, "azimuthDeg": 50},
}


def fit(rgba):
    h, w = rgba.shape[:2]
    scale = min(1.0, MAX_SIDE / max(h, w))
    if scale == 1.0:
        return rgba
    return np.asarray(Image.fromarray(rgba).resize((round(w * scale), round(h * scale)), Image.LANCZOS))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    problems = []
    flats = []
    for name in FLATS:
        rgb = np.asarray(Image.open(RUN / f"{name}.png").convert("RGB"))
        paper = make_pieces.paper_of(rgb)
        found = make_pieces.cut(rgb)
        if len(found) != 1:
            problems.append(f"{name}: {len(found)} pieces, expected 1")
            continue
        piece = mo.clear_shadow(found[0][0], paper)
        problems += [f"{name}: {p}" for p in oc.magenta_residue(piece)]
        done = fit(mo.crop_painted(piece))
        Image.fromarray(done).save(OUT / f"{name}.png")
        h, w = done.shape[:2]
        flats.append({"id": name, "file": f"{name}.png", "sizePx": [w, h], **LAYOUT[name]})
        print(f"{name}: {w}x{h}")
    top = Image.open(RUN / "tabletop.png").convert("RGB")
    top.resize((2048, round(2048 * top.height / top.width)), Image.LANCZOS).save(OUT / "tabletop.png")
    room = {
        "note": "The reading room for no-passthrough mode, from run 008. Flats stand on the floor in a loose arc, each facing the reader; the tabletop is the surface the book stands on.",
        "flats": flats,
        "tabletop": {"file": "tabletop.png", "sizeM": [0.9, 0.675], "heightM": 0.74},
        "floorColor": "#3A2E28",
        "wallColor": "#2A2F3D",
    }
    (OUT / "room.json").write_text(json.dumps(room, indent=2) + "\n")
    if problems:
        print("PROBLEMS:\n" + "\n".join(problems))
        sys.exit(1)
    print("room ok")


if __name__ == "__main__":
    main()
