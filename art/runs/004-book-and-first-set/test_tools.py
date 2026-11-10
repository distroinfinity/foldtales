"""Tests for run 004's finishing, checking and budget tools. Run: python3 art/runs/004-book-and-first-set/test_tools.py"""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import budget  # noqa: E402
import checks  # noqa: E402
import finish  # noqa: E402

CUTOUT = HERE.parents[1] / "tools" / "cutout.py"
MAGENTA = (190, 40, 120)


def canvas(h, w):
    return np.zeros((h, w, 4), "uint8")


def paint(img, top, bottom, left, right, rgb=(60, 90, 160)):
    img[top:bottom, left:right] = (*rgb, 255)
    return img


def two_blocks():
    return paint(paint(canvas(120, 240), 20, 100, 20, 100), 20, 100, 140, 220)


def block_with_specks():
    img = paint(canvas(120, 240), 20, 100, 20, 200)
    for x in (210, 220, 230):
        paint(img, 10, 13, x, x + 3)
    return img


def ragged_bottom_block():
    img = paint(canvas(120, 240), 20, 90, 20, 220)
    for i, x in enumerate(range(20, 220, 10)):
        paint(img, 90, 90 + (i * 7) % 28, x, x + 10)
    return img


def painted_box(img):
    ys, xs = np.nonzero(img[..., 3] > 127)
    return ys.min(), ys.max(), xs.min(), xs.max()


def painted_width(img):
    _, _, left, right = painted_box(img)
    return right - left + 1


def bbox_center_x(img):
    _, _, left, right = painted_box(img)
    return (left + right + 1) / 2


def off_center_block():
    return paint(canvas(100, 300), 20, 100, 10, 110)


def tall_block(height):
    return paint(canvas(height, 400), 0, height, 40, 360)


def head_shape(dx, dy):
    """A head with a narrower chin ruff at its base, moved by dx, dy."""
    img = canvas(240, 240)
    yy, xx = np.mgrid[:240, :240]
    head = ((xx - 120 - dx) / 80) ** 2 + ((yy - 100 - dy) / 70) ** 2 <= 1
    ruff = (np.abs(xx - 120 - dx) <= 30) & (yy >= 160 + dy) & (yy <= 200 + dy)
    img[head | ruff] = (190, 110, 60, 255)
    return img


def lantern_shape():
    return paint(paint(canvas(300, 200), 20, 60, 70, 130), 60, 280, 40, 160, (170, 130, 60))


def wider_lantern_shape(extra):
    return paint(paint(canvas(300, 200), 20, 60, 70, 130), 60, 280, 40 - extra, 160 + extra, (170, 130, 60))


def block_on_paper(paper):
    img = np.full((100, 200, 3), paper, "uint8")
    img[20:80, 20:180] = (70, 90, 120)
    return img


class Cuts(unittest.TestCase):
    def test_two_pieces_are_reported(self):
        self.assertIn("pieces:2", checks.check_cut(two_blocks(), 10, 10))

    def test_specks_are_removed_and_reported(self):
        self.assertTrue(any(p.startswith("specks") for p in checks.check_cut(block_with_specks(), 10, 10)))
        self.assertEqual(checks.check_cut(finish.remove_specks(block_with_specks()), 10, 10), [])

    def test_a_rim_of_paper_is_a_halo(self):
        img = paint(paint(canvas(120, 240), 20, 100, 20, 220, MAGENTA), 24, 96, 24, 216)
        self.assertTrue(any(p.startswith("halo") for p in checks.check_cut(img, 10, 10, paper_rgb=MAGENTA)))

    def test_small_cut_is_reported(self):
        self.assertIn("small", checks.check_cut(paint(canvas(120, 240), 20, 100, 20, 200), 500, 10))

    def test_no_alpha_is_reported(self):
        self.assertEqual(checks.check_cut(np.zeros((10, 10, 3), "uint8"), 1, 1), ["no alpha"])

    def test_enclosed_paper_is_cleared_and_enclosed_paint_kept(self):
        img = paint(canvas(120, 240), 10, 110, 10, 230)
        paint(img, 30, 50, 30, 60, MAGENTA)
        paint(img, 30, 50, 100, 130, (200, 200, 180))
        out = finish.clear_enclosed(img, MAGENTA)
        self.assertEqual(out[40, 45, 3], 0)
        self.assertEqual(out[40, 115, 3], 255)

    def test_despill_pulls_edge_color_away_from_paper(self):
        img = paint(paint(canvas(100, 200), 20, 80, 20, 180, (170, 70, 130)), 26, 74, 26, 174, (120, 120, 120))
        out = finish.despill(img, MAGENTA)
        self.assertLess(int(out[21, 100, 0]) - int(out[21, 100, 1]), 170 - 70)
        self.assertEqual(tuple(out[50, 100, :3]), (120, 120, 120))


class Layers(unittest.TestCase):
    def test_trim_base_makes_a_solid_bottom_row(self):
        out = finish.trim_base(ragged_bottom_block())
        self.assertGreaterEqual((out[-1, :, 3] > 200).sum(), 0.9 * painted_width(out))

    def test_center_on_canvas(self):
        out = finish.center_on_canvas(off_center_block(), 400)
        self.assertEqual(out.shape[1], 400)
        self.assertLessEqual(abs(bbox_center_x(out) - 200), 1)

    def test_layer_too_tall(self):
        self.assertIn("too tall", checks.check_layer(tall_block(600), 100, 100, 2.0))

    def test_layer_taller_than_its_hinge_does_not_fold(self):
        self.assertIn("too tall", checks.check_layer(tall_block(300), 100, 200, 2.0))

    def test_ragged_base_is_reported(self):
        self.assertIn("base", checks.check_layer(ragged_bottom_block(), 300, 300, 1.0))

    def test_off_center_layer_is_reported(self):
        self.assertIn("off center", checks.check_layer(off_center_block(), 300, 300, 1.0))

    def test_good_layer_passes(self):
        self.assertEqual(checks.check_layer(tall_block(100), 100, 100, 2.0), [])

    def test_calibrate_paper_hits_target(self):
        out = finish.calibrate_paper(block_on_paper((250, 248, 244)))
        self.assertLessEqual(np.abs(np.median(out[:3].reshape(-1, 3), axis=0) - (246, 239, 226)).max(), 1)


class Paper(unittest.TestCase):
    def test_full_bleed_sheet_is_rejected(self):
        img = np.full((100, 200, 3), (60, 90, 160), "uint8")
        img[:20] = MAGENTA
        self.assertFalse(checks.border_is_paper(img))

    def test_margined_sheet_passes(self):
        img = np.full((100, 200, 3), MAGENTA, "uint8")
        img[20:80, 20:180] = (60, 90, 160)
        self.assertTrue(checks.border_is_paper(img))

    def test_blank_sheet_is_rejected(self):
        self.assertFalse(checks.border_is_paper(np.full((100, 200, 3), MAGENTA, "uint8")))

    def test_border_allows_an_empty_center(self):
        img = np.full((100, 200, 3), MAGENTA, "uint8")
        img[60:90, 15:60] = (60, 90, 160)
        img[60:90, 140:185] = (60, 90, 160)
        self.assertTrue(checks.border_is_paper(img))

    def test_cutout_reports_a_split_layer(self):
        with tempfile.TemporaryDirectory() as d:
            sheet = np.full((400, 700, 3), MAGENTA, "uint8")
            sheet[150:350, 60:300] = (60, 90, 160)
            sheet[150:350, 400:640] = (60, 90, 160)
            Image.fromarray(sheet).save(Path(d, "s.png"))
            subprocess.run([sys.executable, str(CUTOUT), "--seal=3", str(Path(d, "s.png")), str(Path(d, "o"))], check=True, capture_output=True)
            self.assertEqual(checks.cut_count(Path(d, "o")), 2)


class Registration(unittest.TestCase):
    def test_shifted_head_is_measured(self):
        s, dx, dy = finish.register_head(head_shape(7, -3), head_shape(0, 0))
        self.assertAlmostEqual(s, 1.0, places=2)
        self.assertEqual((dx, dy), (-7, 3))

    def test_lantern_outline(self):
        self.assertLessEqual(finish.outline_error(lantern_shape(), lantern_shape()), 0)
        self.assertGreaterEqual(finish.outline_error(lantern_shape(), wider_lantern_shape(8)), 8)

    def test_fit_lantern_lands_on_the_lit_lantern(self):
        smaller = np.asarray(Image.fromarray(lantern_shape()).resize((150, 225)))
        out = finish.fit_lantern(smaller, lantern_shape())
        self.assertEqual(out.shape, lantern_shape().shape)
        self.assertLessEqual(finish.outline_error(out, lantern_shape()), 3)


class Values(unittest.TestCase):
    def test_dark_backdrop_fails_margin(self):
        navy = (31, 42, 68)
        self.assertLess(checks.value_margin((40, 50, 75), navy), 25)
        self.assertGreater(checks.value_margin((200, 195, 175), navy), 25)

    def test_moods_are_the_agreed_three(self):
        self.assertEqual(set(checks.MOODS), {"dusk", "night", "gold"})


class Budget(unittest.TestCase):
    def test_prices(self):
        self.assertEqual(budget.price("1376:768"), 5)
        self.assertEqual(budget.price("2720:1530"), 9)

    def test_unknown_ratio_is_refused(self):
        with self.assertRaises(ValueError):
            budget.price("999:999")

    def test_queue_must_fit_remaining(self):
        with self.assertRaises(ValueError):
            budget.assert_queue_fits([{"ratio": "2720:1530"}] * 3, spent=95)

    def test_pending_counts_every_job_without_a_file(self):
        plan = {"jobs": [{"id": "a", "ratio": "1376:768"}, {"id": "b", "ratio": "1376:768"}]}
        with tempfile.TemporaryDirectory() as d:
            Path(d, "a.png").write_bytes(b"x")
            self.assertEqual([j["id"] for j in budget.pending_jobs(plan, d)], ["b"])

    def test_failed_attempts_are_debited(self):
        plan = {"jobs": [{"id": "a", "ratio": "2720:1530"}, {"id": "b", "ratio": "2720:1530"}]}
        self.assertEqual(budget.attempted_cost("done a: 100s, 9 credits\nFAILED b: rejected", plan), 18)

    def test_safe_cap(self):
        self.assertEqual(budget.safe_cap(spent=15), 96)

    def test_reconcile_shows_unexplained_spend(self):
        self.assertEqual(budget.reconcile(listed=14, observed_delta=23), {"listed": 14, "observed": 23, "unexplained": 9})


if __name__ == "__main__":
    unittest.main()
