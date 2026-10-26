"""Stage the assessment-only candidate over HEAD without changing Git state."""
import hashlib
import difflib
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    "dashboard/assessment.html", "projects/assessment-intelligence.html",
    "assets/css/department-dashboard.css", "assets/css/portfolio.css",
    "assets/js/department-dashboard.js", "assets/js/department-model.js",
    "assets/js/department-charts.js", "data/logos/manifest.json",
    "data/logos/score-distributions.json",
    "assets/images/logos/pairwise-audit.svg", "assets/images/logos/section-periods.svg",
    "scripts/sync_logos_report.py", "scripts/test_logos_import.py",
    "scripts/sync_logos_distributions.py", "scripts/test_logos_distributions.py",
    "scripts/export_logos_distributions.R", "scripts/department_dashboard_smoke.mjs",
    "scripts/visual_smoke.mjs",
    "docs/assessment-alignment-2026-10-26.md",
    "scripts/package_assessment_alignment.py",
)

def main():
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    target = ROOT / "tmp" / ("assessment-release-" + stamp)
    target.mkdir(parents=True, exist_ok=False)
    ref = sys.argv[1] if len(sys.argv) > 1 else "HEAD"
    head = subprocess.check_output(["git", "rev-parse", ref], cwd=ROOT, text=True).strip()
    archive = subprocess.check_output(["git", "archive", head], cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(archive)) as baseline:
        baseline.extractall(target, filter="data")
    files = {}
    patches = []
    for name in FILES:
        destination = target / name
        before = destination.read_text() if destination.exists() else ""
        existed = destination.exists()
        destination.parent.mkdir(parents=True, exist_ok=True)
        if name == "scripts/visual_smoke.mjs":
            anchor = '        if (el.closest(".chart-frame, .table-wrap, .report-table-wrap, .table-scroll, .cell-output-display")) return false;'
            addition = '\n        const chartViewport = el.closest(".chart-viewport");\n        if (chartViewport && chartViewport !== el && ["auto", "scroll"].includes(getComputedStyle(chartViewport).overflowX)) return false;'
            if anchor not in before:
                raise ValueError("Visual-test baseline changed; review the scoped patch")
            destination.write_text(before if "const chartViewport" in before else before.replace(anchor, anchor + addition))
        else:
            shutil.copyfile(ROOT / name, destination)
        files[name] = hashlib.sha256(destination.read_bytes()).hexdigest()
        patches.extend(difflib.unified_diff(before.splitlines(keepends=True),
                       destination.read_text().splitlines(keepends=True),
                       fromfile="a/" + name if existed else "/dev/null", tofile="b/" + name))
    receipt = {"base_commit": head, "candidate": str(target), "status": "unpublished-candidate",
               "scope": "Assessment dashboard and case study only; homepage and instructional course excluded",
               "files": files}
    patch_path = target.with_suffix(".patch")
    patch_path.write_text("".join(patches))
    receipt["patch"] = str(patch_path)
    receipt["patch_sha256"] = hashlib.sha256(patch_path.read_bytes()).hexdigest()
    target.with_suffix(".receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt))

if __name__ == "__main__":
    main()
