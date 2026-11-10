"""Projects the reference eye through Pip onto the finished layers and checks he stays legible in every mood."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RUN = Path(__file__).resolve().parent
sys.path.insert(0, str(RUN))
import checks  # noqa: E402
import make_pieces as m  # noqa: E402

EYE = (-500.0, 420.0)  # depth from the near edge, height, in mm


def backdrop(x_mm, height_mm):
    """The first painted layer pixel behind a point on Pip, as seen from the reference eye."""
    depth = m.PIP_MARK_MM[1]
    for name, _, hinge, _ in sorted(m.LAYERS, key=lambda layer: layer[2]):
        if hinge <= depth:
            continue
        z = height_mm - (hinge - depth) * (EYE[1] - height_mm) / (depth - EYE[0])
        img = m.load_rgba(m.ART / "sets/shore-path" / f"{name}.png")
        col, row = int(1360 + x_mm * m.PX_PER_MM), int(img.shape[0] - z * m.PX_PER_MM)
        if 0 <= row < img.shape[0] and img[row, col, 3] > 200:
            patch = img[max(row - 8, 0) : row + 8, col - 8 : col + 8]
            return name, patch[patch[..., 3] > 200][:, :3]
    return "room", None


def painted(path):
    a = m.load_rgba(path)
    return a[a[..., 3] > 200][:, :3]


def glass(path):
    """Only the lantern's glass, since that's what has to read as gone dark."""
    a = m.load_rgba(path)
    return a[m.glass_mask(m.load_rgba(m.ART / "cast/pip/parts/lantern.png"))][:, :3]


def main():
    pip = m.ART / "cast/pip"
    probes = {"coat vs what's behind his body": (painted(pip / "parts/coat.png"), 70),
              "fur vs what's behind his head": (painted(pip / "heads/up.png"), 150),
              "unlit glass vs what's behind it": (glass(pip / "parts/lantern-out.png"), 60)}
    floors = {"dusk": 25, "gold": 25, "night": 12}
    ok = True
    for label, (piece, height) in probes.items():
        layer, behind = backdrop(m.PIP_MARK_MM[0], height)
        # A head is light fur by design, so it reads by hue against the sky, not by being darker.
        measure = checks.color_difference if "head" in label else checks.value_margin
        for mood, tint in checks.MOODS.items():
            margin = measure(behind * tint, piece * tint) if behind is not None else float("nan")
            passed = margin >= floors[mood]
            ok &= passed
            print(f"{label:36} {layer:20} {mood:6} {margin:6.1f} {'ok' if passed else 'LOW'}")
    return ok


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
