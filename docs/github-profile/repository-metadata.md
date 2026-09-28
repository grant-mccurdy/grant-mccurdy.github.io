# GitHub Repository Metadata

This file records the intended public profile configuration. Applying these settings is a separate live GitHub action and should happen only after the site changes have been reviewed and merged.

## Profile

Suggested public bio:

> Mathematics and learning-systems leader building AI-enabled, data-informed systems for assessment, learning, measurement, and organizational decision-making.

Suggested website:

```text
https://grant-mccurdy.github.io/
```

Public social account:

```text
https://www.linkedin.com/in/grant-mccurdy/
```

Suggested pinned repository order:

1. `statistical-risk-modeling-r`
2. `assessment-intelligence`
3. `assessment-to-remediation-pipeline`
4. `grant-mccurdy.github.io`

Education Data Simulation Engine, Instructional AI Workflows, Content Intelligence, and Graduate Statistics Portfolio remain linked as supporting evidence rather than pinned featured work. Prototype labels and every Projects qualification remain explicit. Projects outside the current Projects evidence snapshot are excluded.

## Repository Settings

```bash
gh repo edit grant-mccurdy/assessment-intelligence \
  --description "Governed dbt/DuckDB assessment analytics with parity-controlled extracts, privacy validation, stakeholder reports, and a hash-bound dashboard payload." \
  --homepage "https://grant-mccurdy.github.io/projects/assessment-intelligence.html"

gh repo edit grant-mccurdy/content-intelligence \
  --description "Supporting artifact-to-RAG workflow preserving provenance, safety state, corpus fingerprints, and bounded citations through retrieval." \
  --homepage "https://grant-mccurdy.github.io/projects/content-intelligence.html"

gh repo edit grant-mccurdy/education-data-simulation-engine \
  --description "Supporting seven-year synthetic mathematics data foundation with cross-table validation, Canvas-style records, and a DuckDB star schema." \
  --homepage "https://grant-mccurdy.github.io/projects/education-data-simulation-engine.html"

gh repo edit grant-mccurdy/statistical-risk-modeling-r \
  --description "Public-safe R assessment-growth modeling with model-family search, temporal and holdout validation, decision guardrails, and stakeholder reporting." \
  --homepage "https://grant-mccurdy.github.io/projects/statistical-risk-modeling-r.html"

gh repo edit grant-mccurdy/graduate-statistics-portfolio \
  --description "Supporting public-safe R portfolio with nonlinear signal and clinical risk GLM analysis, validation, calibration, diagnostics, and cautious interpretation." \
  --homepage "https://grant-mccurdy.github.io/projects/graduate-statistics-portfolio.html"

gh repo edit grant-mccurdy/instructional-ai-workflows \
  --description "Supporting offline, deterministic, teacher-controlled rubric-to-feedback workflow with inspectable human-review boundaries." \
  --homepage "https://grant-mccurdy.github.io/instructional-ai-workflows/"

gh repo edit grant-mccurdy/assessment-to-remediation-pipeline \
  --description "Qualified 36-item assessment authoring-review-export prototype with advisory reviews and an offline Canvas New Quizzes payload." \
  --homepage "https://grant-mccurdy.github.io/assessment-to-remediation-pipeline/"

gh repo edit grant-mccurdy/grant-mccurdy.github.io \
  --description "Learning-systems portfolio for assessment, measurement, education data, analytics, and human-reviewed AI workflows." \
  --homepage "https://grant-mccurdy.github.io/"
```

## Topics

```bash
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
