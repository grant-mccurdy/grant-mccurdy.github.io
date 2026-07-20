#!/usr/bin/env python3
"""Check curated portfolio copy for time-relative filler."""

from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPORAL_FILLER = re.compile(r"\b(now|currently|recently|newly)\b", re.IGNORECASE)
CURATED_PATTERNS = (
    "index.html",
    "data-lab.html",
    "README.md",
    "data/portfolio-projects.json",
    "demos/*.html",
    "projects/*.html",
    "projects/hotel-comp-policy-model/engineering-evidence.html",
    "case-studies/*.html",
    "dashboard/*.html",
    "content/rag/*.md",
    "docs/github-profile/*.md",
)
EXCLUDED_FILES = {
    ROOT / "projects" / "hotel-comp-policy-model" / "technical-appendix.html",
}
SKIPPED_HTML_TAGS = {"code", "pre", "script", "style"}
VISIBLE_ATTRIBUTES = {"alt", "aria-label", "placeholder", "title"}
META_PROSE_KEYS = {"description", "og:description", "twitter:description"}


class ProseParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.fragments: list[tuple[int, str]] = []
        self.skipped_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in SKIPPED_HTML_TAGS:
            self.skipped_depth += 1
            return
        if self.skipped_depth:
            return

        line_number = self.getpos()[0]
        attr_map = dict(attrs)
        for name in VISIBLE_ATTRIBUTES:
            if attr_map.get(name):
                self.fragments.append((line_number, attr_map[name] or ""))
        if tag == "meta":
            prose_key = attr_map.get("name") or attr_map.get("property")
            if prose_key in META_PROSE_KEYS and attr_map.get("content"):
                self.fragments.append((line_number, attr_map["content"] or ""))

    def handle_endtag(self, tag: str) -> None:
        if tag in SKIPPED_HTML_TAGS and self.skipped_depth:
            self.skipped_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.skipped_depth and data.strip():
            self.fragments.append((self.getpos()[0], data.strip()))


def curated_files() -> list[Path]:
    paths = {
        path
        for pattern in CURATED_PATTERNS
        for path in ROOT.glob(pattern)
        if path.is_file() and path not in EXCLUDED_FILES
    }
    return sorted(paths)


def prose_fragments(path: Path) -> list[tuple[int, str]]:
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".html":
        parser = ProseParser()
        parser.feed(text)
        return parser.fragments

    fragments: list[tuple[int, str]] = []
    in_fence = False
    for line_number, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if path.suffix == ".md" and (stripped.startswith("```") or stripped.startswith("~~~")):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        fragments.append((line_number, re.sub(r"`[^`]*`", "", line)))
    return fragments


def main() -> int:
    findings: list[tuple[Path, int, str]] = []
    for path in curated_files():
        for line_number, fragment in prose_fragments(path):
            if TEMPORAL_FILLER.search(fragment):
                findings.append((path.relative_to(ROOT), line_number, fragment.strip()))

    if findings:
        print("Temporal prose convention violations:")
        for path, line_number, line in findings:
            print(f"- {path}:{line_number}: {line}")
        print("Use durable present tense or identify a specific date, release, or version.")
        return 1

    print(f"Prose conventions valid across {len(curated_files())} curated files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
