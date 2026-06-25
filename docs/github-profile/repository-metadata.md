# GitHub Repository Metadata

Use these descriptions, homepage URLs, and topics to make the public GitHub profile readable from the repository list without requiring visitors to open every repo first.

## Profile

Suggested public bio:

> Mathematics/statistics professional building synthetic-data systems, assessment analytics, and AI-assisted reporting workflows.

Suggested website:

```text
https://grant-mccurdy.github.io/
```

The GitHub profile bio and website can be changed from the GitHub profile UI. From `gh`, they require the `user` OAuth scope:

```bash
gh auth refresh -h github.com -s user

gh api --method PATCH /user \
  -f bio="Mathematics/statistics professional building synthetic-data systems, assessment analytics, and AI-assisted reporting workflows." \
  -f blog="https://grant-mccurdy.github.io/"
```

Review the company/employer field manually before changing it; leaving it visible is a personal profile decision.

Suggested pinned repository order:

1. `education-data-simulation-engine`
2. `assessment-intelligence`
3. `graduate-statistics-portfolio`
4. `statistical-risk-modeling-r`
5. `grant-mccurdy.github.io`
6. `content-intelligence-reporting`

Keep `public-workspace` unpinned unless it is intentionally presented as a staging workspace.

## Repository Settings

```bash
gh repo edit grant-mccurdy/grant-mccurdy.github.io \
  --description "Public portfolio for analytics systems, synthetic education data, dashboards, and AI-assisted reporting." \
  --homepage "https://grant-mccurdy.github.io/"

gh repo edit grant-mccurdy/assessment-intelligence \
  --description "Assessment analytics project using synthetic gradebook data, R reporting, SQL extracts, and static dashboards." \
  --homepage "https://grant-mccurdy.github.io/projects/assessment-intelligence.html"

gh repo edit grant-mccurdy/education-data-simulation-engine \
  --description "Synthetic education data generator for public-safe Canvas-style analytics, validation, and warehouse demos." \
  --homepage "https://grant-mccurdy.github.io/projects/education-data-simulation-engine.html"

gh repo edit grant-mccurdy/statistical-risk-modeling-r \
  --description "Public-safe R assessment growth analytics with expected-growth validation and adjusted section signals." \
  --homepage "https://grant-mccurdy.github.io/projects/statistical-risk-modeling-r.html"

gh repo edit grant-mccurdy/graduate-statistics-portfolio \
  --description "Curated graduate statistics portfolio in R featuring nonlinear model search, GLMs, cross-validation, calibration, and threshold analysis." \
  --homepage "https://grant-mccurdy.github.io/projects/graduate-statistics-portfolio.html"

gh repo edit grant-mccurdy/content-intelligence-reporting \
  --description "Source-grounded content intelligence workflow for evidence-labeled reporting and searchable document analysis." \
  --homepage "https://grant-mccurdy.github.io/projects/content-intelligence.html"

gh repo edit grant-mccurdy/instructional-ai-workflows \
  --description "Teacher-controlled AI workflow prototypes for rubric review, feedback drafting, and instructional support." \
  --homepage "https://grant-mccurdy.github.io/projects/instructional-ai-workflows.html"

gh repo edit grant-mccurdy/public-workspace \
  --description "Public staging workspace for portfolio project packets, docs, and early public-safe prototypes." \
  --homepage "https://grant-mccurdy.github.io/"
```

## Topics

```bash
gh repo edit grant-mccurdy/grant-mccurdy.github.io \
  --add-topic portfolio \
  --add-topic github-pages \
  --add-topic data-visualization \
  --add-topic education-analytics \
  --add-topic synthetic-data

gh repo edit grant-mccurdy/assessment-intelligence \
  --add-topic assessment \
  --add-topic education-analytics \
  --add-topic synthetic-data \
  --add-topic r \
  --add-topic dashboard \
  --add-topic github-pages

gh repo edit grant-mccurdy/education-data-simulation-engine \
  --add-topic synthetic-data \
  --add-topic education-data \
  --add-topic python \
  --add-topic duckdb \
  --add-topic data-generation \
  --add-topic privacy-safe

gh repo edit grant-mccurdy/statistical-risk-modeling-r \
  --add-topic r \
  --add-topic statistical-modeling \
  --add-topic risk-modeling \
  --add-topic glm \
  --add-topic calibration \
  --add-topic decision-support

gh repo edit grant-mccurdy/graduate-statistics-portfolio \
  --add-topic r \
  --add-topic statistics \
  --add-topic statistical-modeling \
  --add-topic glm \
  --add-topic cross-validation \
  --add-topic calibration \
  --add-topic regression \
  --add-topic portfolio

gh repo edit grant-mccurdy/content-intelligence-reporting \
  --add-topic content-intelligence \
  --add-topic reporting \
  --add-topic python \
  --add-topic retrieval \
  --add-topic ai-assisted-workflows

gh repo edit grant-mccurdy/instructional-ai-workflows \
  --add-topic instructional-ai \
  --add-topic education \
  --add-topic rubrics \
  --add-topic feedback \
  --add-topic ai-assisted-workflows

gh repo edit grant-mccurdy/public-workspace \
  --add-topic portfolio-workspace \
  --add-topic public-safe \
  --add-topic documentation
```

## Profile README Deployment

The file at `docs/github-profile/README.md` is ready to become the root `README.md` in a public profile repository named `grant-mccurdy/grant-mccurdy`.

Recommended setup:

```bash
gh repo create grant-mccurdy/grant-mccurdy --public --description "GitHub profile README for Grant McCurdy"
```

Then copy the profile README into that repository, commit it, and push through the normal public branch-and-PR workflow.
