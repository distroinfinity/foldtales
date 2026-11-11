"""Tests for run 007's checks. Run: python3 art/runs/007-art-m2/test_tools.py"""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(1, str(Path(__file__).resolve().parents[1] / "006-drawer-objects"))
import m2_check as mc  # noqa: E402

W, H = 2720, 800
PX = mc.SET_PX_PER_MM


def bluffs(gap_mm=120, height_mm=80, left_edge=200, shift=0):
    """Two flat-based bluffs on a full canvas, the gap centered on the spine unless shifted."""
    img = np.zeros((H, W, 4), "uint8")
    half = int(gap_mm * PX / 2)
    top = H - int(height_mm * PX)
    img[top:, left_edge + shift : W // 2 - half + shift] = (150, 140, 110, 255)
    img[top:, W // 2 + half + shift : W - left_edge + shift] = (150, 140, 110, 255)
    return img


def ground(left, right, w=2304, h=1728):
    rgb = np.full((h, w, 3), 225, "uint8")
    rgb[:, left : right + 1] = (40, 70, 75)
    return rgb


class Gap(unittest.TestCase):
    def test_measures_the_dark_band_on_the_center(self):
        self.assertEqual(mc.measure_gap(ground(1000, 1300), 700, 900), (1000, 1300))

    def test_ignores_a_dark_patch_away_from_the_center(self):
        rgb = ground(1000, 1300)
        rgb[:, 100:160] = (40, 70, 75)
        self.assertEqual(mc.measure_gap(rgb, 700, 900), (1000, 1300))

    def test_no_chasm_is_none(self):
        self.assertIsNone(mc.measure_gap(np.full((400, 800, 3), 225, "uint8"), 100, 200))

    def test_window(self):
        per_mm = 2304 / 420
        centered = lambda mm: (int(1152 - mm * per_mm / 2), int(1152 + mm * per_mm / 2))
        self.assertEqual(mc.gap_problems(*centered(105), 2304, 148.3), [])
        self.assertTrue(mc.gap_problems(*centered(85), 2304, 148.3))  # the sock would reach
        self.assertTrue(mc.gap_problems(*centered(130), 2304, 148.3))  # the ladder wouldn't rest 10 mm on both rims

    def test_off_the_spine_fails(self):
        per_mm = 2304 / 420
        self.assertTrue(any("off the spine" in p for p in mc.gap_problems(int(1152 - 52 * per_mm + 100), int(1152 + 52 * per_mm + 100), 2304, 148.3)))

    def test_caption_band(self):
        rgb = np.full((700, 700, 3), 240, "uint8")
        self.assertEqual(mc.caption_band_problems(rgb), [])
        rgb[-60:, 100:400] = 60
        self.assertTrue(mc.caption_band_problems(rgb))

    def test_caption_band_rejects_a_uniform_dark_band(self):
        rgb = np.full((700, 700, 3), 240, "uint8")
        rgb[-100:] = (40, 70, 75)
        self.assertTrue(mc.caption_band_problems(rgb))


class Ladder(unittest.TestCase):
    def test_painted_length_excludes_padding(self):
        img = np.zeros((100, 20, 4), "uint8")
        img[5:95, 5:15] = (150, 120, 80, 255)
        self.assertAlmostEqual(mc.painted_length_mm(img, 150), 135)


class Ledger(unittest.TestCase):
    def test_counts_the_larger(self):
        self.assertEqual(mc.spent_for_cap(9, 18), 18)  # an interrupted job charged with no log line
        self.assertEqual(mc.spent_for_cap(9, 9), 9)
        self.assertEqual(mc.spent_for_cap(9, 0), 9)  # a failure at list price


class Adapter(unittest.TestCase):
    def test_load_sheet_reads_another_run_through_a_relative_name(self):
        import make_objects
        rgb = make_objects.load_sheet("../004-book-and-first-set/trims-sheet")
        self.assertEqual(rgb.shape[2], 3)


class Agreement(unittest.TestCase):
    def test_inner_edges(self):
        left, right = mc.inner_edges_mm(bluffs(gap_mm=120))
        self.assertAlmostEqual(left, 60, delta=1)
        self.assertAlmostEqual(right, 60, delta=1)

    def test_matches_the_chasm(self):
        self.assertEqual(mc.rim_agreement_problems((60, 62), 55, 52), [])

    def test_overhang_fails(self):
        self.assertTrue(any("left rim" in p for p in mc.rim_agreement_problems((40, 60), 52, 52)))

    def test_set_too_far_back_fails(self):
        self.assertTrue(any("right rim" in p for p in mc.rim_agreement_problems((60, 66), 52, 52)))

    def test_shift_registers_a_bluff_to_the_chasm(self):
        # Its inner edge is 70 mm out, and the printed chasm's edge is 52 mm, so it moves in by 14 mm, setting back 4.
        self.assertEqual(mc.bluff_shift_px(70, 52), round(-14 * PX))


class Rims(unittest.TestCase):
    def test_good_pair_passes(self):
        self.assertEqual(mc.rim_problems(bluffs(), 100), [])

    def test_one_piece_fails(self):
        img = bluffs()
        img[-40:, 200 : W - 200] = (150, 140, 110, 255)
        self.assertIn("pieces:1", mc.rim_problems(img, 100))

    def test_paint_at_the_spine_fails(self):
        self.assertIn("paint at the spine", mc.rim_problems(bluffs(gap_mm=60), 100))

    def test_too_tall_fails(self):
        self.assertTrue(any(p.startswith("too tall") for p in mc.rim_problems(bluffs(height_mm=110), 100)))

    def test_touching_the_side_fails(self):
        self.assertIn("touches the canvas side", mc.rim_problems(bluffs(left_edge=0), 100))

    def test_ragged_base_fails(self):
        img = bluffs()
        img[-1:, 200:900, 3] = 0
        self.assertIn("base", mc.rim_problems(img, 100))

    def test_big_shift_fails(self):
        self.assertTrue(mc.shift_problems(200, W))
        self.assertEqual(mc.shift_problems(100, W), [])


class Pieces(unittest.TestCase):
    def test_aspect(self):
        self.assertEqual(mc.aspect_problems(1729, 1000, 190, 110, mc.TRAY_ASPECT_LIMIT), [])
        self.assertTrue(mc.aspect_problems(1400, 1000, 190, 110, mc.TRAY_ASPECT_LIMIT))

    def test_never_upscale(self):
        self.assertTrue(mc.upscale_problems(900, 600, 1011, 585))
        self.assertEqual(mc.upscale_problems(1100, 640, 1011, 585), [])



class Drawer(unittest.TestCase):
    SLOTS = [
        {"id": "ladder", "length": 148, "width": 41, "flat_x": 0, "stand_x": -66, "plane_z": 16, "turn": -1},
        {"id": "kite", "length": 118, "width": 64, "flat_x": 0, "stand_x": 45, "plane_z": 28, "turn": 1},
        {"id": "sock", "length": 88, "width": 57, "flat_x": -30, "stand_x": -56, "plane_z": 52, "turn": -1},
        {"id": "spool", "length": 70, "width": 62, "flat_x": 30, "stand_x": 7, "plane_z": 45, "turn": 1},
        {"id": "key", "length": 73, "width": 29, "flat_x": 40, "stand_x": 60, "plane_z": 65, "turn": 1},
    ]

    def test_the_planned_slots_pass(self):
        self.assertEqual(mc.drawer_problems(self.SLOTS, 176, 111, 2), [])

    def test_too_long_flat_fails(self):
        slots = [dict(self.SLOTS[0], flat_x=30)]
        self.assertTrue(any("flat past the tray's sides" in p for p in mc.drawer_problems(slots, 176, 111, 2)))

    def test_upright_past_the_side_fails(self):
        slots = [dict(self.SLOTS[1], stand_x=70)]
        self.assertTrue(any("upright past" in p for p in mc.drawer_problems(slots, 176, 111, 2)))

    def test_swinging_outward_hits_the_wall(self):
        slots = [dict(self.SLOTS[0], turn=1)]
        self.assertTrue(any("through a wall" in p for p in mc.drawer_problems(slots, 176, 111, 2)))

    def test_flat_footprint_past_the_depth_fails(self):
        slots = [dict(self.SLOTS[1], plane_z=55)]  # a 64 mm kite covers 55 to 119 in a 111 mm tray
        self.assertTrue(any("past the tray's depth" in p for p in mc.drawer_problems(slots, 176, 111, 2)))

    def test_edge_through_a_wall_is_caught_when_the_corner_is_above_it(self):
        slots = [{"id": "edge", "length": 148.3, "width": 40.8, "flat_x": -13.27, "stand_x": -25.61, "plane_z": 20, "turn": 1}]
        self.assertTrue(any("through a wall" in p for p in mc.drawer_problems(slots, 176, 111, 2)))

    def test_shared_plane_fails(self):
        slots = [self.SLOTS[0], dict(self.SLOTS[1], plane_z=16)]
        self.assertIn("two objects share a plane", mc.drawer_problems(slots, 176, 111, 2))

    def test_interior_inside_the_book_fails(self):
        self.assertTrue(any("clear the book" in p for p in mc.drawer_problems(self.SLOTS, 176, 111, -3)))


class Lamp(unittest.TestCase):
    def setUp(self):
        self.original = np.zeros((60, 60, 4), "uint8")
        self.original[10:50, 10:50] = (120, 130, 140, 255)
        self.box = (20, 40, 20, 40)

    def test_lit_glass_passes(self):
        lit = self.original.copy()
        lit[20:40, 20:40, :3] = (230, 180, 80)
        self.assertEqual(mc.lamp_problems(self.original, lit, self.box), [])

    def test_changed_outline_fails(self):
        lit = self.original.copy()
        lit[20:40, 20:40, :3] = (230, 180, 80)
        lit[10:12, 10:50, 3] = 0
        self.assertIn("alpha changed", mc.lamp_problems(self.original, lit, self.box))

    def test_unchanged_glass_fails(self):
        self.assertTrue(mc.lamp_problems(self.original, self.original.copy(), self.box))


if __name__ == "__main__":
    unittest.main()
