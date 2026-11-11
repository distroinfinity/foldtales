"""Tests for run 006's object checks. Run: python3 art/runs/006-drawer-objects/test_tools.py"""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import objects_check as oc  # noqa: E402


def block(h, w, rgb=(120, 90, 60)):
    img = np.zeros((h, w, 4), "uint8")
    img[10:-10, 10:-10] = (*rgb, 255)
    return img


class Size(unittest.TestCase):
    def test_small_object_fails_the_grab_floor(self):
        self.assertTrue(any(p.startswith("under 64") for p in oc.size_problems(100, 100, 0.05)))

    def test_wide_object_passes_on_its_width(self):
        self.assertEqual(oc.size_problems(300, 100, 0.03), [])

    def test_sliver_fails(self):
        self.assertTrue(any(p.startswith("sliver") for p in oc.size_problems(10, 100, 0.1)))

    def test_good_size_passes(self):
        self.assertEqual(oc.size_problems(60, 100, 0.07), [])


class Density(unittest.TestCase):
    def test_target_is_pips_density(self):
        self.assertEqual(oc.target_height_px(0.17), 905)

    def test_upscale_is_a_problem(self):
        self.assertTrue(oc.upscale_problems(300, 0.075))
        self.assertEqual(oc.upscale_problems(400, 0.075), [])

    def test_shared_scale_spread(self):
        self.assertEqual(oc.spread_problems({"a": 10, "b": 15}), [])
        self.assertTrue(oc.spread_problems({"a": 10, "b": 17}))


class Paint(unittest.TestCase):
    def test_magenta_left_inside_is_reported(self):
        img = block(100, 100)
        img[40:60, 40:60, :3] = (195, 45, 130)
        self.assertTrue(oc.magenta_residue(img))

    def test_rust_is_not_magenta(self):
        self.assertEqual(oc.magenta_residue(block(100, 100, (181, 80, 46))), [])

    def test_pivot_on_a_hole_fails(self):
        img = block(100, 100)
        img[40:60, 40:60, 3] = 0
        self.assertTrue(oc.pivot_problems(img, (50, 50)))
        self.assertEqual(oc.pivot_problems(img, (20, 20)), [])


class Data(unittest.TestCase):
    def test_unknown_tag_is_reported(self):
        self.assertEqual(oc.tag_problems(["flies", "light"], {"flies", "lightweight"}), ["unknown tag: light"])

    def test_real_vocabulary_has_the_gap_tags(self):
        self.assertTrue({"flies", "climbs", "spans", "rope", "lightweight"} <= oc.known_tags())
        self.assertNotIn("light", oc.known_tags())

    def test_piece_count(self):
        self.assertEqual(oc.piece_count_problems(5, 5), [])
        self.assertEqual(oc.piece_count_problems(6, 5), ["pieces: 6, expected 5"])


class Preservation(unittest.TestCase):
    MAGENTA = (195, 45, 130)

    def kite(self):
        img = np.zeros((240, 100, 4), "uint8")
        img[10:150, 10:90] = (120, 90, 60, 255)       # the kite
        img[150:230, 48:52] = (181, 80, 46, 255)      # a thin tail hanging below it
        img[60:80, 40:60, :3] = self.MAGENTA          # paper trapped inside
        return img

    def test_clearing_trapped_paper_is_fine(self):
        raw = self.kite()
        done = raw.copy()
        done[60:80, 40:60, 3] = 0
        self.assertEqual(oc.preservation_problems(raw, done, self.MAGENTA), [])

    def test_losing_the_tail_is_reported(self):
        raw = self.kite()
        done = raw.copy()
        done[150:230, 48:52, 3] = 0
        self.assertIn("painted box shrank", oc.preservation_problems(raw, done, self.MAGENTA))

    def test_losing_paint_inside_is_reported(self):
        raw = self.kite()
        done = raw.copy()
        done[20:60, 20:80, 3] = 0
        self.assertTrue(any(p.startswith("paint kept") for p in oc.preservation_problems(raw, done, self.MAGENTA)))


class Shadow(unittest.TestCase):
    MAGENTA = (192, 60, 127)

    def piece(self):
        img = np.zeros((120, 200, 4), "uint8")
        img[10:110, 10:190] = (98, 9, 36, 255)           # crimson shadow around the object
        img[20:100, 20:180] = (181, 80, 46, 255)         # rust paint
        img[40:60, 60:80] = (192, 60, 127, 255)          # a hole of paper
        img[38:62, 58:60] = (98, 9, 36, 255)             # its shadow rim
        return img

    def test_shadow_goes_and_rust_stays(self):
        import make_objects
        out = make_objects.clear_shadow(self.piece(), self.MAGENTA)
        self.assertEqual(out[15, 100, 3], 0)
        self.assertEqual(out[50, 70, 3], 0)
        self.assertEqual(out[50, 59, 3], 0)
        self.assertEqual(out[80, 100, 3], 255)
        self.assertEqual(oc.preservation_problems(self.piece(), out, self.MAGENTA), [])

    def test_grip_lands_where_it_was_painted(self):
        import make_objects
        piece = np.zeros((100, 60, 4), "uint8")
        piece[10:90, 10:50] = 255
        # piece centered at sheet (500, 300); the grip is the painted box's top-left corner
        pct = make_objects.grip_percent(piece, (500, 300), (480, 260), (10, 10), (80 + 2 * make_objects.PAD, 40 + 2 * make_objects.PAD))
        self.assertEqual(pct, [round(100 * make_objects.PAD / (40 + 2 * make_objects.PAD), 1), round(100 * make_objects.PAD / (80 + 2 * make_objects.PAD), 1)])


class Budget(unittest.TestCase):
    def test_last_repaint_can_start(self):
        self.assertEqual(oc.invocation_cap(spent=27, total=36, largest=9), 1)

    def test_first_invocation(self):
        self.assertEqual(oc.invocation_cap(spent=0, total=36, largest=9), 28)

    def test_no_room_is_refused(self):
        with self.assertRaises(ValueError):
            oc.invocation_cap(spent=30, total=36, largest=9)


if __name__ == "__main__":
    unittest.main()
