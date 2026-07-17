# grant-mccurdy.github.io

GitHub Pages systems portfolio for Grant McCurdy.

The site summarizes public-facing project work in data systems, analytics products, workflow automation, AI-assisted systems, and content intelligence pipelines, and routes reviewers to hosted demos, case studies, source repositories, and workspace project folders.

Suggested homepage message:

> I build data systems, analytics products, AI-assisted workflows, and source-grounded tools that turn messy information into usable decisions, artifacts, and operations.

## Role Of This Repo

This repo is the presentation layer. It links to the project repositories and provides concise case-study pages, screenshots, and demos.

It should not contain all project source code, raw data, private Canvas extracts, student records, transcripts, or private workflow artifacts.

## Repository Structure

```text
grant-mccurdy.github.io/
├── index.html
├── projects/
├── case-studies/
├── assets/
├── screenshots/
└── README.md
```

## Template Files

- `index.html` is the portfolio homepage.
- `data-lab.html` is the structured analytic chat surface for the private Worker-backed synthetic warehouse.
- `projects/*.html` are lightweight project-brief pages.
- `case-studies/index.html` is a case-study index template.
- `docs/github-profile/README.md` is a ready-to-use GitHub profile README draft.
- `docs/github-profile/repository-metadata.md` records the recommended public repo descriptions, topics, homepages, and profile setup commands.
- `assets/css/styles.css` controls the visual system.
- `assets/js/site.js` controls the mobile navigation and header state.
- `data/portfolio-projects.json` is the curated project registry; repositories
  are never added to the public directory automatically.
- `data/synthetic/assessment-dashboard.manifest.json` binds the hosted
  assessment dashboard to its source extracts and builder.
- `scripts/publish_hotel_comp_site.py` converts the approved stakeholder report, simulation audit, and Markdown evidence from the separately maintained hotel-comp project into a public-safe static Pages bundle.
- `assets/js/data-lab.js` renders analytic response blocks from the private backend. Configure the endpoint through the `data-api-endpoint` attribute after Worker deployment, or use an `endpoint` query parameter for local testing.
- `assets/video/workflow-hero.mp4` is the muted, grayscale homepage hero loop generated from the latest local workflow recording.
- `assets/images/workflow-hero-poster.jpg` is the static poster and reduced-motion fallback for the homepage hero.
- `.nojekyll` keeps GitHub Pages from applying Jekyll processing.
- `sitemap.xml` and `robots.txt` expose the public portal pages to crawlers.

## Local Testing

The site is static HTML/CSS/JS and does not require a build step.

From this directory:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8765/
```

Run local checks:

```bash
make check
```

The check suite validates local links and fragments, curated project inventory,
assessment publication integrity, dashboard logic, and responsive browser
rendering. GitHub Actions runs the same suite for pull requests and main-branch
updates; external links run on a separate schedule because third-party hosts can
be transient.

External GitHub links require network access and are checked separately:

```bash
make external-links
```

## Project Areas

- `hotel-comp-policy-model`: luxury-hospitality comp-policy comparison, shadow-validation decision support, manager recommendations, assumption stress testing, and warehouse validation.
- `education-data-simulation-engine`: public-safe education data simulation, validation, and SQL-ready analytics foundations.
- `assessment-intelligence`: assessment design, analytics, dashboards, diagnostics, and reporting workflows.
- `statistical-risk-modeling-r`: public-safe R assessment-growth analytics, expected-growth modeling, section signal diagnostics, validation, and model-card reporting.
- `assessment-to-remediation-pipeline`: math-readiness diagnostic authoring, review gates, Canvas dry-run payloads, and remediation workflow design.
- `instructional-ai-workflows`: teacher-controlled AI-assisted feedback, review, and remediation workflows.
- `content-intelligence`: unstructured content processing, transcript enrichment, source-grounded information objects, and report generation.

## Public Safety Rules

Use only public-safe screenshots, synthetic data, generalized case-study language, and links to sanitized repos. Do not publish private school data, student data, API credentials, Canvas links, private transcripts, or copyrighted course materials.

## Current Portal State

- Hotel Comp Policy Model has a hosted five-policy decision brief, generated shadow-validation candidate, interactive manager scenarios, synthetic policy audit, coherent assumption stress testing, data lineage, Snowflake validation, and public property context.
- The homepage presents a systems-portfolio path: capabilities, selected work, demos, case studies, and operating principles.
- Portfolio Data Lab is present as a static UI shell connected to the private `portfolio-rag-api` Worker endpoint. It must fail gracefully and must not contain API keys, Worker secrets, or demo tokens.
- Content Intelligence is portfolio-ready and has a hosted sample report, case study, transcript enrichment examples, OCR cleanup workflow, information-object map, and method-pack artifacts.
- Education Data Simulation Engine has a seven-year public-safe simulation with methodology, generated artifacts, DuckDB marts, star-schema outputs, Supabase/Postgres serving docs, and current validation summaries.
- Assessment Intelligence has a hosted static dashboard, five SQL extract files, optional Supabase extract reports, AI review artifacts, plot catalog, and active reporting/modeling source artifacts.
- Assessment Growth Analytics in R has a public-safe BOY/EOY assessment-growth model, repeated cross-validation model comparison, holdout validation metrics, section signal diagnostics, stakeholder reporting, and a model card.
- Assessment-to-Remediation Pipeline has an original 36-item math-readiness diagnostic, student and instructor previews, automated review artifacts, and offline Canvas New Quizzes payloads.
- Instructional AI Workflows has an active synthetic Precalculus FRQ workflow demo with three evaluated examples, teacher review packets, student-facing feedback, and remediation planning output.
- Internal link checks validate both local file paths and same-site HTML fragments.
