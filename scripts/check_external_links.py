#!/usr/bin/env python3
"""Check external HTTP(S) links referenced from local HTML files."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
TIMEOUT_SECONDS = 20
SKIP_DIRS = {".git", "node_modules"}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        attr_map = dict(attrs)
        href = attr_map.get("href")
        if href:
            self.links.append(href)


def is_http_url(link: str) -> bool:
    return urlparse(link).scheme in {"http", "https"}


def request_url(url: str, method: str) -> int:
    request = Request(url, method=method, headers={"User-Agent": "grant-mccurdy-github-io-link-check"})
    with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return response.status


def check_url(url: str) -> tuple[bool, str]:
    for method in ("HEAD", "GET"):
        try:
            status = request_url(url, method)
        except HTTPError as error:
            if method == "HEAD" and error.code in {403, 405, 429}:
                continue
            return False, f"HTTP {error.code}"
        except URLError as error:
            return False, str(error.reason)
        except TimeoutError:
            return False, "timed out"

        if 200 <= status < 400:
            return True, f"HTTP {status}"

    return False, "no successful response"


def main() -> int:
    links_by_url: dict[str, set[Path]] = {}

    for html_path in sorted(ROOT.rglob("*.html")):
        if SKIP_DIRS.intersection(html_path.relative_to(ROOT).parts):
            continue
        parser = LinkParser()
        parser.feed(html_path.read_text(encoding="utf-8"))
        for link in parser.links:
            if is_http_url(link):
                links_by_url.setdefault(link, set()).add(html_path.relative_to(ROOT))

    failures: list[tuple[str, str, set[Path]]] = []
    for url, sources in sorted(links_by_url.items()):
        ok, detail = check_url(url)
        if not ok:
            failures.append((url, detail, sources))

    if failures:
        for url, detail, sources in failures:
            source_list = ", ".join(str(source) for source in sorted(sources))
            print(f"FAILED {url}: {detail} ({source_list})")
        return 1

    print(f"All {len(links_by_url)} external links resolve.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
