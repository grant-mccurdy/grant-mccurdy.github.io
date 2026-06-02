#!/usr/bin/env python3
"""Generate public synthetic assessment data from a private score distribution.

The bootstrap CSV is used only for distribution shape. The output contains
synthetic students, synthetic sections, and synthetic aggregate records.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
import re
import statistics
from pathlib import Path


ITEM_COUNT = 30
RNG_SEED = 20260602

PERIODS = [
    {"id": "2022-fall", "label": "Fall 2022", "year": 2022, "season": "Fall", "order": 1},
    {"id": "2023-spring", "label": "Spring 2023", "year": 2023, "season": "Spring", "order": 2},
    {"id": "2023-fall", "label": "Fall 2023", "year": 2023, "season": "Fall", "order": 3},
    {"id": "2024-spring", "label": "Spring 2024", "year": 2024, "season": "Spring", "order": 4},
    {"id": "2024-fall", "label": "Fall 2024", "year": 2024, "season": "Fall", "order": 5},
    {"id": "2025-spring", "label": "Spring 2025", "year": 2025, "season": "Spring", "order": 6},
    {"id": "2025-fall", "label": "Fall 2025", "year": 2025, "season": "Fall", "order": 7},
    {"id": "2026-spring", "label": "Spring 2026", "year": 2026, "season": "Spring", "order": 8},
]

SKILLS_BY_COURSE = {
    "Algebra 1": ["Functions", "Linear Models", "Equations", "Data"],
    "Geometry": ["Proof", "Similarity", "Circles", "Coordinate Geometry"],
    "Precalculus": ["Functions", "Trigonometry", "Modeling", "Rates"],
    "AP Statistics": ["Inference", "Probability", "Regression", "Experimental Design"],
}

SECTION_BLUEPRINTS = [
    ("alg1-9-a", "Algebra 1", "9", "Teacher A", "A", 27, -3.2, 1.4),
    ("alg1-9-b", "Algebra 1", "9", "Teacher B", "B", 24, -0.9, 1.0),
    ("alg1-9-c", "Algebra 1", "9", "Teacher C", "C", 29, -5.0, 1.8),
    ("geo-10-a", "Geometry", "10", "Teacher A", "A", 26, 1.4, 1.2),
    ("geo-10-b", "Geometry", "10", "Teacher D", "B", 30, 4.0, 1.1),
    ("geo-10-c", "Geometry", "10", "Teacher E", "C", 23, -1.9, 1.6),
    ("precalc-11-a", "Precalculus", "11", "Teacher B", "A", 22, 5.8, 1.0),
    ("precalc-11-b", "Precalculus", "11", "Teacher F", "B", 20, 2.0, 1.5),
    ("precalc-12-a", "Precalculus", "12", "Teacher F", "A", 18, 4.9, 1.3),
    ("stats-11-a", "AP Statistics", "11", "Teacher C", "A", 21, 7.2, 1.2),
    ("stats-12-a", "AP Statistics", "12", "Teacher E", "A", 19, 8.4, 1.0),
    ("stats-12-b", "AP Statistics", "12", "Teacher D", "B", 17, 4.5, 1.6),
]

COMPLETION_BY_PERIOD = [0.62, 0.76, 0.80, 0.87, 0.89, 0.94, 0.95, 0.97]
TRUE_ZERO_BY_PERIOD = [0.035, 0.025, 0.022, 0.018, 0.014, 0.012, 0.010, 0.008]
SCORE_LIFT_BY_PERIOD = [-4.0, 2.8, -0.8, 6.7, 1.5, 9.8, 4.2, 12.5]
MASTERY_BY_PERIOD = [58, 60, 62, 64, 66, 68, 70, 72]


def parse_number(value: str | None) -> float | None:
    text = str(value or "").strip().replace("%", "").replace(",", "")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    return float(match.group(0)) if match else None


def quantile(values: list[float], pct: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    index = (len(ordered) - 1) * pct
    low = math.floor(index)
    high = math.ceil(index)
    if low == high:
        return ordered[low]
    return ordered[low] * (high - index) + ordered[high] * (index - low)


def read_bootstrap_scores(path: Path, column_index: int) -> list[float]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.reader(handle))
    scores = []
    for row in rows[1:]:
        if len(row) > column_index:
            value = parse_number(row[column_index])
            if value is not None:
                scores.append(value)
    return scores


def weighted_average(rows: list[dict], key: str) -> float:
    total = sum(row["students"] for row in rows)
    if not total:
        return 0.0
    return sum(row[key] * row["students"] for row in rows) / total


def build_sections(rng: random.Random) -> list[dict]:
    sections = []
    for sid, course, grade, teacher, section, students, effect, _volatility in SECTION_BLUEPRINTS:
        skills = {
            skill: round(rng.uniform(-6.5, 6.5) + effect * 0.28, 1)
            for skill in SKILLS_BY_COURSE[course]
        }
        sections.append(
            {
                "id": sid,
                "course": course,
                "grade": grade,
                "teacher": teacher,
                "section": section,
                "students": students,
                "baseline": None,
                "growth": None,
                "springLift": None,
                "skills": skills,
            }
        )
    return sections


def generate(args: argparse.Namespace) -> dict:
    rng = random.Random(args.seed)
    private_scores = read_bootstrap_scores(args.bootstrap_csv, args.column - 1)
    nonzero_scores = [score for score in private_scores if score > 0]
    raw_pool = [max(1, min(ITEM_COUNT, round(score * ITEM_COUNT / 100))) for score in nonzero_scores]

    sections = build_sections(rng)
    section_lookup = {section["id"]: section for section in sections}
    student_records = []

    for section_index, blueprint in enumerate(SECTION_BLUEPRINTS):
        sid, course, grade, teacher, section_name, base_n, section_effect, volatility = blueprint
        student_ids = [f"{sid}-student-{number:02d}" for number in range(1, base_n + 7)]
        latent_ability = {student_id: rng.gauss(section_effect, 8.5) for student_id in student_ids}
        first_score = None
        latest_score = None
        spring_scores = []
        fall_scores = []

        for period_index, period in enumerate(PERIODS):
            enrollment = max(
                14,
                int(round(base_n + rng.choice([-3, -2, -1, 0, 1, 2]) + math.sin((section_index + 2) * (period_index + 1)) * 1.8)),
            )
            enrolled_ids = student_ids[:enrollment]
            completion_rate = COMPLETION_BY_PERIOD[period_index]
            completion_rate += section_effect * 0.0025 + rng.uniform(-0.085, 0.055)
            completion_rate += 0.025 if period["season"] == "Spring" else 0
            completion_rate = max(0.42, min(0.995, completion_rate))

            completed_ids = set(rng.sample(enrolled_ids, max(2, min(enrollment, round(enrollment * completion_rate)))))
            completed_scores = []
            raw_scores = []
            true_zero_count = 0

            for student_id in enrolled_ids:
                completed = student_id in completed_ids
                raw_score = 0
                score = 0.0
                if completed:
                    if rng.random() < TRUE_ZERO_BY_PERIOD[period_index]:
                        true_zero_count += 1
                    else:
                        base_raw = rng.choice(raw_pool)
                        ability_shift = latent_ability[student_id] * ITEM_COUNT / 100
                        period_shift = SCORE_LIFT_BY_PERIOD[period_index] * ITEM_COUNT / 100
                        section_shift = section_effect * ITEM_COUNT / 100
                        noise = rng.gauss(0, 2.6 + volatility)
                        seasonal = rng.choice([0, 0, 1, 1, 2]) if period["season"] == "Spring" else rng.choice([-1, 0, 0, 1])
                        raw_score = max(1, min(ITEM_COUNT, round(base_raw + ability_shift + period_shift + section_shift + noise + seasonal)))
                    score = raw_score * 100 / ITEM_COUNT
                    completed_scores.append(score)
                    raw_scores.append(raw_score)

                student_records.append(
                    {
                        "id": f"{student_id}-{period['id']}",
                        "studentId": student_id,
                        "sectionId": sid,
                        "course": course,
                        "grade": grade,
                        "teacher": teacher,
                        "section": section_name,
                        "periodId": period["id"],
                        "periodLabel": period["label"],
                        "year": period["year"],
                        "season": period["season"],
                        "order": period["order"],
                        "completed": completed,
                        "rawScore": raw_score,
                        "itemCount": ITEM_COUNT,
                        "score": round(score, 1),
                    }
                )

            mean_score = statistics.mean(completed_scores) if completed_scores else 0.0
            if first_score is None:
                first_score = mean_score
            latest_score = mean_score
            if period["season"] == "Spring":
                spring_scores.append(mean_score)
            else:
                fall_scores.append(mean_score)

        section = section_lookup[sid]
        section["baseline"] = round(first_score or 0, 1)
        section["growth"] = round(((latest_score or 0) - (first_score or 0)) / 3.5, 2)
        section["springLift"] = round(statistics.mean(spring_scores) - statistics.mean(fall_scores), 2)

    records = build_aggregate_records(student_records, sections)
    bands = build_bands(student_records)

    return {
        "generated": "2026-06-02",
        "description": "Synthetic multi-year 30-question assessment data calibrated from a private assessment score distribution. No real students, rosters, teachers, sections, IDs, emails, grades, submissions, or school records are included.",
        "bootstrap": {
            "privateBootstrapSource": "A private LMS export was used only to calibrate synthetic distribution shape; no private rows or identifiers are included.",
            "scoreColumnPublicName": "Assessment score",
            "syntheticItemCount": ITEM_COUNT,
            "zeroPolicy": "Most bootstrap zeros are modeled as early non-participation/non-administration; a small true-zero rate remains for realism.",
            "completionRatesByPeriod": [round(100 * value, 1) for value in COMPLETION_BY_PERIOD],
            "privateDistributionShape": {
                "nonZeroValuesUsedForCalibration": len(nonzero_scores),
                "zeroValuesUsedForCompletionModeling": sum(1 for score in private_scores if score == 0),
            },
        },
        "periods": PERIODS,
        "bands": bands,
        "sections": sections,
        "records": records,
        "studentRecords": student_records,
    }


def build_aggregate_records(student_records: list[dict], sections: list[dict]) -> list[dict]:
    skills_by_section = {section["id"]: section["skills"] for section in sections}
    records = []
    for section in sections:
        first_score = None
        for period in PERIODS:
            rows = [
                row for row in student_records
                if row["sectionId"] == section["id"] and row["periodId"] == period["id"]
            ]
            completed = [row for row in rows if row["completed"]]
            completed_scores = [row["score"] for row in completed]
            score = statistics.mean(completed_scores) if completed_scores else 0.0
            if first_score is None:
                first_score = score
            mastery = MASTERY_BY_PERIOD[period["order"] - 1]
            records.append(
                {
                    "id": f"{section['id']}-{period['id']}",
                    "sectionId": section["id"],
                    "course": section["course"],
                    "grade": section["grade"],
                    "teacher": section["teacher"],
                    "section": section["section"],
                    "periodId": period["id"],
                    "periodLabel": period["label"],
                    "year": period["year"],
                    "season": period["season"],
                    "order": period["order"],
                    "students": len(rows),
                    "completed": len(completed),
                    "notCompleted": len(rows) - len(completed),
                    "trueZeroScores": sum(1 for row in completed if row["rawScore"] == 0),
                    "score": round(score, 1),
                    "proficiency": round(100 * sum(row["score"] >= mastery for row in completed) / len(completed), 1) if completed else 0,
                    "completion": round(100 * len(completed) / len(rows), 1) if rows else 0,
                    "growth": round(score - first_score, 1),
                    "rawMean": round(statistics.mean([row["rawScore"] for row in completed]), 2) if completed else 0,
                    "itemCount": ITEM_COUNT,
                    "skills": skills_by_section[section["id"]],
                }
            )
    return records


def build_bands(student_records: list[dict]) -> dict:
    department_lower = []
    department_upper = []
    network_lower = []
    network_upper = []
    for period in PERIODS:
        rows = [row for row in student_records if row["periodId"] == period["id"]]
        completed_scores = [row["score"] for row in rows if row["completed"]]
        assigned_scores = [row["score"] for row in rows]
        department_lower.append(round(quantile(completed_scores, 0.20), 1))
        department_upper.append(round(quantile(completed_scores, 0.80), 1))
        network_lower.append(round(quantile(assigned_scores, 0.10), 1))
        network_upper.append(round(quantile(assigned_scores, 0.90), 1))

    return {
        "department": {
            "label": "Student-level p20-p80 completed-score band",
            "lower": department_lower,
            "upper": department_upper,
        },
        "network": {
            "label": "Student-level p10-p90 assigned-score band",
            "lower": network_lower,
            "upper": network_upper,
        },
        "mastery": {
            "label": "Mastery benchmark",
            "line": MASTERY_BY_PERIOD,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bootstrap-csv", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--column", type=int, default=9)
    parser.add_argument("--seed", type=int, default=RNG_SEED)
    args = parser.parse_args()
    data = generate(args)
    args.output.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {args.output}")
    print(f"synthetic student records: {len(data['studentRecords'])}")
    print(f"section-period records: {len(data['records'])}")


if __name__ == "__main__":
    main()
