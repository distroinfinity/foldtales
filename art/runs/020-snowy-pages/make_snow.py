"""Run 020's free pass: chapter 3's sets under snow, from their own paint, for no credits.

Watercolour shows snow as the paper itself, with cool blue-grey shadows. So rather than paint
white over a piece, this treats every pixel as paper seen through pigment, and:

- **washes:** turns warm, light washes (sand, pale stone) into cool blue-grey ones of the same
  strength, so every stroke and grain stays and the paper reads as fresh snow;
- **caps:** lays a soft cap of snow along each upward-facing edge of a standing piece, inside its
  outline, with a cool shadow and a faint pencil line under it;
- **rime:** feathers frost into the lamp room's glass from its bars.

Every piece keeps its alpha exactly (run 007's lit-window lesson), so no outline, hinge, anchor or
mark can move. Unchanged pieces (skies, headland) aren't copied: the snowy set.json points at them.

Usage, from the repo root:
  python3 art/runs/020-snowy-pages/make_snow.py [the-lamp|the-gap|the-landing ...] [--preview DIR]
Needs numpy, scipy and Pillow.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "art"
SNOW_TEX = ART / "room-fx/weather/snow-cover.png"

PAPER = np.array([0.958, 0.928, 0.872])           # the book's paper, measured on the gap's ground
COOL = np.array([1.18, 1.0, 0.72])                # blue-grey pigment: takes more red than blue
COOL = COOL / COOL.mean()
SHADOW = np.array([0.70, 0.76, 0.86])             # a cap's cool underside
GRAPHITE = np.array([0.36, 0.36, 0.40])


def load(path):
    im = Image.open(path)
    has_alpha = im.mode in ("RGBA", "LA")
    arr = np.asarray(im.convert("RGBA" if has_alpha else "RGB")).astype(np.float64) / 255.0
    return (arr[..., :3], arr[..., 3]) if has_alpha else (arr, None)


def save(path, rgb, alpha):
    path.parent.mkdir(parents=True, exist_ok=True)
    out = np.clip(rgb, 0, 1)
    if alpha is not None:
        out = np.dstack([out, alpha])
    Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save(path, optimize=True)


def smoothstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def noise(shape, scale, seed):
    """Soft value noise in 0..1, about `scale` pixels across."""
    rng = np.random.default_rng(seed)
    small = rng.random((max(2, shape[0] // scale + 2), max(2, shape[1] // scale + 2)))
    big = np.asarray(Image.fromarray((small * 255).astype(np.uint8)).resize((shape[1], shape[0]), Image.BICUBIC)).astype(np.float64) / 255
    return ndimage.gaussian_filter(big, scale / 6)


def snow_texture(shape, scale=1.0):
    """Run 014's painted snow, tiled (it repeats), as shading about its mean: -1..1-ish."""
    tex, _ = load(SNOW_TEX)
    lum = 0.3 * tex[..., 0] + 0.55 * tex[..., 1] + 0.15 * tex[..., 2]
    if scale != 1.0:
        lum = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).resize((int(lum.shape[1] * scale), int(lum.shape[0] * scale)), Image.BICUBIC)).astype(np.float64) / 255
    reps = (shape[0] // lum.shape[0] + 1, shape[1] // lum.shape[1] + 1)
    tiled = np.tile(lum, reps)[: shape[0], : shape[1]]
    return (tiled - tiled.mean()) / (tiled.std() + 1e-6)


def absorbance(rgb, paper=PAPER):
    """Pigment over paper, per channel: 0 is bare paper."""
    return -np.log(np.clip(rgb / paper, 1e-3, 1.5))


def from_absorbance(a, paper=PAPER):
    return paper * np.exp(-a)


def paper_of(rgb):
    """A printed ground's own paper: the median of its top and bottom edges, which are bare."""
    edge = np.concatenate([rgb[: rgb.shape[0] // 40].reshape(-1, 3), rgb[-rgb.shape[0] // 40 :].reshape(-1, 3)])
    return np.median(edge, axis=0)


def cool_washes(rgb, keep_mask=None, lo=0.16, hi=0.34, lift=0.0, hollows=0.0, seed=1, blue=(0.02, 0.10), paper=PAPER):
    """Turns light warm washes into cool blue-grey of the same strength; darker paint (cliffs, rock,
    water, metal) fades out of the change between `lo` and `hi` density. `lift` thins the light
    washes too (more paper, more snow); `hollows` adds run 014's soft drifts inside the land."""
    a = absorbance(rgb, paper)
    d = np.clip(a.mean(axis=2), 0, None)
    # Bare paper (and anything lighter) is left exactly as it is.
    m_paper = smoothstep(d, 0.005, 0.03)
    # Blue pigment (sea, sky) absorbs red more than blue: it isn't sand, so it stays.
    is_blue = smoothstep(a[..., 0] - a[..., 2], blue[0], blue[1])
    m = (1 - smoothstep(d, lo, hi)) * (1 - is_blue) * m_paper
    if keep_mask is not None:
        m = m * (1 - keep_mask)
    d_new = d * (1 - lift)
    if hollows:
        tex = snow_texture(d.shape, 1.6)
        land = ndimage.gaussian_filter(m * smoothstep(d, 0.03, 0.08), 25)
        d_new = d_new + hollows * np.clip(-tex, 0, None) * land
    cooled = from_absorbance(d_new[..., None] * COOL[None, None, :], paper)
    return rgb * (1 - m[..., None]) + cooled * m[..., None], m


def run_depth(opaque):
    """For each pixel of a piece, how far it is below the top of its column's run of paint."""
    depth = np.zeros(opaque.shape, dtype=np.float64)
    for y in range(opaque.shape[0]):
        if y == 0:
            depth[y] = np.where(opaque[y], 1, 0)
        else:
            depth[y] = np.where(opaque[y], depth[y - 1] + 1, 0)
    return depth


def caps(rgb, alpha, thick_px, seed=3, skip_px=2, avoid=None, x0=0, full_w=None):
    """Snow along each upward-facing edge, inside the outline: a soft wobbly cap, a cool shadow
    underneath, a faint pencil line at its lower edge. `avoid` (0..1) keeps snow off some paint.
    `x0` and `full_w` place a piece swapped over a wider one (the lit lamp over the lamp room), so
    both get the very same cap and nothing jumps when the lamp lights."""
    h, w = alpha.shape
    depth = run_depth(alpha > 0.5)
    fw = full_w or w
    wob = noise((1, fw), 60, seed)[0][x0 : x0 + w]
    fine = noise((1, fw), 9, seed + 1)[0][x0 : x0 + w]
    t = thick_px * (0.55 + 0.7 * wob) * (0.85 + 0.3 * fine)
    t = t[None, :]
    inside = (depth > skip_px).astype(np.float64)
    body = smoothstep(t - depth, -1.5, 1.5) * inside
    if avoid is not None:
        body = body * (1 - avoid)
    body = ndimage.gaussian_filter(body, 0.8)
    tex = snow_texture((h, w), 0.5)
    under = np.clip(depth / np.maximum(t, 1), 0, 1)          # 0 at the top of the cap, 1 at its foot
    snow = np.ones((h, w, 3)) * np.array([0.975, 0.975, 0.97])
    snow = snow * (1 - 0.35 * smoothstep(under, 0.45, 1.0))[..., None] + SHADOW * (0.35 * smoothstep(under, 0.45, 1.0))[..., None]
    snow = snow * (1 + 0.025 * tex)[..., None]
    out = rgb * (1 - body[..., None]) + snow * body[..., None]
    # The pencil line where the snow ends, as the book outlines everything.
    edge = np.clip(body - ndimage.grey_erosion(body, size=(3, 1)), 0, 1) * (depth > t * 0.6)
    edge = ndimage.gaussian_filter(edge, 0.6) * 0.45
    out = out * (1 - edge[..., None]) + GRAPHITE * edge[..., None]
    # A soft cool shadow on the paint just under the cap.
    below = smoothstep(depth - t, 0, 2.5) * (1 - smoothstep(depth - t, 3, 10)) * inside
    if avoid is not None:
        below = below * (1 - avoid)
    out = out * (1 - 0.12 * below[..., None]) + SHADOW * (0.12 * below[..., None])
    return out


def rime(rgb, alpha, glass, strength=0.75, reach_px=40, seed=5):
    """Frost feathering in from the edges of each pane: the glass whitens near its bars."""
    bars = (glass < 0.5) & (alpha > 0.5)
    dist = ndimage.distance_transform_edt(~bars)
    tex = snow_texture(alpha.shape, 0.35)
    feather = noise(alpha.shape, 14, seed)
    reach = reach_px * (0.6 + 0.8 * feather)
    f = (1 - smoothstep(dist, 0, reach)) * glass * strength
    f = np.clip(f * (0.8 + 0.25 * tex), 0, 1)
    frost = np.array([0.93, 0.95, 0.98])
    return rgb * (1 - f[..., None]) + frost * f[..., None]


def glass_mask(rgb, alpha):
    """The lamp room's panes: pale, cool, smooth paint (not the dark bars, brass or stone)."""
    a = absorbance(rgb)
    d = a.mean(axis=2)
    pale = 1 - smoothstep(d, 0.18, 0.32)
    cool = smoothstep(a[..., 0] - a[..., 2], -0.01, 0.04)
    return ndimage.gaussian_filter(pale * cool * (alpha > 0.5), 1.0)


# --- per set -----------------------------------------------------------------------------------

def the_gap(out_dir):
    base = ART / "sets/the-gap"
    rgb, _ = load(base / "ground.png")
    snowy, _ = cool_washes(rgb, lo=0.22, hi=0.46, lift=0.1, paper=paper_of(rgb))
    save(out_dir / "ground.png", snowy, None)
    for name, thick in (("layer-3-far-rim.png", 30), ("layer-4-near-rim.png", 40)):
        rgb, alpha = load(base / name)
        a = absorbance(rgb)
        grass = smoothstep(a[..., 2] - a[..., 0], 0.12, 0.3) * smoothstep(a.mean(axis=2), 0.15, 0.3)
        snowy, _ = cool_washes(rgb, keep_mask=grass, lo=0.22, hi=0.46, lift=0.1)
        # Grass blades are too thin to carry a cap: snow lies on the sand, not along every blade.
        snowy = caps(snowy, alpha, thick, avoid=ndimage.grey_dilation(grass, size=(9, 9)))
        save(out_dir / name, snowy, alpha)
    return ["ground.png", "layer-3-far-rim.png", "layer-4-near-rim.png"]


def the_lamp(out_dir):
    base = ART / "sets/the-lamp"
    rgb, _ = load(base / "ground.png")
    snowy, _ = cool_washes(rgb, lo=0.22, hi=0.40, lift=0.5, paper=paper_of(rgb))
    save(out_dir / "ground.png", snowy, None)
    for name, thick in (("near-ledge.png", 14), ("far-railing.png", 6)):
        rgb, alpha = load(base / name)
        save(out_dir / name, caps(rgb, alpha, thick), alpha)
    rgb, alpha = load(base / "lamp-room.png")
    g = glass_mask(rgb, alpha)
    room = caps(rime(rgb, alpha, g, strength=0.95, reach_px=70), alpha, 26, avoid=g)
    save(out_dir / "lamp-room.png", room, alpha)
    room_w = alpha.shape[1]
    room_glass = g
    spec = json.loads((base / "set.json").read_text())["effects"]["lamp-lit"]
    x0, y0 = spec["px"]
    rgb, alpha = load(base / "lamp-lit.png")
    g = glass_mask(rgb, alpha)
    # The cap keeps off the same glass as the lamp room's, so the two match exactly where they overlap.
    keep_off = room_glass[y0 : y0 + alpha.shape[0], x0 : x0 + alpha.shape[1]]
    lit = caps(rime(rgb, alpha, g, strength=0.35, reach_px=16), alpha, 26, avoid=keep_off, x0=x0, full_w=room_w)
    save(out_dir / "lamp-lit.png", lit, alpha)
    return ["ground.png", "near-ledge.png", "far-railing.png", "lamp-room.png", "lamp-lit.png"]


def the_landing(out_dir):
    """Lane B's run 018. Grey stone already: its pale treads and rock tops lift toward the paper (the
    snow), its shaded sides and the dark sea keep their paint. Only strongly blue paint (the sea)
    counts as blue here, since the stone itself is a cool grey."""
    base = ART / "sets/the-landing"
    rgb, _ = load(base / "ground.png")
    snowy, _ = cool_washes(rgb, lo=0.20, hi=0.42, lift=0.55, blue=(0.10, 0.25), paper=paper_of(rgb))
    save(out_dir / "ground.png", snowy, None)
    rgb, alpha = load(base / "layer-3-far-rocks.png")
    a = absorbance(rgb)
    sea = smoothstep(a[..., 0] - a[..., 2], 0.10, 0.25) * smoothstep(a.mean(axis=2), 0.5, 0.8)
    save(out_dir / "layer-3-far-rocks.png", caps(rgb, alpha, 22, avoid=sea), alpha)
    rgb, alpha = load(base / "layer-4-near-steps.png")
    a = absorbance(rgb)
    grass = smoothstep(a[..., 2] - a[..., 0], 0.05, 0.2) * smoothstep(a.mean(axis=2), 0.15, 0.3)
    snowy, _ = cool_washes(rgb, keep_mask=grass, lo=0.20, hi=0.42, lift=0.35, blue=(0.10, 0.25))
    save(out_dir / "layer-4-near-steps.png", caps(snowy, alpha, 30, avoid=ndimage.grey_dilation(grass, size=(9, 9))), alpha)
    return ["ground.png", "layer-3-far-rocks.png", "layer-4-near-steps.png"]


SETS = {"the-gap": the_gap, "the-lamp": the_lamp, "the-landing": the_landing}


def snowy_set_json(name, made):
    """The base set's spec, with each snowy piece swapped in and every other file pointed back at the base set."""
    spec = json.loads((ART / f"sets/{name}/set.json").read_text())
    spec["id"] = f"{name}-snow"
    spec["name"] = f"{spec['name']}, in the snow"
    spec["note"] = f"Run 020: {name} under snow, made free from its own paint (make_snow.py). Every piece keeps its alpha, so marks, hinges and anchors are the base set's. Unchanged pieces point back at the base set."

    def repoint(file):
        # A snowy piece sits beside set.json; a base piece is one folder over; a path that already
        # leaves the base set's folder ("../shore-path/...", "../../fx/...") works from here as it is.
        if file in made or file.startswith(".."):
            return file
        return f"../{name}/{file}"

    spec["ground"]["file"] = repoint(spec["ground"]["file"])
    for layer in spec["layers"]:
        layer["file"] = repoint(layer["file"])
    for effect in spec.get("effects", {}).values():
        effect["file"] = repoint(effect["file"])
    return spec


def main(argv):
    preview = argv[argv.index("--preview") + 1] if "--preview" in argv else None
    names = [a for a in argv if not a.startswith("--") and a != preview] or list(SETS)
    for name in names:
        out_dir = ART / f"sets/{name}-snow"
        made = SETS[name](out_dir)
        spec = snowy_set_json(name, made)
        (out_dir / "set.json").write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n")
        print(f"{name}-snow: {', '.join(made)}")
        if preview:
            Path(preview).mkdir(parents=True, exist_ok=True)
            for f in made:
                b = Image.open(ART / f"sets/{name}/{f}").convert("RGBA")
                s = Image.open(out_dir / f).convert("RGBA")
                w = 1400
                hh = int(b.height * w / b.width)
                sheet = Image.new("RGB", (w, hh * 2 + 10), (58, 68, 90))
                for i, im in enumerate((b, s)):
                    im = im.resize((w, hh), Image.LANCZOS)
                    bg = Image.new("RGBA", im.size, (58, 68, 90, 255))
                    bg.alpha_composite(im)
                    sheet.paste(bg.convert("RGB"), (0, i * (hh + 10)))
                sheet.save(Path(preview) / f"{name}-{f.replace('.png', '')}.jpg", quality=85)


if __name__ == "__main__":
    main(sys.argv[1:])
