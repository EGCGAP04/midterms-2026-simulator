"""Unit tests for the pure helpers of export_data.py.

They need neither openpyxl nor the workbook, so CI runs them:
    python3 -m unittest discover -s scripts
"""

import math
import unittest

from export_data import (
    ExportError,
    blend_slope,
    clean_name,
    district_id,
    excel_flip,
    excel_rating,
    mt3_shares,
    parse_label,
    senate_state,
    two_party_margin,
)


class CleanNameTest(unittest.TestCase):
    def test_plain_name(self):
        self.assertEqual(clean_name("Barry Moore"), ("Barry Moore", False))

    def test_drops_footnote_asterisks(self):
        self.assertEqual(clean_name("Ken Calvert* **"), ("Ken Calvert", False))
        self.assertEqual(clean_name("Jim McGovern**"), ("Jim McGovern", False))

    def test_independent_marker(self):
        self.assertEqual(clean_name("Bill Hill (I)"), ("Bill Hill", True))
        self.assertEqual(clean_name("Kevin Kiley* (I)**"), ("Kevin Kiley", True))

    def test_no_candidate(self):
        self.assertIsNone(clean_name(None))
        self.assertIsNone(clean_name("None"))
        self.assertIsNone(clean_name("None**"))

    def test_keeps_accents_and_apostrophes(self):
        self.assertEqual(clean_name("Angélica María Dueñas*"), ("Angélica María Dueñas", False))
        self.assertEqual(clean_name("N'Kiyla Jasmine Thomas"), ("N'Kiyla Jasmine Thomas", False))


class ParseLabelTest(unittest.TestCase):
    def test_the_four_statuses(self):
        self.assertEqual(parse_label("Incumbent."), "incumbent")
        self.assertEqual(parse_label("Gained Incumbency"), "gainedIncumbency")
        self.assertEqual(parse_label("Lost Incumbent"), "lostIncumbent")
        self.assertEqual(parse_label("Non-Incumbent"), "nonIncumbent")

    def test_drops_quality_codes_and_asterisks(self):
        self.assertEqual(parse_label("Incumbent. - SC."), "incumbent")
        self.assertEqual(parse_label("Incumbent.* - WC."), "incumbent")
        self.assertEqual(parse_label("Lost Incumbent - NSC, LSC"), "lostIncumbent")
        self.assertEqual(parse_label("Gained Incumbency*"), "gainedIncumbency")

    def test_unknown_status_fails(self):
        with self.assertRaises(ExportError):
            parse_label("Retired")
        with self.assertRaises(ExportError):
            parse_label(None)


class DistrictIdTest(unittest.TestCase):
    def test_numbered(self):
        self.assertEqual(district_id("California 22"), ("CA", "CA-22"))
        self.assertEqual(district_id("Alabama 01"), ("AL", "AL-01"))
        self.assertEqual(district_id("New York 19"), ("NY", "NY-19"))

    def test_at_large(self):
        self.assertEqual(district_id("Alaska at-large"), ("AK", "AK-AL"))
        self.assertEqual(district_id("North Dakota at-large"), ("ND", "ND-AL"))
        self.assertEqual(district_id("Wyoming"), ("WY", "WY-AL"))

    def test_unknown_state_fails(self):
        with self.assertRaises(ExportError):
            district_id("Puerto Rico at-large")
        with self.assertRaises(ExportError):
            district_id("Atlantis 01")

    def test_senate_state(self):
        self.assertEqual(senate_state("Florida (special)"), "FL")
        self.assertEqual(senate_state("New Hampshire"), "NH")


class RatingTest(unittest.TestCase):
    def test_thresholds(self):
        self.assertEqual(excel_rating(0.12), "Safe R")
        self.assertEqual(excel_rating(0.1199), "Likely R")
        self.assertEqual(excel_rating(0.06), "Likely R")
        self.assertEqual(excel_rating(0.02), "Lean R")
        self.assertEqual(excel_rating(0.0199), "Tossup (Tilt R)")
        self.assertEqual(excel_rating(-0.0199), "Tossup (Tilt D)")
        self.assertEqual(excel_rating(-0.02), "Lean D")
        self.assertEqual(excel_rating(-0.06), "Likely D")
        self.assertEqual(excel_rating(-0.12), "Safe D")

    def test_exactly_zero_is_tilt_r(self):
        self.assertEqual(excel_rating(0.0), "Tossup (Tilt R)")

    def test_flip(self):
        self.assertEqual(excel_flip("R", 0.05), "NO")
        self.assertEqual(excel_flip("R", -0.05), "Yes, DEM")
        self.assertEqual(excel_flip("D", 0.0), "Yes, REP")
        self.assertEqual(excel_flip("D", -0.05), "NO")


class MathTest(unittest.TestCase):
    def test_blend_slope(self):
        self.assertAlmostEqual(blend_slope(1, 1), 0.5)
        self.assertAlmostEqual(blend_slope(1, 3), 0.75)

    def test_mt3_shares_add_up_and_match_the_margin(self):
        ac, ad, ae = -0.032161467375141, -0.0321143727417183, 0.135436219360385
        a, b, c = mt3_shares(ac, ad, ae)
        self.assertTrue(math.isclose(a + b + c, 1))
        self.assertTrue(math.isclose(a - b, ae, abs_tol=1e-12))
        self.assertTrue(math.isclose(a, (1 + (ac + ad) / 2) / 2))

    def test_two_party_margin(self):
        self.assertAlmostEqual(two_party_margin(60, 40), 0.2)
        self.assertAlmostEqual(two_party_margin(40, 60), -0.2)


if __name__ == "__main__":
    unittest.main()
