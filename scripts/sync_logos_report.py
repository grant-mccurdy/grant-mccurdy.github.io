#!/usr/bin/env python3
"""Import the reviewed synthetic Logos report; verify it without private sources."""

import argparse
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data/logos"
FIGURES = ("course-distributions", "section-periods", "pairwise-audit",
           "domain-course-track", "item-priorities", "item-course")
FORM = "af91b62f5581bef95f13432f739052d1ac3fe845bbdd8c4817e7fc86b780dabf"
TOP_KEYS = set("administration_id classes clustered comparisons course course_order course_pooled domain domain_pooled form invalid item_course items not_reached overall pairwise questions questions_attempted reliability response_count scenario schema_version section selected_positions skipped students synthetic".split())
ROW_KEYS = set("a b clusters difference high low p status course mean median n sd track domain correct_rate correct item_id position skill corrected_item_rest facility not_reached_rate students equivalent family g high90 low90 n_a n_b p_holm interpretation group course_a course_b flag main_progression track_a track_b format item_revision item_sha256 period section_id".split())


def digest(data):
    return hashlib.sha256(data).hexdigest()


def validate_data(data):
    if set(data) != TOP_KEYS or data["synthetic"] is not True:
        raise ValueError("Only the reviewed synthetic aggregate schema is accepted")
    if data["schema_version"] != "logos-department-report-v2" or data["form"]["sha256"] != FORM:
        raise ValueError("Assessment revision changed; review the interpretation before importing")
    for key, allowed in {
        "form": "id item_count revision scoring_version sha256 working_seconds",
        "scenario": "id kind version", "reliability": "alpha",
    }.items():
        if set(data[key]) != set(allowed.split()):
            raise ValueError(f"Unexpected {key} fields")
    for rows in data.values():
        if isinstance(rows, list):
            for row in rows:
                if isinstance(row, dict) and not set(row) <= ROW_KEYS:
                    raise ValueError("Unexpected aggregate fields")
    if (data["students"], data["classes"], data["form"]["item_count"], data["response_count"]) != (500, 21, 30, 15000):
        raise ValueError("Scenario counts changed; review before importing")
    if sum(r["n"] for r in data["course"]) != 500 or sum(r["n"] for r in data["section"]) != 500:
        raise ValueError("Course and class populations do not reconcile")
    if len(data["item_course"]) != 300 or sum(r["n"] for r in data["item_course"]) != 15000:
        raise ValueError("Question populations do not reconcile")
    if sorted(q["position"] for q in data["questions"]) != list(range(1, 31)):
        raise ValueError("Question positions do not match the assessment")
    for row in data["item_course"]:
        if not 0 <= row["correct"] <= row["n"] or abs(row["correct_rate"] - 100 * row["correct"] / row["n"]) > 1e-8:
            raise ValueError("Invalid question percentage")


def validate_svg(content):
    for node in ET.fromstring(content).iter():
        if node.tag.split("}")[-1] in {"script", "foreignObject"}:
            raise ValueError("Active SVG content is not allowed")
        for key, value in node.attrib.items():
            name = key.split("}")[-1].lower()
            embedded_png = name == "href" and node.tag.split("}")[-1] == "image" and value.startswith("data:image/png;base64,")
            if embedded_png and not base64.b64decode(value.split(",", 1)[1], validate=True).startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("Invalid embedded PNG")
            if name.startswith("on") or (name == "href" and not value.startswith("#") and not embedded_png):
                raise ValueError("External or active SVG attributes are not allowed")


def encode(value):
    return (json.dumps(value, indent=2, ensure_ascii=True) + "\n").encode()


def import_report(source):
    manifest = json.loads((source / "docs/web-report.v2.json").read_text())
    raw = (source / "docs/report-data.v2.json").read_bytes()
    if manifest["classification"] != "synthetic-aggregate-only" or digest(raw) != manifest["source_data_sha256"]:
        raise ValueError("Source data does not match the reviewed report")
    data = json.loads(raw)
    validate_data(data)
    editorial_path = source / "scripts/report_editorial.py"
    if digest(editorial_path.read_bytes()) != manifest["editorial_source_sha256"]:
        raise ValueError("Editorial source does not match the reviewed report")
    spec = importlib.util.spec_from_file_location("logos_editorial", editorial_path)
    editorial = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(editorial)
    findings, analysis, actions = editorial.editorial(data)
    narrative = {"revision": editorial.REVISION, "date": editorial.DATE,
                 "introduction": editorial.INTRODUCTION, "findings": findings,
                 "analysis": analysis, "actions": actions, "teaching_checks": editorial.TEACHING_CHECKS}
    files = {"data/logos/report-data.json": raw, "data/logos/report-narrative.json": encode(narrative)}
    for figure in FIGURES:
        name = f"assets/report/{figure}.svg"
        content = (source / "dist" / name).read_bytes()
        if digest(content) != manifest["files"][name]:
            raise ValueError(f"Figure differs from the report: {figure}")
        validate_svg(content)
        files[f"assets/images/logos/{figure}.svg"] = content
    publication = {"schema_version": "portfolio-logos-report-v1",
                   "classification": "synthetic-aggregate-only",
                   "report_url": "https://logoseducation.group/sample-report/",
                   "assessment_url": "https://logoseducation.group/assessment-preview/",
                   "form": data["form"], "scenario": data["scenario"],
                   "editorial_revision": editorial.REVISION,
                   "source_data_sha256": manifest["source_data_sha256"],
                   "editorial_source_sha256": manifest["editorial_source_sha256"],
                   "files": {name: digest(content) for name, content in files.items()}}
    # Validate the entire bundle before changing any publication file.
    for name, content in files.items():
        target = ROOT / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    (DEST / "manifest.json").write_bytes(encode(publication))


def check():
    manifest = json.loads((DEST / "manifest.json").read_text())
    expected = {"data/logos/report-data.json", "data/logos/report-narrative.json"} | {
        f"assets/images/logos/{figure}.svg" for figure in FIGURES}
    if set(manifest["files"]) != expected:
        raise ValueError("Publication must contain exactly the two data files and six report figures")
    for name, expected_hash in manifest["files"].items():
        raw = (ROOT / name).read_bytes()
        if digest(raw) != expected_hash:
            raise ValueError(f"Publication changed: {name}; reimport the reviewed bundle")
        if name.endswith(".svg"):
            validate_svg(raw)
    data = json.loads((DEST / "report-data.json").read_text())
    validate_data(data)
    if manifest["form"] != data["form"] or manifest["source_data_sha256"] != digest((DEST / "report-data.json").read_bytes()):
        raise ValueError("Form or source identity differs from the publication")
    print("Logos alignment verified: 500 students, 21 classes, 30 questions, six identical report figures.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, help="Reviewed Logos website checkout; needed only to refresh")
    parser.add_argument("--check", action="store_true", help="Verify the committed bundle without private sources")
    args = parser.parse_args()
    if args.source:
        import_report(args.source.resolve())
    check()
