#!/usr/bin/env python3
"""Publish approved hotel-comp artifacts as a static GitHub Pages bundle."""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT.parent / "hotel-comp-policy-model"
OUTPUT_DIR = ROOT / "projects" / "hotel-comp-policy-model"
PUBLIC_BASE = "https://grant-mccurdy.github.io/projects/hotel-comp-policy-model"
SOURCE_URL = "https://github.com/grant-mccurdy/hotel-comp-policy-model"

REPORTS = {
    "engineering-evidence.md": (
        "engineering-evidence.html",
        "Engineering evidence",
        "Verified S3-to-Snowflake decision lineage, data contracts, semantic quality gates, security controls, and report-source parity.",
    ),
    "methodology-and-assumptions.md": (
        "methodology.html",
        "Methodology and assumptions",
        "How the prototype turns guest, failure, operating, and cost signals into an explainable recovery recommendation.",
    ),
    "policy-sensitivity.md": (
        "policy-sensitivity.html",
        "Policy comparison uncertainty",
        "Paired case-bootstrap intervals, probabilistic guardrail checks, cost uncertainty, and policy-selection stability.",
    ),
    "policy-decision-analysis.md": (
        "policy-decision-analysis.html",
        "Comp policy decision analysis",
        "The five-policy comparison, declared selection rule, generated shadow-validation candidate, and controlled validation design.",
    ),
    "data-lineage.md": (
        "data-lineage.html",
        "Data lineage",
        "How synthetic operating sources are reconciled into decision-ready recovery cases and audit marts.",
    ),
    "snowflake-validation.md": (
        "warehouse-validation.html",
        "Warehouse validation",
        "Reconciliation checks between the local analytical build and its Snowflake implementation.",
    ),
    "proper-public-context.md": (
        "public-context.html",
        "Santa Monica Proper public context",
        "Public property facts used to make the prototype specific without claiming access to internal records or policy.",
    ),
}

LINK_REWRITES = {
    "reports/hotel-comp-decision-framework.pdf": "hotel-comp-decision-framework.pdf",
    "reports/policy-selection-technical-appendix.html": "technical-appendix.html",
    "reports/interactive-policy-prototype.html": "technical-prototype.html",
    "reports/engineering-evidence.md": "engineering-evidence.html",
    "reports/methodology-and-assumptions.md": "methodology.html",
    "reports/policy-sensitivity.md": "policy-sensitivity.html",
    "reports/policy-decision-analysis.md": "policy-decision-analysis.html",
    "reports/data-lineage.md": "data-lineage.html",
    "reports/snowflake-validation.md": "warehouse-validation.html",
    "reports/proper-public-context.md": "public-context.html",
    "reports/comp-optimization-dashboard.html": "simulation-audit.html",
}

FORBIDDEN_PATTERNS = {
    "local filesystem path": re.compile(r"/(?:home|Users)/[^\s<\"']+"),
    "GitHub token": re.compile(r"gh[opusr]_[A-Za-z0-9_]{20,}"),
    "OpenAI-style secret": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}"),
    "AWS access key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Path to the separately maintained hotel-comp-policy-model repository.",
    )
    return parser.parse_args()


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "section"


def safe_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme and parsed.scheme not in {"http", "https", "mailto"}:
        raise ValueError(f"Unsupported URL scheme in report link: {value}")
    return html.escape(value, quote=True)


def render_inline(value: str) -> str:
    tokens: list[str] = []

    def store(rendered: str) -> str:
        token = f"@@HTMLTOKEN{len(tokens)}@@"
        tokens.append(rendered)
        return token

    def code_replacement(match: re.Match[str]) -> str:
        return store(f"<code>{html.escape(match.group(1))}</code>")

    def link_replacement(match: re.Match[str]) -> str:
        label = html.escape(match.group(1))
        url = safe_url(match.group(2))
        return store(f'<a href="{url}">{label}</a>')

    value = re.sub(r"`([^`]+)`", code_replacement, value)
    value = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link_replacement, value)
    rendered = html.escape(value)
    rendered = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", rendered)
    rendered = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", rendered)
    for index, token in enumerate(tokens):
        rendered = rendered.replace(f"@@HTMLTOKEN{index}@@", token)
    return rendered


def is_table_separator(line: str) -> bool:
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def table_cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def starts_block(lines: list[str], index: int) -> bool:
    line = lines[index]
    if not line.strip():
        return True
    if re.match(r"^#{1,6}\s+", line) or line.startswith("```") or line.startswith("> "):
        return True
    if re.match(r"^(?:[-*]|\d+\.)\s+", line):
        return True
    return line.startswith("|") and index + 1 < len(lines) and is_table_separator(lines[index + 1])


def render_markdown(markdown: str) -> str:
    lines = markdown.splitlines()
    if lines and lines[0].startswith("# "):
        lines = lines[1:]

    output: list[str] = []
    index = 0
    used_ids: dict[str, int] = {}

    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue

        if line.startswith("```"):
            language = line[3:].strip()
            index += 1
            code_lines: list[str] = []
            while index < len(lines) and not lines[index].startswith("```"):
                code_lines.append(lines[index])
                index += 1
            index += 1 if index < len(lines) else 0
            language_attr = f' data-language="{html.escape(language, quote=True)}"' if language else ""
            output.append(f"<pre{language_attr}><code>{html.escape(chr(10).join(code_lines))}</code></pre>")
            continue

        heading_match = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading_match:
            level = min(len(heading_match.group(1)), 6)
            heading = heading_match.group(2).strip()
            base_id = slugify(re.sub(r"[`*_]", "", heading))
            occurrence = used_ids.get(base_id, 0)
            used_ids[base_id] = occurrence + 1
            heading_id = base_id if occurrence == 0 else f"{base_id}-{occurrence + 1}"
            output.append(f'<h{level} id="{heading_id}">{render_inline(heading)}</h{level}>')
            index += 1
            continue

        if line.startswith("|") and index + 1 < len(lines) and is_table_separator(lines[index + 1]):
            headers = table_cells(line)
            index += 2
            rows: list[list[str]] = []
            while index < len(lines) and lines[index].startswith("|"):
                rows.append(table_cells(lines[index]))
                index += 1
            header_html = "".join(f"<th scope=\"col\">{render_inline(cell)}</th>" for cell in headers)
            row_html = "".join(
                "<tr>" + "".join(f"<td>{render_inline(cell)}</td>" for cell in row) + "</tr>"
                for row in rows
            )
            output.append(
                '<div class="report-table-wrap"><table><thead><tr>'
                + header_html
                + "</tr></thead><tbody>"
                + row_html
                + "</tbody></table></div>"
            )
            continue

        list_match = re.match(r"^([-*]|\d+\.)\s+(.+)$", line)
        if list_match:
            ordered = list_match.group(1)[0].isdigit()
            tag = "ol" if ordered else "ul"
            items: list[str] = []
            pattern = r"^\d+\.\s+(.+)$" if ordered else r"^[-*]\s+(.+)$"
            while index < len(lines):
                item_match = re.match(pattern, lines[index])
                if not item_match:
                    break
                items.append(item_match.group(1))
                index += 1
            output.append(f"<{tag}>" + "".join(f"<li>{render_inline(item)}</li>" for item in items) + f"</{tag}>")
            continue

        if line.startswith("> "):
            quote_lines: list[str] = []
            while index < len(lines) and lines[index].startswith("> "):
                quote_lines.append(lines[index][2:].strip())
                index += 1
            output.append(f"<blockquote>{render_inline(' '.join(quote_lines))}</blockquote>")
            continue

        paragraph: list[str] = []
        while index < len(lines) and not starts_block(lines, index):
            paragraph.append(lines[index].strip())
            index += 1
        output.append(f"<p>{render_inline(' '.join(paragraph))}</p>")

    return "\n          ".join(output)


def report_page(output_name: str, title: str, description: str, content: str) -> str:
    canonical_url = f"{PUBLIC_BASE}/{output_name}"
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="{html.escape(description, quote=True)}">
    <title>{html.escape(title)} | Hotel Comp Policy Model</title>
    <meta property="og:title" content="{html.escape(title, quote=True)} | Hotel Comp Policy Model">
    <meta property="og:description" content="{html.escape(description, quote=True)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="{canonical_url}">
    <meta property="og:image" content="https://grant-mccurdy.github.io/assets/images/workflow-hero-poster.jpg">
    <link rel="canonical" href="{canonical_url}">
    <link rel="icon" href="../../assets/images/grant-mccurdy-profile.jpg" type="image/jpeg">
    <link rel="stylesheet" href="../../assets/css/styles.css?v=20260717a">
    <link rel="stylesheet" href="appendix.css?v=20260717a">
  </head>
  <body>
    <header class="site-header compact" data-header>
      <nav class="nav-shell" aria-label="Primary navigation">
        <a class="brand" href="../../index.html">
          <span class="brand-mark" aria-hidden="true"><img src="../../assets/images/grant-mccurdy-profile.jpg" alt=""></span>
          <span class="brand-text">Grant McCurdy</span>
        </a>
        <div class="nav-links static">
          <a href="index.html">Decision Brief</a>
          <a href="simulation-audit.html">Simulation Audit</a>
          <a href="../index.html">Projects</a>
          <a href="{SOURCE_URL}">Source</a>
        </div>
      </nav>
    </header>

    <main class="report-main">
      <section class="report-hero">
        <p class="section-kicker">Hotel Comp Policy Model | Technical Evidence</p>
        <h1>{html.escape(title)}</h1>
        <p>{html.escape(description)}</p>
        <div class="report-actions">
          <a class="button primary" href="index.html">Open decision brief</a>
          <a class="button outline" href="simulation-audit.html">Open simulation audit</a>
        </div>
      </section>
      <article class="report-body">
        <div class="evidence-boundary"><strong>Evidence boundary:</strong> Operational records and outcomes are synthetic. Public context establishes property fit and guest-facing value, not internal policy, costs, or performance.</div>
          {content}
      </article>
    </main>
    <script src="../../assets/js/site.js?v=20260717a"></script>
  </body>
</html>
"""


APPENDIX_CSS = """:root {
  --report-ink: #17201d;
  --report-muted: #5c6662;
  --report-line: #d7ddda;
  --report-paper: #f3f5f3;
  --report-teal: #12685b;
  --report-coral: #ad4f37;
}
.report-main { color: var(--report-ink); }
.report-hero, .report-body { width: min(980px, calc(100% - 40px)); margin: 0 auto; }
.report-hero { padding: 64px 0 42px; border-bottom: 1px solid var(--report-line); }
.report-hero h1 { max-width: 780px; margin: 0 0 14px; font-size: clamp(2.1rem, 6vw, 4.25rem); letter-spacing: 0; }
.report-hero > p:not(.section-kicker) { max-width: 780px; margin: 0; color: var(--report-muted); font-size: 1.08rem; }
.report-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
.report-body { padding: 38px 0 72px; }
.report-body h2 { margin: 46px 0 12px; font-size: 1.65rem; letter-spacing: 0; }
.report-body h3 { margin: 32px 0 10px; font-size: 1.2rem; letter-spacing: 0; }
.report-body p, .report-body li { max-width: 820px; color: var(--report-muted); }
.report-body li + li { margin-top: 7px; }
.report-body code { padding: 2px 5px; border-radius: 3px; background: #edf2ef; color: #0d4c43; font-size: .9em; }
.report-body pre { max-width: 100%; overflow-x: auto; padding: 18px; border: 1px solid var(--report-line); background: #202825; color: #e9efec; }
.report-body pre code { padding: 0; background: transparent; color: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
.report-body blockquote { max-width: 820px; margin: 24px 0; padding: 14px 20px; border-left: 4px solid var(--report-teal); background: #edf5f2; font-size: 1.05rem; }
.report-table-wrap { max-width: 100%; margin: 20px 0 28px; overflow-x: auto; border: 1px solid var(--report-line); }
.report-table-wrap table { width: 100%; border-collapse: collapse; background: #fff; }
.report-table-wrap th, .report-table-wrap td { min-width: 120px; padding: 11px 13px; border-bottom: 1px solid var(--report-line); text-align: left; vertical-align: top; font-size: .88rem; }
.report-table-wrap th { background: var(--report-paper); color: var(--report-ink); }
.report-table-wrap td { color: var(--report-muted); }
.evidence-boundary { padding: 15px 18px; border-left: 4px solid var(--report-coral); background: #fff5f0; color: #713521; }
@media (max-width: 620px) {
  .report-hero, .report-body { width: min(100% - 30px, 980px); }
  .report-hero { padding: 42px 0 30px; }
  .report-body { padding-top: 28px; }
  .report-actions .button { width: 100%; text-align: center; }
}
"""


def rewrite_report_links(source: str) -> str:
    for old, new in LINK_REWRITES.items():
        source = source.replace(old, new)
    return source


def add_standalone_wayfinding(
    source: str, output_name: str, title: str, description: str
) -> str:
    canonical_url = f"{PUBLIC_BASE}/" if output_name == "index.html" else f"{PUBLIC_BASE}/{output_name}"
    if '<meta name="description"' not in source:
        source = source.replace(
            '<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">',
            '<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">\n'
            f'<meta name="description" content="{html.escape(description, quote=True)}">',
            1,
        )
        source = source.replace(
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f'  <meta name="description" content="{html.escape(description, quote=True)}">',
            1,
        )

    metadata = f"""
<meta property="og:title" content="{html.escape(title, quote=True)} | Hotel Comp Policy Model">
<meta property="og:description" content="{html.escape(description, quote=True)}">
<meta property="og:type" content="article">
<meta property="og:url" content="{canonical_url}">
<meta property="og:image" content="https://grant-mccurdy.github.io/assets/images/workflow-hero-poster.jpg">
<link rel="canonical" href="{canonical_url}">
<link rel="icon" href="../../assets/images/grant-mccurdy-profile.jpg" type="image/jpeg">
<style id="portfolio-context-styles">
.portfolio-context {{ position:relative;z-index:20;display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;padding:10px max(20px,calc((100% - 1120px)/2));border-bottom:1px solid #d7ddda;background:#fff;color:#17201d;font:700 13px/1.4 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }}
.portfolio-context a {{ color:inherit;text-decoration:underline;text-underline-offset:3px; }}
.portfolio-context strong {{ margin-right:auto; }}
@media(max-width:620px) {{ .portfolio-context {{ padding:10px 15px; }} .portfolio-context strong {{ width:100%; }} }}
</style>"""
    source = source.replace("</head>", metadata + "\n</head>", 1)
    wayfinding = f"""<nav class="portfolio-context" aria-label="Hotel project navigation">
  <strong>Hotel Comp Policy Model</strong>
  <a href="index.html">Decision brief</a>
  <a href="https://hotel-comp-decision-desk.grant-mccurdy.workers.dev/">Live desk</a>
  <a href="../index.html">Project directory</a>
  <a href="../../index.html">Portfolio home</a>
  <a href="{SOURCE_URL}">Source</a>
</nav>"""
    return re.sub(r"(<body(?:\s[^>]*)?>)", r"\1\n" + wayfinding, source, count=1)


def transform_technical_prototype(source: str) -> str:
    source = rewrite_report_links(source)
    source = source.replace(
        "    footer { padding: 18px 0;",
        "    .portfolio-link { color: var(--teal-dark); font-weight: 800; text-decoration: none; }\n"
        "    .portfolio-link:hover { text-decoration: underline; }\n"
        "    footer { padding: 18px 0;",
        1,
    )
    source = source.replace(
        "      <strong>Executive discussion brief</strong>",
        '      <a class="portfolio-link" href="../../index.html">Grant McCurdy portfolio</a>',
        1,
    )
    return source


def transform_policy_appendix(source: str) -> str:
    source = rewrite_report_links(source)
    return source.replace('href="../index.html"', 'href="index.html"')


def transform_simulation_audit(source: str) -> str:
    source = source.replace(
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '  <meta name="description" content="Synthetic service-recovery policy audit for a luxury hotel comp decision prototype.">',
        1,
    )
    source = source.replace(
        "    @media(max-width:850px)",
        "    .audit-nav { display:flex;gap:18px;flex-wrap:wrap;margin-bottom:18px;font-size:.82rem;font-weight:700; } "
        ".audit-nav a { color:var(--accent);text-underline-offset:3px; } "
        ".table-scroll { width:100%;overflow-x:auto; }\n"
        "    @media(max-width:850px)",
        1,
    )
    source = source.replace(
        "  <header><h1>Comp Policy Simulation Audit</h1>",
        '  <header><nav class="audit-nav" aria-label="Artifact navigation"><a href="index.html">Decision brief</a><a href="policy-decision-analysis.html">Decision analysis</a><a href="methodology.html">Methodology</a><a href="../../index.html">Grant McCurdy portfolio</a></nav><h1>Comp Policy Simulation Audit</h1>',
        1,
    )
    return source


def validate_publication(files: dict[str, str]) -> None:
    failures: list[str] = []
    for name, content in files.items():
        for label, pattern in FORBIDDEN_PATTERNS.items():
            if pattern.search(content):
                failures.append(f"{name}: contains {label}")
        if name.endswith(".html") and "reports/" in content:
            failures.append(f"{name}: contains an unresolved source-report path")
    if failures:
        raise ValueError("Publication safety checks failed:\n" + "\n".join(failures))


def main() -> int:
    args = parse_args()
    source_dir = args.source.resolve()
    required = [
        source_dir / "index.html",
        source_dir / "reports" / "hotel-comp-decision-framework.pdf",
        source_dir / "reports" / "policy-selection-technical-appendix.html",
        source_dir / "reports" / "interactive-policy-prototype.html",
        source_dir / "reports" / "comp-optimization-dashboard.html",
    ]
    required.extend(source_dir / "reports" / name for name in REPORTS)
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing approved source artifacts:\n" + "\n".join(missing))

    files: dict[str, str] = {
        "index.html": add_standalone_wayfinding(
            rewrite_report_links((source_dir / "index.html").read_text(encoding="utf-8")),
            "index.html",
            "A Comp Decision Engine for Luxury Hotel Service Recovery",
            "Executive decision brief comparing five explainable hotel comp policies and a controlled shadow-validation recommendation.",
        ),
        "technical-appendix.html": add_standalone_wayfinding(
            transform_policy_appendix(
                (source_dir / "reports" / "policy-selection-technical-appendix.html").read_text(encoding="utf-8")
            ),
            "technical-appendix.html",
            "Policy Selection Methodology",
            "Technical appendix for the hotel comp policy comparison, selection logic, uncertainty, and validation design.",
        ),
        "technical-prototype.html": add_standalone_wayfinding(
            transform_technical_prototype(
                (source_dir / "reports" / "interactive-policy-prototype.html").read_text(encoding="utf-8")
            ),
            "technical-prototype.html",
            "Which Comp Policy Should Enter Shadow Validation?",
            "Interactive technical prototype for an explainable luxury-hospitality service recovery decision.",
        ),
        "simulation-audit.html": add_standalone_wayfinding(
            transform_simulation_audit(
                (source_dir / "reports" / "comp-optimization-dashboard.html").read_text(encoding="utf-8")
            ),
            "simulation-audit.html",
            "Comp Policy Simulation Audit",
            "Synthetic service-recovery policy audit supporting a controlled hotel comp shadow-validation decision.",
        ),
        "appendix.css": APPENDIX_CSS,
    }

    for source_name, (output_name, title, description) in REPORTS.items():
        markdown = (source_dir / "reports" / source_name).read_text(encoding="utf-8")
        files[output_name] = report_page(output_name, title, description, render_markdown(markdown))

    validate_publication(files)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        (OUTPUT_DIR / name).write_text(content.rstrip() + "\n", encoding="utf-8")

    pdf_source = source_dir / "reports" / "hotel-comp-decision-framework.pdf"
    (OUTPUT_DIR / "hotel-comp-decision-framework.pdf").write_bytes(pdf_source.read_bytes())

    print(f"Published {len(files) + 1} static files to {OUTPUT_DIR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
