"""Cuts, finishes, checks and names run 007's pieces: the gap set, the drawer, the satchel, the rope and the lit lamp.
Exits non-zero on any problem. Run from the repo root: python3 art/runs/007-art-m2/make_m2.py
Reuses run 004's cutter wrapper, finishing and checks, and run 006's sheet loader, finishing and object maker."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RUN = Path(__file__).resolve().parent
ART = RUN.parents[1]
sys.path.insert(0, str(RUN))
sys.path.insert(1, str(ART / "runs" / "006-drawer-objects"))
sys.path.insert(2, str(ART / "runs" / "004-book-and-first-set"))
import checks  # noqa: E402  (run 004)
import finish  # noqa: E402  (run 004)
import lamp  # noqa: E402
import m2_check as mc  # noqa: E402
import make_objects as mo  # noqa: E402  (run 006)
import make_pieces  # noqa: E402  (run 004: cut, paper_of)
import objects_check as oc  # noqa: E402  (run 006)

SET = ART / "sets" / "the-gap"
SHORE = json.loads((ART / "sets" / "shore-path" / "set.json").read_text())
PAGE_W_MM, PAGE_D_MM = 420, 315
SPINE_DEPTH_MM = PAGE_D_MM / 2
PIP_DEPTH_MM = 175
WALL_MM = 26
PX = mc.PIECE_PX_PER_MM

# The painter made the chasm about 50 mm wide, against 92-128. Free fix: remap the ground's columns, the same for
# every row. Knots in mm from the spine: sand, rock wall, water, rock wall, sand. Only the water widens much.
GROUND_SRC_MM = [-210, -32, -14, 16, 42, 210]
GROUND_DST_MM = [-210, -60, -38, 38, 70, 210]
GROUND_WATER = (2, 3)

# Rim layers: hinge depth from the near edge and height limit, both mm (plan, Design).
RIMS = {"layer-3-far-rim": (215, 120), "layer-4-near-rim": (115, 115)}
# Pip stands 25 mm past the near rim, right where the path ends. His legs and his paw, with whatever he holds, must
# show, so the near rim stays under MAX_IN_FRONT_OF_PIP_MM across them: a conservative test that ignores the viewing
# angle. At 35 mm his paw would reach over the right reed clump. His tail may pass behind the reeds, as on shore-path.
PIP_FROM_RIM_MM = 25


def pip_legs_mm():
    """Pip's legs and paw, left and right of his feet in mm, from his rig at 905 px per 170 mm. The paw is where the
    lantern hangs, so its right edge is the lantern's."""
    rig = json.loads((ART / "cast" / "pip" / "rig.json").read_text())
    legs, lantern = rig["parts"]["legs"], rig["parts"]["lantern"]
    legs_w = Image.open(ART / "cast" / "pip" / legs["file"]).width * legs["scale"]
    lantern_w = Image.open(ART / "cast" / "pip" / lantern["file"]).width * lantern["scale"]
    right = max(legs["x"] + legs_w, lantern["x"] + lantern_w)
    return -legs["x"] * 170 / 905, right * 170 / 905

# Each sheet's pieces, by their center on the sheet, read off contact-raw-<sheet>.png after painting.
DRAWER_SHEET = {"tray": (1032, 632), "front": (1014, 1368), "side": (902, 1730)}
SATCHEL_SHEET = {"satchel-back": (444, 558), "satchel-front": (1074, 688), "satchel-flap": (1666, 668), "rope-coil": (354, 1188), "rope-span": (1006, 1525), "thread-span": (1005, 1715)}

# Drawer pieces in mm (outer tray, front, rail), and how far each shape may be off before it's a repaint.
DRAWER_PARTS = {"tray": (190, 125, mc.TRAY_ASPECT_LIMIT), "front": (190, 26, mc.STRIP_ASPECT_LIMIT), "side": (125, None, None)}
# The painter made the rail long and thin (9.5:1 against 4.8:1). Its height is kept as painted, never upscaled, and it
# is squeezed only along its grain to 125 mm. A drawer front standing taller than its sides is how drawers are built.
MIN_GRAIN_SQUEEZE = 0.5
TRAY_INTERIOR_MM = (176, 111)
TRAY_ATTACH_X_M = 0.105
TRAVEL_M = 0.12
TRAY_WALL_THICK_MM = 7
# The painter made the back smaller than planned, and the pocket and its flap narrower than the back. All three keep
# the sheet's one scale, set so the back is 110 mm wide, so nothing is upscaled and the flap still covers the pocket.
SATCHEL_W_MM = 110
SPAN_LENGTH_MM = 130
SPAN_THICKNESS_MM = {"rope-span": (4, 9), "thread-span": (1, 3.5)}

ROPE = {
    "id": "rope-coil", "name": "coil of rope", "height_m": 0.069,
    "description": "A coil of rough hemp rope, the keeper's own, long enough to throw across a gap.",
    "tags": ["rope", "ties"], "grip": (354, 1046),  # on the top of the coil: its center is the hole
}

# Slots for the stow (plan, Design): which way each lies, where it stands, its own plane, and which way it swings.
SLOTS = [
    {"id": "ladder", "flat_x": 0, "stand_x": -66, "plane_z": 45, "turn": -1},
    {"id": "kite", "flat_x": 0, "stand_x": 45, "plane_z": 66, "turn": 1},
    {"id": "odd-sock", "flat_x": -30, "stand_x": -56, "plane_z": 82, "turn": -1},
    {"id": "spool", "flat_x": 30, "stand_x": 7, "plane_z": 72, "turn": 1},
    {"id": "brass-key", "flat_x": 40, "stand_x": 60, "plane_z": 98, "turn": 1},
]

PROBLEMS = []


def report(label, problems):
    print(label, problems or "ok")
    PROBLEMS.extend(f"{label}: {p}" for p in problems)


def bail():
    if PROBLEMS:
        sys.exit("FAILED:\n" + "\n".join(PROBLEMS))


def rgba_of(path):
    return np.asarray(Image.open(path).convert("RGBA")).copy()


def save(array, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(array).save(path)


def resize_premultiplied(rgba, width, height):
    img = Image.fromarray(rgba).convert("RGBa")
    return np.asarray(img.resize((width, height), Image.LANCZOS).convert("RGBA")).copy()


def stage(x_mm, depth_mm, up_mm=0.0):
    """Millimeters on the reference book (depth from the near edge) to contract stage space in meters."""
    return [round(x_mm / 1000, 4), round(up_mm / 1000, 4), round((SPINE_DEPTH_MM - depth_mm) / 1000, 4)]


# The ground


def ground_row(depth_mm, height):
    """The image row of a depth from the near edge. The image's top is the book's far edge."""
    return int(round(height * (1 - depth_mm / PAGE_D_MM)))


def chasm_at(rgb, depth_mm, band_mm=6):
    """(left, right) edges of the chasm at one depth, as mm from the spine, negative to the left."""
    h, w = rgb.shape[:2]
    row, band = ground_row(depth_mm, h), int(band_mm * h / PAGE_D_MM)
    found = mc.measure_gap(rgb, row - band, row + band)
    if found is None:
        return None
    per_mm = w / PAGE_W_MM
    return (found[0] - w / 2) / per_mm, (found[1] + 1 - w / 2) / per_mm


def make_ground(ladder_mm):
    raw = np.asarray(Image.open(RUN / "ground.png").convert("RGB"))
    report("ground widening", mc.column_map_problems(GROUND_SRC_MM, GROUND_DST_MM, GROUND_WATER))
    rgb = finish.calibrate_paper(mc.remap_columns(raw, GROUND_SRC_MM, GROUND_DST_MM))
    h, w = rgb.shape[:2]
    report("ground caption band", mc.caption_band_problems(rgb))
    at_pip = chasm_at(rgb, PIP_DEPTH_MM)
    if at_pip is None:
        report("ground chasm", ["no chasm found at Pip's depth"])
        return rgb, None, {}
    per_mm = w / PAGE_W_MM
    left_px, right_px = at_pip[0] * per_mm + w / 2, at_pip[1] * per_mm + w / 2 - 1
    report(f"ground chasm {at_pip[1] - at_pip[0]:.0f}mm ({at_pip[0]:.0f}, {at_pip[1]:.0f})", mc.gap_problems(left_px, right_px, w, ladder_mm))
    at_hinges = {name: chasm_at(rgb, depth) for name, (depth, _) in RIMS.items()}
    for name, edges in at_hinges.items():
        report(f"ground chasm at {name}", [] if edges else ["no chasm found at this hinge"])
    return rgb, at_pip, at_hinges


# The rims


def make_rim(name, max_h_mm, chasm):
    rgb = mo.load_sheet(f"../007-art-m2/{name}")
    report(name, [] if checks.border_is_paper(rgb) else ["paint touches the border"])
    bail()
    paper = make_pieces.paper_of(rgb)
    pieces = make_pieces.cut(rgb)
    report(f"{name} cut", oc.piece_count_problems(len(pieces), 2))
    bail()
    w = rgb.shape[1]
    bluffs = []
    for piece, cx, cy in sorted(pieces, key=lambda p: p[1]):
        done = mo.clear_shadow(piece, paper)
        problems = oc.preservation_problems(mc.raw_for_preservation(piece), done, paper) + oc.magenta_residue(done)
        done = finish.trim_base(done)
        left = int(round(cx - piece.shape[1] / 2))
        bluffs.append((done, left, problems))
    # Squeeze each bluff across, holding its outer end, so its lip lands just behind the printed chasm.
    placed = []
    for side, (piece, left, problems) in zip(("left", "right"), bluffs):
        cols = np.nonzero(piece[-1, :, 3] > 200)[0]
        if side == "left":
            outer_x, inner_x = left + cols.min(), left + cols.max() + 1
            k = mc.bluff_squeeze((w / 2 - outer_x) / mc.SET_PX_PER_MM, (w / 2 - inner_x) / mc.SET_PX_PER_MM, -chasm[0])
        else:
            outer_x, inner_x = left + cols.max() + 1, left + cols.min()
            k = mc.bluff_squeeze((outer_x - w / 2) / mc.SET_PX_PER_MM, (inner_x - w / 2) / mc.SET_PX_PER_MM, chasm[1])
        report(f"{name} {side} bluff, squeezed {k:.2f}", problems + mc.squeeze_problems(k))
        squeezed = resize_premultiplied(piece, max(1, round(piece.shape[1] * k)), piece.shape[0])
        new_left = round(outer_x - cols.min() * k) if side == "left" else round(outer_x - (cols.max() + 1) * k)
        placed.append((squeezed, new_left, side))
    height = max(p[0].shape[0] for p in placed)
    canvas = np.zeros((height, w, 4), "uint8")
    for piece, x, side in placed:
        top = height - piece.shape[0]
        if x < 0 or x + piece.shape[1] > w:
            report(f"{name} {side} bluff", ["pushed off the canvas"])
            continue
        region = canvas[top:, x : x + piece.shape[1]]
        keep = piece[..., 3] > 0
        region[keep] = piece[keep]
    if name == "layer-4-near-rim":
        feet, (left_mm, right_mm) = chasm[1] + PIP_FROM_RIM_MM, pip_legs_mm()
        report(f"{name} in front of Pip's legs and paw, {mc.height_over_mm(canvas, feet - left_mm, feet + right_mm):.0f}mm",
               mc.in_front_of_pip_problems(canvas, feet - left_mm, feet + right_mm))
    edges = mc.inner_edges_mm(canvas)
    report(f"{name} {(height - np.nonzero(canvas[..., 3] > 127)[0].min()) / mc.SET_PX_PER_MM:.0f}mm",
           mc.rim_problems(canvas, max_h_mm) + mc.rim_agreement_problems(edges, -chasm[0], chasm[1]))
    return canvas


# Sheets


def contact_raw(name, pieces):
    """The sheet with each piece's index and center, for filling in a table. Run 006's version writes into its own run."""
    from PIL import ImageDraw
    sheet = Image.open(RUN / f"{name}.png").convert("RGB")
    k = 1024 / sheet.width
    sheet = sheet.resize((1024, round(sheet.height * k)))
    draw = ImageDraw.Draw(sheet)
    for i, (_, cx, cy) in enumerate(pieces):
        draw.text((cx * k, cy * k), f"{i}: ({cx:.0f}, {cy:.0f})", fill=(255, 255, 255))
    sheet.save(RUN / f"contact-raw-{name}.png")


def cut_sheet(name, table):
    rgb = mo.load_sheet(f"../007-art-m2/{name}")
    report(name, [] if checks.border_is_paper(rgb) else ["paint touches the border"])
    bail()
    paper = make_pieces.paper_of(rgb)
    pieces = make_pieces.cut(rgb)
    report(f"{name} cut", oc.piece_count_problems(len(pieces), len(table)))
    contact_raw(name, pieces)
    bail()
    if any(center is None for center in table.values()):
        sys.exit(f"Fill in the centers for {name} from contact-raw-{name}.png, then run again.")
    found, used = {}, set()
    for piece_name, (tx, ty) in table.items():
        index = min(range(len(pieces)), key=lambda i: (pieces[i][1] - tx) ** 2 + (pieces[i][2] - ty) ** 2)
        if index in used:
            report(piece_name, [f"shares piece {index} with another"])
        used.add(index)
        found[piece_name] = pieces[index]
    return found, paper


def finished_piece(piece, paper):
    """Run 006's finishing on one cut piece, cropped to its paint. Returns (piece, problems)."""
    done = mo.clear_shadow(piece, paper)
    problems = oc.preservation_problems(mc.raw_for_preservation(piece), done, paper) + oc.magenta_residue(done)
    return mo.crop_painted(done), problems


def make_drawer(found, paper):
    made = {}
    for name, (w_mm, h_mm, limit) in DRAWER_PARTS.items():
        piece, problems = finished_piece(found[name][0], paper)
        top, bottom, left, right = oc.painted_box(piece)
        pw, ph = right - left + 1, bottom - top + 1
        if h_mm is None:
            want_w, want_h = round(w_mm * PX), ph
            squeeze = want_w / pw
            problems += mc.upscale_problems(pw, ph, want_w, want_h) + ([] if squeeze >= MIN_GRAIN_SQUEEZE else [f"grain squeeze {squeeze:.2f}"])
        else:
            want_w, want_h = round(w_mm * PX), round(h_mm * PX)
            problems += mc.aspect_problems(pw, ph, w_mm, h_mm, limit) + mc.upscale_problems(pw, ph, want_w, want_h)
        # Scale the padded crop so its painted box lands exactly on the target size.
        out = resize_premultiplied(piece, round(piece.shape[1] * want_w / pw), round(piece.shape[0] * want_h / ph))
        out = finish.remove_specks(out)
        problems += checks.check_cut(out, 20, 20, paper_rgb=paper)
        report(f"drawer {name} {out.shape[1]}x{out.shape[0]}px, painted {want_w / PX:.0f}x{want_h / PX:.1f}mm", problems)
        made[name] = out
    return made


def make_satchel(found, paper):
    made = {}
    finished = {name: finished_piece(found[name][0], paper) for name in ("satchel-back", "satchel-front", "satchel-flap")}
    _, _, left, right = oc.painted_box(finished["satchel-back"][0])
    k = round(SATCHEL_W_MM * PX) / (right - left + 1)
    for name, (piece, problems) in finished.items():
        problems = problems + ([f"upscale {k:.2f}"] if k > 1 else [])
        if name == "satchel-flap":
            pocket, flap = oc.painted_box(finished["satchel-front"][0]), oc.painted_box(piece)
            problems += [] if flap[3] - flap[2] >= pocket[3] - pocket[2] else ["flap narrower than the pocket"]
        out = finish.remove_specks(resize_premultiplied(piece, round(piece.shape[1] * k), round(piece.shape[0] * k)))
        problems += checks.check_cut(out, 20, 20, paper_rgb=paper)
        report(f"{name} {out.shape[1]}x{out.shape[0]}px", problems)
        made[name] = out
    for name in ("rope-span", "thread-span"):
        piece, problems = finished_piece(found[name][0], paper)
        top, bottom, left, right = oc.painted_box(piece)
        pw, ph, want = right - left + 1, bottom - top + 1, round(SPAN_LENGTH_MM * PX)
        problems += mc.upscale_problems(pw, 1, want, 1)
        k = want / pw
        out = finish.remove_specks(resize_premultiplied(piece, round(piece.shape[1] * k), max(1, round(piece.shape[0] * k))))
        thick_mm = ph * k / PX
        lo, hi = SPAN_THICKNESS_MM[name]
        problems += [] if lo <= thick_mm <= hi else [f"thickness {thick_mm:.1f} mm, wanted {lo}-{hi}"]
        problems += checks.check_cut(out, 20, 3, paper_rgb=paper)
        report(f"{name} {out.shape[1]}x{out.shape[0]}px {thick_mm:.1f}mm thick", problems)
        made[name] = (out, thick_mm)
    piece, cx, cy = found["rope-coil"]
    rope = dict(ROPE)
    out, density, problems = mo.make(rope, mc.raw_for_preservation(piece), (cx, cy), paper)
    report(f"rope-coil {out.shape[1]}x{out.shape[0]}px sheet {density:.1f}px/mm", problems)
    made["rope-coil"] = (out, rope)
    return made


# The drawer's stow, with the objects' real painted sizes


def object_sizes(object_id):
    d = json.loads((ART / "objects" / object_id / "object.json").read_text())
    rgba = rgba_of(ART / d["art"]["path"])
    top, bottom, left, right = oc.painted_box(rgba)
    per_mm = rgba.shape[0] / (d["size"]["heightM"] * 1000)
    return (bottom - top + 1) / per_mm, (right - left + 1) / per_mm


def drawer_slots():
    slots = []
    for s in SLOTS:
        length, width = object_sizes(s["id"])
        slots.append(dict(s, length=round(length, 1), width=round(width, 1)))
    clearance = TRAVEL_M * 1000 - DRAWER_PARTS["tray"][1] + TRAY_WALL_THICK_MM
    report("drawer stow", mc.drawer_problems(slots, *TRAY_INTERIOR_MM, clearance, WALL_MM))
    return slots, clearance


# The lit lamp


def make_lamp():
    original, lit, box = lamp.lit_card()
    report("lamp-lit", mc.lamp_problems(original, lit, box))
    return lit


# Data


def layer_entry(layer_id, file, size_px, hinge_depth_mm):
    return {
        "id": layer_id, "file": file, "sizePx": list(size_px),
        "sizeM": [round(size_px[0] / mc.SET_PX_PER_MM / 1000, 4), round(size_px[1] / mc.SET_PX_PER_MM / 1000, 4)],
        "hinge": [stage(-210, hinge_depth_mm), stage(210, hinge_depth_mm)],
        "splitColumnPx": size_px[0] // 2, "standingDeg": 0, "flatDeg": 90,
    }


def write_set(rims, at_pip, ladder_mm, spans):
    shore = {layer["id"]: layer for layer in SHORE["layers"]}
    layers = []
    for layer_id in ("layer-1-sky", "layer-2-headland"):
        entry = dict(shore[layer_id], file=f"../shore-path/{shore[layer_id]['file']}")
        layers.append(entry)
    for name, (depth, _) in RIMS.items():
        h, w = rims[name].shape[:2]
        layers.append(layer_entry(name, f"{name}.png", (w, h), depth))
    left_mm, right_mm = at_pip
    card_top, _, card_left, _ = lamp.CARD
    lamp_h, lamp_w = (lamp.CARD[1] - lamp.CARD[0]), (lamp.CARD[3] - lamp.CARD[2])
    data = {
        "id": "the-gap",
        "name": "The gap",
        "description": "The sandy path ends at a narrow chasm in the dunes, with the lighthouse waiting on the far side.",
        "note": "The gap set, as the art proposes it. Same stage space and conventions as shore-path/set.json. The sky and headland are shore-path's own, so the lighthouse, its lamp anchor and the beam's origin don't move between sets. Re-check on the Quest.",
        "reference": SHORE["reference"],
        "pxPerM": SHORE["pxPerM"],
        "ground": {"file": "ground.png", "sizeM": [0.42, 0.315], "faces": SHORE["ground"]["faces"], "captionBandM": SHORE["ground"]["captionBandM"]},
        "layers": layers,
        "angles": SHORE["angles"],
        "stack": dict(SHORE["stack"], topToBottom=["layer-1-sky", "layer-2-headland", "layer-3-far-rim", "pip", "layer-4-near-rim"]),
        "gapM": {
            "note": "The chasm printed on the ground, measured at Pip's depth. The ladder's span is its painted length, without the PNG's padding.",
            "left": round(left_mm / 1000, 4), "right": round(right_mm / 1000, 4),
            "atZ": stage(0, PIP_DEPTH_MM)[2], "ladderSpanM": round(ladder_mm / 1000, 4),
        },
        "anchors": SHORE["anchors"],
        "marks": [
            {"id": "near-edge", "label": "the near edge of the gap", "position": stage(right_mm + PIP_FROM_RIM_MM, PIP_DEPTH_MM)},
            {"id": "far-side", "label": "the far side of the gap", "position": stage(left_mm - PIP_FROM_RIM_MM, PIP_DEPTH_MM)},
            {"id": "gap-middle", "label": "over the middle of the gap", "position": stage(0, PIP_DEPTH_MM)},
            {"id": "wick-arrives", "label": "the path on the far side", "position": stage(-130, PIP_DEPTH_MM)},
            {"id": "lighthouse-way", "label": "the way to the lighthouse", "position": stage(-190, PIP_DEPTH_MM)},
            {"id": "moth-hover", "label": "in the air above the gap", "position": stage(0, PIP_DEPTH_MM, 90)},
        ],
        "pip": SHORE["pip"],
        "effects": {
            "lamp-lit": {
                "file": "../../fx/lamp-lit.png", "layer": "layer-2-headland", "px": [card_left, card_top],
                "sizeM": [round(lamp_w / mc.SET_PX_PER_MM / 1000, 4), round(lamp_h / mc.SET_PX_PER_MM / 1000, 4)],
                "starts": "swapped over the headland at px when the lamp is relit. Same outline, so nothing moves",
            },
            "rope-span": {"file": "../../fx/rope-span.png", "lengthM": SPAN_LENGTH_MM / 1000, "thicknessM": round(spans["rope-span"] / 1000, 4),
                          "starts": "stretched across the gap from rim to rim, at Pip's depth"},
            "thread-span": {"file": "../../fx/thread-span.png", "lengthM": SPAN_LENGTH_MM / 1000, "thicknessM": round(spans["thread-span"] / 1000, 4),
                            "starts": "stretched across the gap from rim to rim, at Pip's depth"},
        },
        "moods": SHORE["moods"],
    }
    (SET / "set.json").write_text(json.dumps(data, indent=2) + "\n")


def write_drawer(slots, clearance, side_h_mm):
    w_mm, d_mm, _ = DRAWER_PARTS["tray"]
    data = {
        "note": "The drawer, as the art proposes it. Same stage space as book.json. Pieces are at Pip's density, 905 px per 170 mm. Re-check on the Quest.",
        "tray": {"file": "tray.png", "face": "seen from above: the felt floor and the inside of the walls", "sizeM": [w_mm / 1000, d_mm / 1000],
                 "interiorM": [TRAY_INTERIOR_MM[0] / 1000, TRAY_INTERIOR_MM[1] / 1000], "wallHeightM": WALL_MM / 1000},
        "front": {"file": "front.png", "face": "the near face, carrying book/drawer-pull.png at its center", "sizeM": [DRAWER_PARTS["front"][0] / 1000, DRAWER_PARTS["front"][1] / 1000]},
        "side": {"file": "side.png", "face": "both outer sides, the left one mirrored. Bottom-aligned with the front, which stands a little taller",
                 "sizeM": [DRAWER_PARTS["side"][0] / 1000, round(side_h_mm / 1000, 4)]},
        "attach": {"centerX": TRAY_ATTACH_X_M, "edgeZ": round(SPINE_DEPTH_MM / 1000, 4), "under": "the page block, below the pages",
                   "slides": "along +z, toward the reader", "travelM": TRAVEL_M, "clearanceAtFullTravelM": round(clearance / 1000, 4)},
        "stow": [
            "Closed and while sliding, every object lies flat on the felt, its long axis across the tray, centered at flatXM.",
            "Only at full travel, when the whole interior has cleared the book's edge: each tips up onto its long edge about a hinge at planeZM from the back wall, lying behind that line while flat, the way the set's cards stand up.",
            "Then it swings upright in that plane, sliding to standXM, with its lowest point kept on the felt. turn is the way it swings, so its low end moves away from the nearer wall.",
            "Closing runs the same steps backward, all objects flat before the tray moves.",
        ],
        "slots": [
            {"object": s["id"], "flatXM": s["flat_x"] / 1000, "standXM": s["stand_x"] / 1000, "planeZM": s["plane_z"] / 1000, "turn": s["turn"],
             "paintedLengthM": round(s["length"] / 1000, 4), "paintedWidthM": round(s["width"] / 1000, 4)}
            for s in slots
        ],
    }
    (ART / "book" / "drawer" / "drawer.json").write_text(json.dumps(data, indent=2) + "\n")


def write_satchel(made):
    def size(name):
        h, w = made[name].shape[:2]
        return [round(w / PX / 1000, 4), round(h / PX / 1000, 4)]

    data = {
        "note": "The satchel, as the art proposes it. Same stage space as book.json. Pieces are at Pip's density, 905 px per 170 mm. Re-check on the Quest.",
        "parts": {
            "back": {"file": "satchel-back.png", "sizeM": size("satchel-back"), "z": 0, "face": "back panel and strap, standing facing the reader"},
            "front": {"file": "satchel-front.png", "sizeM": size("satchel-front"), "z": 0.012, "face": "front pocket, its bottom on the back's bottom. Objects go between back and front"},
            "flap": {"file": "satchel-flap.png", "sizeM": size("satchel-flap"), "z": 0.014,
                     "face": "the pocket's flap, hinged at its top edge along the pocket's top edge. Closed it hangs over the pocket; open it lifts back over the bag"},
        },
        "position": [0.29, 0, 0.06],
        "positionNote": "A suggestion: right of the book's fore-edge, within the 0.6 m reach. The gold tab opens it.",
        "flap": {"closedDeg": 0, "openDeg": -150},
    }
    (ART / "satchel" / "satchel.json").write_text(json.dumps(data, indent=2) + "\n")


def contact(images, path):
    """Every finished piece at its own scale, on page and on night navy, for review."""
    scale = 0.45
    thumbs = [Image.fromarray(a).resize((max(1, int(a.shape[1] * scale)), max(1, int(a.shape[0] * scale))), Image.LANCZOS) for a in images]
    gap = 30
    width = max(1400, max(t.width for t in thumbs) + 2 * gap)
    rows, row, x = [], [], gap
    for t in thumbs:
        if row and x + t.width > width:
            rows.append(row)
            row, x = [], gap
        row.append(t)
        x += t.width + gap
    rows.append(row)
    height = sum(max(t.height for t in r) + gap for r in rows) + gap
    sheet = Image.new("RGB", (width, height * 2), mo.PAGE)
    sheet.paste(Image.new("RGB", (width, height), mo.NAVY), (0, height))
    for base in (0, height):
        y = base + gap
        for r in rows:
            x = gap
            for t in r:
                sheet.paste(t, (x, y), t)
                x += t.width + gap
            y += max(t.height for t in r) + gap
    sheet.save(path)


def main():
    ladder = rgba_of(ART / "objects" / "ladder" / "ladder.png")
    ladder_mm = mc.painted_length_mm(ladder, json.loads((ART / "objects/ladder/object.json").read_text())["size"]["heightM"] * 1000)
    ground, at_pip, at_hinges = make_ground(ladder_mm)
    bail()
    rims = {name: make_rim(name, limit, at_hinges[name]) for name, (_, limit) in RIMS.items()}
    drawer_found, drawer_paper = cut_sheet("drawer-sheet", DRAWER_SHEET)
    satchel_found, satchel_paper = cut_sheet("satchel-sheet", SATCHEL_SHEET)
    drawer = make_drawer(drawer_found, drawer_paper)
    satchel = make_satchel(satchel_found, satchel_paper)
    slots, clearance = drawer_slots()
    lit = make_lamp()
    bail()
    save(ground, SET / "ground.png")
    for name, a in rims.items():
        save(a, SET / f"{name}.png")
    for name, a in drawer.items():
        save(a, ART / "book" / "drawer" / f"{name}.png")
    for name in ("satchel-back", "satchel-front", "satchel-flap"):
        save(satchel[name], ART / "satchel" / f"{name}.png")
    spans = {}
    for name in ("rope-span", "thread-span"):
        save(satchel[name][0], ART / "fx" / f"{name}.png")
        spans[name] = satchel[name][1]
    rope, rope_obj = satchel["rope-coil"]
    save(rope, ART / "objects" / "rope-coil" / "rope-coil.png")
    (ART / "objects" / "rope-coil" / "object.json").write_text(json.dumps(mo.object_json(rope_obj), indent=2) + "\n")
    save(lit, ART / "fx" / "lamp-lit.png")
    write_set(rims, at_pip, ladder_mm, spans)
    side = drawer["side"]
    write_drawer(slots, clearance, (oc.painted_box(side)[1] - oc.painted_box(side)[0] + 1) / PX)
    write_satchel({k: satchel[k] for k in ("satchel-back", "satchel-front", "satchel-flap")})
    contact([*drawer.values(), satchel["satchel-back"], satchel["satchel-front"], satchel["satchel-flap"], rope,
             satchel["rope-span"][0], satchel["thread-span"][0], lit], RUN / "contact.png")
    print("wrote the gap set, drawer, satchel, rope, spans and lit lamp")


if __name__ == "__main__":
    main()
