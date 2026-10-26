#!/usr/bin/env python3
"""Export identifier-free distributions from the frozen fictional report scores."""
import argparse
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import statistics
import subprocess

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "data/logos/report-data.json"
TARGET = ROOT / "data/logos/score-distributions.json"
FIELDS = set("course track n mean sd min max q1 median q3 whisker_low whisker_high outliers counts density".split())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate(bundle):
    report = json.loads(REPORT.read_text())
    if set(bundle) != set("schema_version synthetic source_data_sha256 source_scores_sha256 form_sha256 method engine groups".split()):
        raise ValueError("Unexpected distribution fields")
    if bundle["synthetic"] is not True or bundle["schema_version"] != "logos-score-distributions-v1":
        raise ValueError("Only fictional score distributions are accepted")
    if bundle["source_data_sha256"] != sha(REPORT) or bundle["form_sha256"] != report["form"]["sha256"]:
        raise ValueError("Distribution identity differs from the reviewed report")
    expected = {(r["course"], r["track"]): r for r in report["course"]}
    rows = bundle["groups"]
    if len(rows) != len(expected) or {(r["course"], r["track"]) for r in rows} != set(expected):
        raise ValueError("Course-track groups differ from the report")
    for row in rows:
        if set(row) != FIELDS:
            raise ValueError("Unexpected group fields")
        counts = row["counts"]
        if len(counts) != 31 or any(type(n) is not int or n < 0 for n in counts):
            raise ValueError("Invalid score histogram")
        scores = [100 * point / 30 for point, count in enumerate(counts) for _ in range(count)]
        source = expected[row["course"], row["track"]]
        if len(scores) != row["n"] or row["n"] != source["n"]:
            raise ValueError("Student counts do not reconcile")
        for key, value in (("mean", statistics.mean(scores)), ("median", statistics.median(scores)), ("sd", statistics.stdev(scores))):
            if not math.isclose(value, row[key], abs_tol=1e-8) or not math.isclose(value, source[key], abs_tol=1e-8):
                raise ValueError("Distribution summary differs from the report")
        q1, _, q3 = statistics.quantiles(scores, n=4, method="inclusive")
        if not math.isclose(q1, row["q1"], abs_tol=1e-8) or not math.isclose(q3, row["q3"], abs_tol=1e-8):
            raise ValueError("Quartiles differ from the empirical distribution")
        if not (min(scores) == row["min"] and max(scores) == row["max"]):
            if not (math.isclose(min(scores), row["min"], abs_tol=1e-8) and math.isclose(max(scores), row["max"], abs_tol=1e-8)):
                raise ValueError("Invalid score range")
        low, high = q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)
        # Preserve R's boundary classification when decimal score rounding puts
        # an observed value exactly on a 1.5-IQR fence.
        strict = [score for score in scores if low + 1e-8 < score < high - 1e-8]
        inclusive = [score for score in scores if low - 1e-8 <= score <= high + 1e-8]
        if not any(math.isclose(value, row["whisker_low"], abs_tol=1e-8) for value in (min(strict), min(inclusive))) or not any(math.isclose(value, row["whisker_high"], abs_tol=1e-8) for value in (max(strict), max(inclusive))):
            raise ValueError("Boxplot whiskers do not match the scores")
        outside = [score for score in scores if score < row["whisker_low"] - 1e-8 or score > row["whisker_high"] + 1e-8]
        if len(outside) != len(row["outliers"]) or any(not math.isclose(a, b, abs_tol=1e-8) for a, b in zip(sorted(outside), sorted(row["outliers"]))):
            raise ValueError("Boxplot outliers do not match the scores")
        density = row["density"]
        if len(density) != 512 or any(len(p) != 2 or not all(math.isfinite(v) for v in p) or not 0 <= p[1] <= 1.000001 for p in density):
            raise ValueError("Invalid violin density")
        if any(a[0] >= b[0] for a, b in zip(density, density[1:])):
            raise ValueError("Density coordinates are not ordered")
        if not math.isclose(density[0][0], row["min"], abs_tol=1e-8) or not math.isclose(density[-1][0], row["max"], abs_tol=1e-8):
            raise ValueError("Density extends beyond observed scores")
    return report


def export(source):
    report = json.loads(REPORT.read_text())
    base = source / "artifacts/department-v2"
    public = base / "public/report-data.json"
    receipt = json.loads((base / "public/receipt.json").read_text())
    if receipt["classification"] != "synthetic-aggregate-only" or receipt["files"]["report-data.json"] != sha(REPORT) or sha(public) != sha(REPORT):
        raise ValueError("Producer does not match the reviewed fictional report")
    scores = base / "analysis/student.csv"
    with scores.open(newline="") as stream:
        rows = list(csv.DictReader(stream))
    if len(rows) != 500 or len({r["student_id"] for r in rows}) != 500 or any(r["administration_id"] != report["administration_id"] for r in rows):
        raise ValueError("Unexpected student score population")
    for group in report["section"]:
        sample = [float(r["score"]) for r in rows if r["section_id"] == group["section_id"] and r["course"] == group["course"] and r["track"] == group["track"] and int(r["period"]) == group["period"]]
        if len(sample) != group["n"] or not math.isclose(statistics.mean(sample), group["mean"], abs_tol=1e-8):
            raise ValueError("Class scores differ from the reviewed report")
    env = os.environ.copy()
    env.update(R_LIBS_USER=str(source / ".cache/R/library"), R_LIBS_SITE="", R_PROFILE_USER="/dev/null", R_ENVIRON_USER="/dev/null")
    result = subprocess.run(["Rscript", str(ROOT / "scripts/export_logos_distributions.R"), str(scores), str(REPORT)],
                            env=env, check=True, capture_output=True, text=True)
    derived = json.loads(result.stdout)
    bundle = dict(schema_version="logos-score-distributions-v1", synthetic=True,
                  source_data_sha256=sha(REPORT), source_scores_sha256=sha(scores),
                  form_sha256=report["form"]["sha256"],
                  method="Report-equivalent ggplot2 Gaussian KDE; bw=nrd0, adjust=1, 512 points, trim to observed range, width normalized within each group. Box: quartiles, median, 1.5-IQR whiskers, observed outliers.",
                  engine=derived["engine"], groups=derived["groups"])
    validate(bundle)
    TARGET.write_text(json.dumps(bundle, separators=(",", ":"), ensure_ascii=True) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, help="Frozen synthetic assessment producer; read-only")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.source:
        export(args.source.resolve())
    validate(json.loads(TARGET.read_text()))
    print("Score distributions verified: 10 groups, 500 fictional students, report-matched moments and empirical boxplots.")
