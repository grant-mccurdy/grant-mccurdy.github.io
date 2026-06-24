# Homepage Helper Source Audit

This audit documents the source boundary for the homepage helper knowledge
base. It is intentionally public-safe and excludes private source material.

## Directly Indexed Public Sources

- `content/rag/profile.md`: canonical public-safe profile and positioning.
- `content/rag/site-guide.md`: navigation, visitor routing, and Data Lab
  handoff guidance.
- `content/rag/project-map.json`: structured project-to-skill and
  project-to-demo map.
- `README.md`: public site role, testing, project areas, and safety rules.
- `index.html`: homepage positioning, capabilities, selected work, demos, case
  studies, and operating principles.
- `data-lab.html`: public Data Lab page framing.
- `dashboard/assessment.html`: public dashboard framing.
- selected `projects/*.html` and `case-studies/*.html`: public project briefs
  and evidence paths.
- `projects/statistical-risk-modeling-r.html`: public project brief for the R
  assessment-growth analytics repo.

## Summarize Or Use Only After Public Review

- Private resume drafts, career-positioning notes, job trackers, outreach
  records, and application materials may inform future public profile wording
  only after the user rewrites them into reviewed public-safe language.
- Private Canvas, assessment, and instructional repositories may inform future
  public project summaries only through sanitized public project pages or
  reviewed public-safe source documents.

## Excluded Sources

The helper knowledge base must not ingest `.env` files, API keys, Cloudflare
tokens, OpenAI keys, demo tokens, private Canvas exports, real rosters, student
records, emails, grades, LMS IDs, private school records, private transcripts,
job-search trackers, outreach drafts, or unpublished resume drafts.

## Hosting Decision

For v1, the reviewed public sources are generated into a Cloudflare Worker
module and bundled with the private backend. This keeps runtime simple, avoids
shipping secrets to GitHub Pages, and lets the homepage helper answer quickly
without a separate database. Database or vector hosting can be added later if
the helper corpus becomes too large or needs updates without Worker redeploys.
