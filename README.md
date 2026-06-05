# grant-mccurdy.github.io

GitHub Pages public project portal for Grant McCurdy.

The site summarizes public-facing project work in assessment systems, AI-assisted instructional workflows, and content intelligence/reporting pipelines, and routes reviewers to hosted demos, case studies, and source repositories.

Suggested homepage message:

> I build assessment systems, AI-assisted instructional workflows, and content intelligence pipelines at the intersection of mathematics, statistics, education, and software.

## Role Of This Repo

This repo is the presentation layer. It links to the project repositories and provides concise case-study pages, screenshots, and demos.

It should not contain all project source code, raw data, private Canvas extracts, student records, transcripts, or private workflow artifacts.

## Planned Structure

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
- `projects/*.html` are lightweight project-brief pages.
- `case-studies/index.html` is a case-study index template.
- `assets/css/styles.css` controls the visual system.
- `assets/js/site.js` controls the mobile navigation and header state.
- `assets/images/portfolio-systems-hero.png` is the current hero image.
- `.nojekyll` keeps GitHub Pages from applying Jekyll processing.

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

## Project Areas

- `assessment-intelligence`: assessment design, synthetic assessment data, dashboards, and reporting workflows.
- `instructional-ai-workflows`: teacher-controlled AI-assisted feedback, review, and remediation workflows.
- `content-intelligence-reporting`: unstructured content processing and source-grounded report generation.

## Public Safety Rules

Use only public-safe screenshots, synthetic data, generalized case-study language, and links to sanitized repos. Do not publish private school data, student data, API credentials, Canvas links, private transcripts, or copyrighted course materials.

## Current Portal State

- Content Intelligence Reporting is demo-ready and has a hosted sample report and case study.
- Assessment Intelligence has a hosted static dashboard and active reporting/modeling source artifacts.
- Instructional AI Workflows is intentionally labeled as scaffolded until the first synthetic workflow demo is published.
