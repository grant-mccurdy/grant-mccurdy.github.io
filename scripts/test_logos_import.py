"""Reject changed identities, mismatched counts, and active SVG input."""
import copy
import json
import unittest
from sync_logos_report import DEST, validate_data, validate_svg


class ReportImportTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((DEST / "report-data.json").read_text())

    def test_reviewed_data(self):
        validate_data(self.data)

    def test_reject_non_synthetic_or_extra_fields(self):
        for mutation in ({"synthetic": False}, {"student_email": "fixture@example.invalid"}):
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate_data(self.data | mutation)

    def test_changed_form_and_counts(self):
        changed = copy.deepcopy(self.data)
        changed["form"]["sha256"] = "0" * 64
        with self.assertRaises(ValueError):
            validate_data(changed)
        self.data["course"][0]["n"] += 1
        with self.assertRaises(ValueError):
            validate_data(self.data)

    def test_changed_question_rate(self):
        self.data["item_course"][0]["correct_rate"] = 1
        with self.assertRaises(ValueError):
            validate_data(self.data)

    def test_active_svg_rejected(self):
        for content in ('<svg><script/></svg>', '<svg onload="run()"/>',
                        '<svg><image href="https://example.invalid/a.png"/></svg>'):
            with self.subTest(content=content), self.assertRaises(ValueError):
                validate_svg(content.encode())
        validate_svg(b'<svg><use href="#shape"/></svg>')


if __name__ == "__main__":
    unittest.main()
