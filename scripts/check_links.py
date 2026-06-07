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


def is_external(link: str) -> bool:
    parsed = urlparse(link)
    return bool(parsed.scheme) or link.startswith("mailto:")


def main() -> int:
    missing: list[tuple[Path, str]] = []

    for html_path in sorted(ROOT.rglob("*.html")):
        parser = LinkParser()
        parser.feed(html_path.read_text(encoding="utf-8"))
        for link in parser.links:
            link_without_fragment, _ = urldefrag(link)
            parsed = urlparse(link_without_fragment)
            if not parsed.path or is_external(link_without_fragment):
                continue

            target = (html_path.parent / parsed.path).resolve()
            try:
                target.relative_to(ROOT)
            except ValueError:
                continue

            if not target.exists():
                missing.append((html_path.relative_to(ROOT), link))

    if missing:
        for source, link in missing:
            print(f"MISSING {source}: {link}")
        return 1

    print("All internal HTML links resolve.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
