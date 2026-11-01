"""Unit tests for the pure helpers of export_data.py.

They need neither openpyxl nor the workbook, so CI runs them:
    python3 -m unittest discover -s scripts
"""

import math
import unittest

import argparse

from export_data import (
    ExportError,
    as_of_date,
    blend_slope,
    check_not_up,
    clean_name,
    district_id,
    excel_flip,
    excel_rating,
    mt3_shares,
    open_seat_labels,
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


class OpenSeatLabelsTest(unittest.TestCase):
    def test_open_seat_makes_both_open(self):
        self.assertEqual(open_seat_labels("nonIncumbent", "lostIncumbent"), ("lostIncumbent", "lostIncumbent"))
        self.assertEqual(open_seat_labels("lostIncumbent", "nonIncumbent"), ("lostIncumbent", "lostIncumbent"))

    def test_an_incumbent_running_keeps_the_labels(self):
        self.assertEqual(open_seat_labels("nonIncumbent", "incumbent"), ("nonIncumbent", "incumbent"))
        self.assertEqual(open_seat_labels("lostIncumbent", "gainedIncumbency"), ("lostIncumbent", "gainedIncumbency"))

    def test_no_open_seat_label_keeps_the_labels(self):
        self.assertEqual(open_seat_labels("nonIncumbent", "nonIncumbent"), ("nonIncumbent", "nonIncumbent"))


class NotUpTest(unittest.TestCase):
    # Two states only would fail the per-state check, so build all fifty:
    # every state but VT has its two senators not up.
    def senators(self, vt_parties):
        from export_data import STATES

        rows = [
            {"state": state, "name": f"{state} {k}", "party": "R"}
            for state in sorted(set(STATES.values()))
            if state != "VT"
            for k in (1, 2)
        ]
        return rows + [{"state": "VT", "name": f"VT {k}", "party": party} for k, party in enumerate(vt_parties)]

    def test_counts_independents_with_d(self):
        self.assertEqual(check_not_up(self.senators(["D", "I"]), [], 2, 98), [])

    def test_counts_must_match_the_workbook(self):
        errors = check_not_up(self.senators(["D", "I"]), [], 1, 98)
        self.assertEqual(len(errors), 1)
        self.assertIn("N3 / P3", errors[0])

    def test_every_state_has_two_senators(self):
        errors = check_not_up(self.senators(["D"]), [], 1, 98)
        self.assertEqual(errors, ["VT: 1 senators between the races and the senators not up"])
        self.assertEqual(check_not_up(self.senators(["D"]), ["VT"], 1, 98), [])

    def test_unknown_party(self):
        self.assertIn("unknown parties ['G']", check_not_up(self.senators(["D", "G"]), [], 1, 98)[0])


class AsOfTest(unittest.TestCase):
    def test_iso_date(self):
        self.assertEqual(as_of_date("2026-10-31"), "2026-10-31")

    def test_rejects_other_dates(self):
        for text in ("31/10/2026", "2026-02-30", "20261031", "2026-10-31T00:00"):
            with self.assertRaises(argparse.ArgumentTypeError):
                as_of_date(text)


if __name__ == "__main__":
    unittest.main()
