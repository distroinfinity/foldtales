"""Cuts, finishes and names run 011's pieces: the lamp spread (sky, lamp room, railings, gallery floor), its lit lamp,
the shore's night sky and the lamp wick. Exits non-zero on any problem. Run from the repo root:
    python3 art/runs/011-lamp-spread/make_lamp_spread.py
Reuses run 004's cutter and finishing, and run 006's sheet loader, shadow clearing and rim stripping."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ni

RUN = Path(__file__).resolve().parent
ART = RUN.parents[1]
sys.path.insert(0, str(ART / "runs" / "006-drawer-objects"))
sys.path.insert(1, str(ART / "runs" / "004-book-and-first-set"))
import checks  # noqa: E402  (run 004)
import finish  # noqa: E402  (run 004)
import make_objects as mo  # noqa: E402  (run 006)
import make_pieces  # noqa: E402  (run 004)

OUT = ART / "sets" / "the-lamp"
SHORE = ART / "sets" / "shore-path"
CANVAS_W = 2720
PX_PER_M = CANVAS_W / 0.42
PIECE_PX_PER_MM = 905 / 170
PROBLEMS = []


def report(label, problems):
    print(("OK   " if not problems else "FAIL ") + label + ("" if not problems else ": " + "; ".join(problems)))
    PROBLEMS.extend(f"{label}: {p}" for p in problems)


def sheet(name):
    """A painting from this run, as RGB, via run 006's loader (it handles a sheet on a sheet)."""
    return mo.load_sheet(f"../011-lamp-spread/{name}")


def one_piece(name, strip=True, base=True):
    """Cuts the single stage piece from a painting on magenta. Returns (rgba, left_px, top_px) in the painting."""
    rgb = sheet(name)
    report(f"{name} border", [] if checks.border_is_paper(rgb) else ["paint touches the border"])
    paper = make_pieces.paper_of(rgb)
    pieces = make_pieces.cut(rgb)
    # The largest piece is the stage piece; anything else is a speck of the painter's.
    pieces.sort(key=lambda p: -(p[0][..., 3] > 127).sum())
    if not pieces:
        report(f"{name} cut", ["no piece found"])
        return None
    piece, cx, cy = pieces[0]
    done = mo.clear_shadow(piece, paper)
    if strip:
        done = mo.strip_rim(done, paper)
    done = finish.clear_magenta(done)
    left = int(round(cx - piece.shape[1] / 2))
    top = int(round(cy - piece.shape[0] / 2))
    ys, xs = np.nonzero(done[..., 3] > 8)
    done = done[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    return (finish.trim_base(done) if base else done), left + xs.min(), top + ys.min()


def on_canvas(piece, left, source_w):
    """A piece on the set's full-width canvas, at the same place across as it was painted."""
    k = CANVAS_W / source_w
    if abs(k - 1) > 1e-6:
        piece = np.asarray(Image.fromarray(piece).convert("RGBa").resize((max(1, round(piece.shape[1] * k)), max(1, round(piece.shape[0] * k))), Image.LANCZOS).convert("RGBA"))
        left = round(left * k)
    canvas = np.zeros((piece.shape[0], CANVAS_W, 4), "uint8")
    x0, x1 = max(0, left), min(CANVAS_W, left + piece.shape[1])
    canvas[:, x0:x1] = piece[:, x0 - left : x1 - left]
    return canvas


def layer_entry(layer_id, file, canvas, hinge_z):
    h, w = canvas.shape[:2]
    return {
        "id": layer_id,
        "file": file,
        "sizePx": [w, h],
        "sizeM": [0.42, round(h / PX_PER_M, 4)],
        "hinge": [[-0.21, 0.0, hinge_z], [0.21, 0.0, hinge_z]],
        "splitColumnPx": CANVAS_W // 2,
        "standingDeg": 0,
        "flatDeg": 90,
    }


def lit_lamp(room):
    """The lamp room lit: its own glass turned gold, its outline unchanged (run 007's lamp, on this painting)."""
    h, w = room.shape[:2]
    rgb = room[..., :3].astype(float)
    lum = rgb.mean(axis=2)
    # The glazed band only, below the dome and above the base ring, as a soft rounded mask: no hard edges.
    box = (int(h * 0.36), int(h * 0.86), int(w * 0.12), int(w * 0.88))
    yy, xx = np.mgrid[:h, :w]
    cy0, cx0 = (box[0] + box[1]) / 2, (box[2] + box[3]) / 2
    soft = np.exp(-(np.abs((xx - cx0) / ((box[3] - box[2]) / 2)) ** 6 + np.abs((yy - cy0) / ((box[1] - box[0]) / 2)) ** 6))
    inside = soft > 0.5
    smooth = lambda e0, e1, x: (lambda t: t * t * (3 - 2 * t))(np.clip((x - e0) / (e1 - e0), 0, 1))
    glass = ni.gaussian_filter(smooth(95, 150, lum), 1.2) * soft
    cy, cx = box[0] + (box[1] - box[0]) * 0.55, (box[2] + box[3]) / 2
    heart = np.exp(-(((xx - cx) / (w * 0.16)) ** 2 + ((yy - cy) / (h * 0.14)) ** 2))
    tone = np.clip(smooth(90, 230, lum) * 0.5 + heart * 0.8, 0, 1)[..., None]
    deep, bright = np.array([196, 124, 44], float), np.array([255, 228, 152], float)
    gold = deep * (1 - tone) + bright * tone
    out = rgb * (1 - glass[..., None]) + gold * glass[..., None]
    spill = ni.gaussian_filter(soft, 14)[..., None] * (1 - glass[..., None]) * 0.4
    out = out * (1 - spill) + (out * np.array([1.3, 1.05, 0.62])) * spill
    lit = room.copy()
    lit[..., :3] = np.clip(out, 0, 255).round().astype("uint8")
    changed = (np.abs(lit[..., :3].astype(int) - room[..., :3]).sum(axis=2) > 30) & inside
    report("lamp-lit", [] if np.array_equal(lit[..., 3], room[..., 3]) and changed[inside].mean() > 0.3 else ["outline changed or too little glass lit"])
    return lit, (cx, cy)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    layers = []
    made = {}
    for name, layer_id, hinge_z, limit_mm in (
        ("lamp-sky", "lamp-sky", -0.1375, 200),
        ("lamp-room", "lamp-room", -0.0925, 215),
        ("far-railing", "far-railing", -0.0575, 80),
        ("near-ledge", "near-ledge", 0.0425, 70),
    ):
        got = one_piece(name)
        if got is None:
            continue
        piece, left, _ = got
        src_w = Image.open(RUN / f"{name}.png").width
        canvas = on_canvas(piece, left, src_w)
        if name == "lamp-sky":
            # The painter made the sky a panel about half the spread wide. Free fix: a mirrored copy fills the
            # rest, set behind the original, and most of it stands behind the lamp room anyway.
            mirrored = canvas[:, ::-1].copy()
            shift = (CANVAS_W - (np.nonzero(canvas[..., 3].max(axis=0) > 127)[0].max() + 1)) - np.nonzero(canvas[..., 3].max(axis=0) > 127)[0].min()
            mirrored = np.roll(mirrored, -max(0, np.nonzero(mirrored[..., 3].max(axis=0) > 127)[0].min() - 0), axis=1)
            mirrored[..., 3] = np.where(np.arange(CANVAS_W)[None, :] < CANVAS_W, mirrored[..., 3], 0)
            under = mirrored.copy()
            keep = canvas[..., 3] > 0
            under[keep] = canvas[keep]
            canvas = under
            del shift
        height_mm = canvas.shape[0] / PX_PER_M * 1000
        report(f"{name} {height_mm:.0f}mm", [] if height_mm <= limit_mm else [f"taller than {limit_mm}mm"])
        Image.fromarray(canvas).save(OUT / f"{layer_id}.png")
        layers.append(layer_entry(layer_id, f"{layer_id}.png", canvas, hinge_z))
        made[layer_id] = canvas

    # The lit lamp: a crop of the lamp room, lit, swapped in over it.
    room = made.get("lamp-room")
    anchor = None
    effects = {}
    if room is not None:
        ys, xs = np.nonzero(room[..., 3] > 127)
        top, bottom, left, right = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = room[top:bottom, left:right]
        lit, (lx, ly) = lit_lamp(crop)
        Image.fromarray(lit).save(OUT / "lamp-lit.png")
        h_px = room.shape[0]
        lens_x, lens_y = left + lx, top + ly
        anchor = {"layer": "lamp-room", "px": [round(lens_x), round(lens_y)], "position": [round(lens_x / PX_PER_M - 0.21, 4), round((h_px - lens_y) / PX_PER_M, 4), -0.0925]}
        effects["lamp-lit"] = {"file": "lamp-lit.png", "layer": "lamp-room", "px": [int(left), int(top)], "sizeM": [round((right - left) / PX_PER_M, 4), round((bottom - top) / PX_PER_M, 4)], "starts": "swapped over the lamp room when the lamp is lit. Same outline, so nothing moves"}
        print(f"lamp lens at {anchor['position']}")

    # The gallery floor: full-bleed, its paper calibrated to the page, its caption band left bare.
    ground = finish.calibrate_paper(np.asarray(Image.open(RUN / "lamp-ground.png").convert("RGB")))
    Image.fromarray(ground).save(OUT / "ground.png")

    shore = json.loads((SHORE / "set.json").read_text())
    set_json = {
        "id": "the-lamp",
        "name": "The lamp",
        "description": "The gallery at the top of the lighthouse, around its great lamp, high above the sea.",
        "note": "Run 011. The opening spread of chapter 1: the lighthouse up close. Same stage space and conventions as shore-path/set.json.",
        "pxPerM": round(PX_PER_M, 1),
        "ground": {"file": "ground.png", "sizeM": [0.42, 0.315], "faces": "left half on the cover's inside, right half on the page block", "captionBandM": 0.045},
        "layers": layers,
        "stack": {"topToBottom": ["lamp-sky", "lamp-room", "far-railing", "pip", "near-ledge"], "riseOrder": "top to bottom", "closeOrder": "bottom to top, then the cover", "flatOffsetM": 0.001, "backColor": "#F6EFE2"},
        "anchors": {"lighthouseLamp": anchor} if anchor else {},
        "marks": [{"id": "pip", "label": "Pip's mark", "position": [0.07, 0, -0.0175]}],
        "effects": effects,
        "moods": shore["moods"],
    }
    (OUT / "set.json").write_text(json.dumps(set_json, indent=2) + "\n")

    # The shore's own night sky, so it isn't the gap's sky any more.
    got = one_piece("night-sky")
    if got is not None:
        piece, left, _ = got
        canvas = on_canvas(piece, left, Image.open(RUN / "night-sky.png").width)
        Image.fromarray(canvas).save(SHORE / "layer-1-sky-night.png")
        sky = next(l for l in shore["layers"] if l["id"] == "layer-1-sky")
        sky["file"] = "layer-1-sky-night.png"
        sky["sizePx"] = [CANVAS_W, canvas.shape[0]]
        sky["sizeM"] = [0.42, round(canvas.shape[0] / PX_PER_M, 4)]
        (SHORE / "set.json").write_text(json.dumps(shore, indent=2) + "\n")
        report(f"night-sky {canvas.shape[0] / PX_PER_M * 1000:.0f}mm", [])

    # The lamp wick, at Pip's density, never upscaled.
    # The wick is white, so the sticker-rim stripper (which eats pale paper inward) would eat it: not used here.
    # Painted at 1K it's under Pip's density; it keeps its pixels (never upscaled) and is shown at its real 66 mm,
    # big enough to see and take, a little softer than the cast.
    got = one_piece("wick-sheet", strip=False, base=False)
    if got is not None:
        piece, _, _ = got
        obj = json.loads((ART / "objects" / "lamp-wick" / "object.json").read_text())
        Image.fromarray(piece).save(ART / "objects" / "lamp-wick" / "lamp-wick.png")
        h_mm = obj["size"]["heightM"] * 1000
        w_mm = h_mm * piece.shape[1] / piece.shape[0]
        density = piece.shape[0] / h_mm
        report(f"lamp-wick {piece.shape[1]}x{piece.shape[0]}px at {density:.1f}px/mm", [] if max(w_mm, h_mm) >= 64 and density >= 2.5 else ["too small to read"])

    if PROBLEMS:
        sys.exit("FAILED:\n" + "\n".join(PROBLEMS))
    print("done")


if __name__ == "__main__":
    main()
