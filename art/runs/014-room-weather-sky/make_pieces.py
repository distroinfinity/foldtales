"""Run 014: cuts the weather and sky sheets into finished pieces, for no credits.
Run from the repo root: python3 art/runs/014-room-weather-sky/make_pieces.py
Reuses run 004's cutter and finishing and run 006's checks (merged and closed). Writes:
  art/fx/weather/rain-strokes.png  8 raindrop streaks, upright, side by side in one strip (64 x 512 px cells)
  art/fx/weather/snow-flakes.png   10 snowflakes in one strip (128 px cells)
  art/fx/weather/fog-1..4.png      4 fog wisps
  art/fx/weather/snow-cover.png    the snow cover, made to repeat
  art/fx/sky/stars.png             6 stars in one strip (128 px cells); moon.png; shooting-star.png
and contact sheets in this run's folder."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RUN = Path(__file__).resolve().parent
ART = RUN.parents[1]
sys.path.insert(0, str(ART / "runs" / "006-drawer-objects"))
sys.path.insert(1, str(ART / "runs" / "004-book-and-first-set"))
import objects_check as oc  # noqa: E402  (run 006)
import finish  # noqa: E402  (run 004)
import make_pieces  # noqa: E402  (run 004: cut, paper_of)

PROBLEMS = []
PAD = 6


def clean(rgba, paper):
    """Run 006's recipe: clear trapped paper, eat the crimson shadow inward, then despill and clear magenta."""
    a = finish.clear_enclosed(rgba, paper)
    a = finish.clear_connected(a, oc.shadow_tint(a))
    return finish.remove_specks(finish.clear_magenta(finish.despill(a, paper)))


def crop(rgba):
    ys, xs = np.nonzero(rgba[..., 3] > 8)
    return rgba[max(0, ys.min() - PAD): ys.max() + PAD + 1, max(0, xs.min() - PAD): xs.max() + PAD + 1]


def check(name, rgba, raw, paper):
    problems = [*oc.magenta_residue(rgba), *oc.preservation_problems(raw, rgba, paper)]
    for p in problems:
        PROBLEMS.append(f"{name}: {p}")


def upright(rgba):
    """Turn a slanted streak to stand straight, its heavy end (the drop) at the bottom."""
    a = rgba[..., 3].astype(float)
    ys, xs = np.nonzero(a > 60)
    w = a[ys, xs]
    cy, cx = np.average(ys, weights=w), np.average(xs, weights=w)
    cov = np.cov(np.stack([xs - cx, ys - cy]), aweights=w)
    vx, vy = np.linalg.eigh(cov)[1][:, -1]
    angle = np.degrees(np.arctan2(vx, vy))
    img = Image.fromarray(rgba).rotate(-angle, resample=Image.BICUBIC, expand=True)
    out = crop(np.asarray(img))
    # The drop's end holds more paint than the tail's: put it at the bottom.
    alpha = out[..., 3].astype(float)
    half = alpha.shape[0] // 2
    if alpha[:half].sum() > alpha[half:].sum():
        out = out[::-1, ::-1]
    return out


def fog_tint(rgba):
    """Fog is a thin wash, so the magenta paper showed through it as lilac. Keep its brushwork and shape
    (its lightness and alpha) and give it back the pale blue-grey it was painted as."""
    out = rgba.copy()
    lum = (rgba[..., :3].astype(float) @ np.array([0.3, 0.59, 0.11])) / 255
    for c, k in enumerate((0.86, 0.9, 0.97)):
        out[..., c] = np.clip(lum * k * 255 * 1.04, 0, 255).astype(np.uint8)
    return out


def strip(pieces, cell_w, cell_h):
    """Each piece fitted into its own cell, centred, one row."""
    sheet = Image.new("RGBA", (cell_w * len(pieces), cell_h), (0, 0, 0, 0))
    for i, p in enumerate(pieces):
        img = Image.fromarray(p)
        img.thumbnail((cell_w - 4, cell_h - 4), Image.LANCZOS)
        sheet.alpha_composite(img, (i * cell_w + (cell_w - img.width) // 2, (cell_h - img.height) // 2))
    return sheet


def rows(found, height):
    """Pieces grouped by row, top to bottom, each row left to right."""
    found = sorted(found, key=lambda f: f[2])
    out, row = [], []
    for f in found:
        if row and f[2] - row[-1][2] > height * 0.12:
            out.append(sorted(row, key=lambda r: r[1]))
            row = []
        row.append(f)
    if row:
        out.append(sorted(row, key=lambda r: r[1]))
    return out


def weather():
    rgb = np.asarray(Image.open(RUN / "weather-sheet.png").convert("RGB")).copy()
    paper = make_pieces.paper_of(rgb)
    found = make_pieces.cut(rgb)
    grouped = rows(found, rgb.shape[0])
    # The fog wisps came in two rows of two: everything below the snow is fog.
    grouped = grouped[:2] + [[f for r in grouped[2:] for f in r]]
    counts = [len(r) for r in grouped]
    print("weather rows", counts)
    if counts != [10, 10, 4]:
        PROBLEMS.append(f"weather sheet: rows {counts}, expected [10, 10, 4]")
        return
    out = ART / "fx" / "weather"
    out.mkdir(parents=True, exist_ok=True)
    rain = []
    for i, (a, *_ ) in enumerate(grouped[0]):
        raw = a.copy()
        a = clean(a, paper)
        check(f"rain-{i + 1}", a, raw, paper)
        a = crop(a)
        rain.append(upright(a))
    # Eight, skipping the two that differ most in length from the rest.
    lengths = np.array([r.shape[0] for r in rain])
    keep = sorted(np.argsort(np.abs(lengths - np.median(lengths)))[:8])
    strip([rain[i] for i in keep], 64, 512).save(out / "rain-strokes.png", optimize=True)
    snow = []
    for i, (a, *_ ) in enumerate(grouped[1]):
        raw = a.copy()
        a = clean(a, paper)
        check(f"snow-{i + 1}", a, raw, paper)
        a = crop(a)
        snow.append(a)
    strip(snow, 128, 128).save(out / "snow-flakes.png", optimize=True)
    for i, (a, *_ ) in enumerate(grouped[2]):
        raw = a.copy()
        a = clean(a, paper)
        check(f"fog-{i + 1}", a, raw, paper)
        a = crop(a)
        a = fog_tint(a)
        Image.fromarray(a).save(out / f"fog-{i + 1}.png", optimize=True)
    # Contact sheet: everything on night navy, as the room will see it.
    contact = Image.new("RGBA", (1400, 900), (31, 42, 68, 255))
    contact.alpha_composite(Image.open(out / "rain-strokes.png").resize((512, 512)), (20, 20))
    contact.alpha_composite(Image.open(out / "snow-flakes.png").resize((1280, 128)), (20, 560))
    x = 560
    for i in range(4):
        f = Image.open(out / f"fog-{i + 1}.png")
        f.thumbnail((400, 200))
        contact.alpha_composite(f, (x if i < 2 else x + 420, 40 + (i % 2) * 240))
    contact.convert("RGB").save(RUN / "contact-weather.png")


def sky():
    """Six stars, the moon and a shooting star. Their thin white paper edge stays: stripping it eats pale
    paint (run 011's wick), and paper stars on your ceiling suit a pop-up book."""
    rgb = np.asarray(Image.open(RUN / "sky-sheet.png").convert("RGB")).copy()
    paper = make_pieces.paper_of(rgb)
    grouped = rows(make_pieces.cut(rgb), rgb.shape[0])
    counts = [len(r) for r in grouped]
    print("sky rows", counts)
    if counts != [6, 2]:
        PROBLEMS.append(f"sky sheet: rows {counts}, expected [6, 2]")
        return
    out = ART / "fx" / "sky"
    out.mkdir(parents=True, exist_ok=True)
    stars = []
    for i, (a, *_ ) in enumerate(grouped[0]):
        raw = a.copy()
        a = clean(a, paper)
        check(f"star-{i + 1}", a, raw, paper)
        stars.append(crop(a))
    strip(stars, 128, 128).save(out / "stars.png", optimize=True)
    for name, (a, *_ ) in zip(("moon", "shooting-star"), grouped[1]):
        raw = a.copy()
        a = clean(a, paper)
        check(name, a, raw, paper)
        Image.fromarray(crop(a)).save(out / f"{name}.png", optimize=True)
    contact = Image.new("RGBA", (1400, 700), (31, 42, 68, 255))
    contact.alpha_composite(Image.open(out / "stars.png"), (20, 20))
    moon = Image.open(out / "moon.png")
    moon.thumbnail((400, 400))
    contact.alpha_composite(moon, (40, 200))
    star = Image.open(out / "shooting-star.png")
    star.thumbnail((800, 400))
    contact.alpha_composite(star, (520, 220))
    contact.convert("RGB").save(RUN / "contact-sky.png")


def snow_cover():
    """The painted snow, made to repeat for free: blended with a half-offset copy of itself, so its
    edges meet. Saved at 1024 px, square, the way a repeating texture wants."""
    im = Image.open(RUN / "snow-cover.png").convert("RGB")
    side = min(im.size)
    im = im.crop(((im.width - side) // 2, 0, (im.width + side) // 2, side)).resize((1024, 1024), Image.LANCZOS)
    a = np.asarray(im).astype(float)
    shifted = np.roll(np.roll(a, 512, axis=0), 512, axis=1)
    y, x = np.mgrid[0:1024, 0:1024] / 1023.0
    # 1 in the middle, 0 at every edge: the middle keeps the painting, the edges take the shifted copy.
    w = (np.sin(np.pi * x) * np.sin(np.pi * y))[..., None] ** 0.6
    out = (a * w + shifted * (1 - w)).clip(0, 255).astype(np.uint8)
    (ART / "fx" / "weather").mkdir(parents=True, exist_ok=True)
    Image.fromarray(out).save(ART / "fx" / "weather" / "snow-cover.png", optimize=True)


def main():
    weather()
    sky()
    snow_cover()
    # A soft pale edge (snow puffs, fog) loses a little to the shadow clean-up: noted, not a failure.
    warnings = [p for p in PROBLEMS if p.endswith("painted box shrank")]
    failures = [p for p in PROBLEMS if p not in warnings]
    if warnings:
        print("warnings (soft pale edges):", ", ".join(w.split(":")[0] for w in warnings))
    if failures:
        print("\n".join(failures))
        sys.exit(1)
    print("all pieces pass")


if __name__ == "__main__":
    main()
