# GitHub Repository Metadata

This file records the intended public profile configuration. Applying these settings is a separate live GitHub action and should happen only after the site changes have been reviewed and merged.

## Profile

Suggested public bio:

> Analytics and systems builder creating decision tools, validated data products, statistical models, and source-grounded AI workflows.

Suggested website:

```text
https://grant-mccurdy.github.io/
```

Public social account:

```text
https://www.linkedin.com/in/grant-mccurdy/
```

Suggested pinned repository order:

1. `hotel-comp-policy-model`
2. `assessment-intelligence`
3. `content-intelligence`
4. `education-data-simulation-engine`
5. `statistical-risk-modeling-r`
6. `grant-mccurdy.github.io`

The Graduate Statistics Portfolio remains linked as supporting methods evidence. The active workflow prototypes remain discoverable through the portal without displacing the four flagships. Repositories pending human QA are not included.

## Repository Settings

```bash
gh repo edit grant-mccurdy/hotel-comp-policy-model \
  --description "Explainable hotel service-recovery decision support with policy comparison, sensitivity analysis, and controlled shadow validation." \
  --homepage "https://grant-mccurdy.github.io/projects/hotel-comp-policy-model/"

gh repo edit grant-mccurdy/assessment-intelligence \
  --description "SQL, R, and Python assessment analytics with reproducible extracts, reporting artifacts, and an interactive dashboard." \
  --homepage "https://grant-mccurdy.github.io/projects/assessment-intelligence.html"

gh repo edit grant-mccurdy/content-intelligence \
  --description "Artifact-to-RAG workflow for provenance-rich information objects, reviewed retrieval records, and cited answers." \
  --homepage "https://grant-mccurdy.github.io/projects/content-intelligence.html"

gh repo edit grant-mccurdy/education-data-simulation-engine \
  --description "Validated synthetic education data and warehouse models for public-safe analytics products and workflow prototypes." \
  --homepage "https://grant-mccurdy.github.io/projects/education-data-simulation-engine.html"

gh repo edit grant-mccurdy/statistical-risk-modeling-r \
  --description "Public-safe R assessment growth analytics with expected-growth validation, adjusted section signals, and stakeholder reporting." \
  --homepage "https://grant-mccurdy.github.io/projects/statistical-risk-modeling-r.html"

gh repo edit grant-mccurdy/graduate-statistics-portfolio \
  --description "Curated R methods portfolio featuring nonlinear models, GLMs, cross-validation, calibration, thresholds, and diagnostics." \
  --homepage "https://grant-mccurdy.github.io/projects/graduate-statistics-portfolio.html"

gh repo edit grant-mccurdy/instructional-ai-workflows \
  --description "Human-reviewed workflow prototypes for rubric evidence, feedback drafting, reviewer packets, and remediation actions." \
  --homepage "https://grant-mccurdy.github.io/instructional-ai-workflows/"

gh repo edit grant-mccurdy/assessment-to-remediation-pipeline \
  --description "Review-gated math diagnostic authoring, static previews, public-safe LMS payloads, and remediation workflow design." \
  --homepage "https://grant-mccurdy.github.io/assessment-to-remediation-pipeline/"

gh repo edit grant-mccurdy/grant-mccurdy.github.io \
  --description "Curated portfolio portal for decision support, analytics systems, statistical modeling, and source-grounded AI workflows." \
  --homepage "https://grant-mccurdy.github.io/"
```

## Topics

```bash
gh repo edit grant-mccurdy/hotel-comp-policy-model \
  --add-topic decision-support \
  --add-topic hospitality-analytics \
  --add-topic simulation \
  --add-topic sensitivity-analysis \
  --add-topic data-validation

gh repo edit grant-mccurdy/assessment-intelligence \
  --add-topic assessment \
  --add-topic analytics \
  --add-topic sql \
  --add-topic r \
  --add-topic dashboard \
  --add-topic synthetic-data

gh repo edit grant-mccurdy/content-intelligence \
  --add-topic content-intelligence \
  --add-topic rag \
  --add-topic provenance \
  --add-topic retrieval \
  --add-topic ai-assisted-workflows

gh repo edit grant-mccurdy/education-data-simulation-engine \
  --add-topic synthetic-data \
  --add-topic data-engineering \
  --add-topic python \
  --add-topic duckdb \
  --add-topic data-validation

gh repo edit grant-mccurdy/statistical-risk-modeling-r \
  --add-topic r \
  --add-topic assessment-analytics \
  --add-topic growth-modeling \
  --add-topic validation \
  --add-topic decision-support

gh repo edit grant-mccurdy/assessment-to-remediation-pipeline \
  --add-topic assessment \
  --add-topic workflow-automation \
  --add-topic synthetic-data \
  --add-topic canvas-lms \
  --add-topic human-in-the-loop

gh repo edit grant-mccurdy/instructional-ai-workflows \
  --add-topic instructional-design \
  --add-topic human-in-the-loop \
  --add-topic workflow-automation \
  --add-topic synthetic-data

gh repo edit grant-mccurdy/grant-mccurdy.github.io \
  --add-topic portfolio \
  --add-topic github-pages \
  --add-topic analytics \
  --add-topic data-visualization \
  --add-topic decision-support
```

## Live Update Boundary

The commands above are reviewed guidance, not an automated sync. Profile bio, repository metadata, topics, and pin order should be changed only after explicit authorization for those live GitHub writes.
