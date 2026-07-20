#!/usr/bin/env python3
"""Validate the published assessment dashboard against its source manifest."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DASHBOARD_PATH = ROOT / "data" / "synthetic" / "assessment-dashboard.json"
MANIFEST_PATH = ROOT / "data" / "synthetic" / "assessment-dashboard.manifest.json"
SHA256 = re.compile(r"^[0-9a-f]{64}$")
EXPECTED_EXTRACTS = {
    "assignment_growth_by_course.csv",
    "course_section_performance.csv",
    "lms_enrollment_reconciliation.csv",
    "nonparticipation_by_group.csv",
    "student_readiness_extract.csv",
}


def fail(message: str) -> None:
    raise SystemExit(f"assessment manifest check failed: {message}")


def main() -> None:
    if not DASHBOARD_PATH.exists() or not MANIFEST_PATH.exists():
        fail("dashboard JSON and publication manifest must both exist")

    dashboard_bytes = DASHBOARD_PATH.read_bytes()
    dashboard = json.loads(dashboard_bytes)
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    if manifest.get("schemaVersion") != "assessment-dashboard-manifest-v1":
        fail("unsupported manifest schema")
    if manifest.get("contract") != dashboard.get("source", {}).get("contract"):
        fail("dashboard and manifest contracts differ")

    dashboard_meta = manifest.get("dashboard", {})
    digest = hashlib.sha256(dashboard_bytes).hexdigest()
    if dashboard_meta.get("sha256") != digest:
        fail("dashboard SHA-256 does not match manifest")
    if dashboard_meta.get("bytes") != len(dashboard_bytes):
        fail("dashboard byte count does not match manifest")
    if dashboard_meta.get("recordCounts") != dashboard.get("source", {}).get("recordCounts"):
        fail("dashboard record counts do not match manifest")

    extracts = manifest.get("extracts", [])
    if {item.get("name") for item in extracts} != EXPECTED_EXTRACTS:
        fail("manifest does not declare the five required SQL extracts")
    for item in extracts:
        if not SHA256.fullmatch(str(item.get("sha256", ""))):
            fail(f"invalid extract digest for {item.get('name')}")
        if not isinstance(item.get("rows"), int) or item["rows"] <= 0:
            fail(f"invalid extract row count for {item.get('name')}")

    builder_digest = manifest.get("builder", {}).get("sha256", "")
    if not SHA256.fullmatch(str(builder_digest)):
        fail("builder digest is missing or invalid")

    periods = dashboard.get("periods", [])
    if len(periods) != 14:
        fail("dashboard must contain seven paired BOY/EOY academic years")
    for index, period in enumerate(periods):
        academic_start = 2019 + index // 2
        academic_year = f"{academic_start}-{str(academic_start + 1)[-2:]}"
        window_code = "BOY" if index % 2 == 0 else "EOY"
        expected_source = f"Assignment {index + 1:02d}"
        if period.get("academicYear") != academic_year or period.get("windowCode") != window_code:
            fail(f"period {index + 1} has invalid academic-year window metadata")
        if period.get("shortLabel") != f"{academic_year} {window_code}":
            fail(f"period {index + 1} has an invalid display label")
        if period.get("sourceLabel") != expected_source:
            fail(f"period {index + 1} does not preserve its raw source label")
        if re.search(r"\b(?:assignment|task)\b", str(period.get("label", "")), re.IGNORECASE):
            fail(f"period {index + 1} exposes a generic task label")

    course_names = {section.get("course") for section in dashboard.get("sections", [])}
    course_benchmarks = dashboard.get("bands", {}).get("mastery", {}).get("byCourse", {})
    if set(course_benchmarks) != course_names:
        fail("course benchmark coverage does not match dashboard courses")
    if not all(isinstance(value, (int, float)) and 0 < value <= 100 for value in course_benchmarks.values()):
        fail("course benchmarks must be numeric values on the 0-100 score scale")
    if len(set(course_benchmarks.values())) < 2:
        fail("course benchmarks must preserve course-level specificity")

    counts = dashboard_meta["recordCounts"]
    print(
        "Assessment manifest valid: "
        f"{counts['periods']} periods, {counts['sections']} sections, "
        f"{counts['aggregateRecords']} aggregate records, "
        f"{counts['syntheticStudentRecords']} synthetic student records."
    )


if __name__ == "__main__":
    main()
