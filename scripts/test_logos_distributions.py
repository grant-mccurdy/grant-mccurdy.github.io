#!/usr/bin/env python3
"""Guard the public, report-matched distribution export without private inputs."""
import copy
import json
import unittest

from sync_logos_distributions import TARGET, validate


class DistributionTests(unittest.TestCase):
    def setUp(self):
        self.bundle = json.loads(TARGET.read_text())

    def test_published_bundle(self):
        report = validate(self.bundle)
        self.assertEqual(sum(row["n"] for row in self.bundle["groups"]), report["students"])

    def test_wrong_identity_or_private_fields_rejected(self):
        for field, value in (("synthetic", False), ("form_sha256", "other"),
                             ("source_data_sha256", "other"), ("student_ids", ["ST-01"])):
            with self.subTest(field=field):
                bundle = copy.deepcopy(self.bundle)
                bundle[field] = value
                with self.assertRaises(ValueError):
                    validate(bundle)

    def test_changed_distribution_rejected(self):
        changes = [
            ("student_id", "ST-01"), ("n", 1), ("mean", 0), ("median", 0),
            ("q1", 0), ("q3", 100), ("whisker_low", 100),
            ("outliers", [-1]), ("counts", [500] + [0] * 30),
            ("density", [[0, 0]] * 512),
            ("density", [[i / 511 * 100, 2] for i in range(512)]),
        ]
        for field, value in changes:
            with self.subTest(field=field):
                bundle = copy.deepcopy(self.bundle)
                bundle["groups"][0][field] = value
                with self.assertRaises(ValueError):
                    validate(bundle)

    def test_missing_or_duplicate_groups_rejected(self):
        for rows in (self.bundle["groups"][:-1], [self.bundle["groups"][0]] * 10):
            bundle = copy.deepcopy(self.bundle)
            bundle["groups"] = rows
            with self.assertRaises(ValueError):
                validate(bundle)


if __name__ == "__main__":
    unittest.main()
