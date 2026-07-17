#!/usr/bin/env python3
"""Check external HTTP(S) links referenced from local HTML files."""

from __future__ import annotations

import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen


ROOT = Path(__file__).resolve().parents[1]
TIMEOUT_SECONDS = 20
MAX_ATTEMPTS = 3
SKIP_DIRS = {".git", "node_modules"}
DOI_HOSTS = {"doi.org", "dx.doi.org"}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self.links.append(href)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


def is_http_url(link: str) -> bool:
    return urlparse(link).scheme in {"http", "https"}


def request_url(url: str, method: str, *, follow_redirects: bool = True) -> int:
    request = Request(
        url,
        method=method,
        headers={"User-Agent": "Mozilla/5.0 grant-mccurdy-portfolio-link-check/2.0"},
    )
    if follow_redirects:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return response.status
    with build_opener(NoRedirect).open(request, timeout=TIMEOUT_SECONDS) as response:
        return response.status


def check_url(url: str) -> tuple[bool, str]:
    parsed = urlparse(url)
    is_doi = parsed.hostname in DOI_HOSTS
    last_detail = "no successful response"

    for attempt in range(MAX_ATTEMPTS):
        for method in ("HEAD", "GET"):
            try:
                status = request_url(url, method, follow_redirects=not is_doi)
            except HTTPError as error:
                if is_doi and 300 <= error.code < 400:
                    return True, f"HTTP {error.code} DOI redirect"
                transient_worker_404 = error.code == 404 and parsed.hostname and parsed.hostname.endswith(".workers.dev")
                if method == "HEAD" and (error.code in {403, 405, 429} or transient_worker_404):
                    last_detail = f"HTTP {error.code}"
                    continue
                last_detail = f"HTTP {error.code}"
                if error.code not in {408, 425, 429, 500, 502, 503, 504} and not transient_worker_404:
                    return False, last_detail
                break
            except (URLError, TimeoutError) as error:
                last_detail = str(getattr(error, "reason", "timed out"))
                break

            if 200 <= status < 400:
                return True, f"HTTP {status}"

        if attempt < MAX_ATTEMPTS - 1:
            time.sleep(0.5 * (attempt + 1))

    return False, last_detail


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
