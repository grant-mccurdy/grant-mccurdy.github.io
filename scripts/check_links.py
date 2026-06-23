#!/usr/bin/env python3
"""Check that local HTML href/src references resolve inside the static site."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urldefrag, urlparse


ROOT = Path(__file__).resolve().parents[1]


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)
        for key in ("href", "src"):
            value = attr_map.get(key)
            if value:
                self.links.append(value)


class TargetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.targets: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)
        for key in ("id", "name"):
            value = attr_map.get(key)
            if value:
                self.targets.add(value)


def is_external(link: str) -> bool:
    parsed = urlparse(link)
    return bool(parsed.scheme) or link.startswith("mailto:")


def main() -> int:
    missing: list[tuple[Path, str]] = []
    missing_fragments: list[tuple[Path, str]] = []
    target_cache: dict[Path, set[str]] = {}

    def targets_for(path: Path) -> set[str]:
        if path not in target_cache:
            parser = TargetParser()
            parser.feed(path.read_text(encoding="utf-8"))
            target_cache[path] = parser.targets
        return target_cache[path]

    for html_path in sorted(ROOT.rglob("*.html")):
        parser = LinkParser()
        parser.feed(html_path.read_text(encoding="utf-8"))
        for link in parser.links:
            link_without_fragment, fragment = urldefrag(link)
            parsed = urlparse(link_without_fragment)
            if is_external(link_without_fragment):
                continue

            target = html_path.resolve() if not parsed.path else (html_path.parent / parsed.path).resolve()
            try:
                target.relative_to(ROOT)
            except ValueError:
                continue

            if not target.exists():
                missing.append((html_path.relative_to(ROOT), link))
                continue

            if fragment and target.suffix == ".html" and fragment not in targets_for(target):
                missing_fragments.append((html_path.relative_to(ROOT), link))

    if missing or missing_fragments:
        for source, link in missing:
            print(f"MISSING {source}: {link}")
        for source, link in missing_fragments:
            print(f"MISSING_FRAGMENT {source}: {link}")
        return 1

    print("All internal HTML links resolve.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
