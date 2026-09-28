# Logos Portfolio Alignment

The portfolio presents Grant's work and methods. Logos Education Group presents
the assessment and reporting service. They share restrained typography,
neutral surfaces, report figures, and an assessment-to-decision narrative.
AI-assisted assessment authoring, reviewed feedback, and source-grounded reporting
remain part of the professional positioning.

## Connected Experiences

- Practice assessment: https://logoseducation.group/assessment-preview/
- Written department report: https://logoseducation.group/sample-report/
- Interactive portfolio dashboard: `dashboard/assessment.html`

The dashboard and report share a designed fictional administration: 500 students,
21 classes, 15,000 response records, and LOGOS-MATH-V2 revision 5 (30 questions).
The dashboard imports aggregate summaries only. It does not collect practice
answers or include student-level response records.

The three priorities are geometric readiness in Algebra II, uncertain
within-course track differences, and variation among Regular Geometry classes.
The six original report figures remain byte-identical. Filters affect the
dashboard bars and values; the original figures remain explicitly labeled
whole-department views. The written interpretation also describes the whole
department. Comparison filters retain the original tests, correction families,
and uncertainty. They do not recalculate significance.

## Ownership And Reproduction

Logos owns the assessment, aggregate report export, figures, and interpretation.
This repository owns the interactive presentation. The published dashboard runs
entirely on local static assets; no private checkout or API is needed.

Refresh from an explicitly supplied reviewed Logos website checkout:

```sh
python3 scripts/sync_logos_report.py --source /path/to/logos-education-site
make check
```

The importer checks the source report manifest, form identity, aggregate
schema, populations, and hashes before copying anything. It calls the reviewed
editorial function, whose assertions verify that the data supports the prose.
A form or scenario change requires an interpretation review and an update
to the importer contract. No private source path is written to publication files.

Verify in a standalone public checkout:

```sh
python3 scripts/sync_logos_report.py --check
python3 scripts/test_logos_import.py
node scripts/department_dashboard_smoke.mjs
```

The browser check verifies weighted calculations, question totals, filters,
empty states, CSV downloads, URL state, six figures, accessibility, load-failure
recovery, and the no-JavaScript fallback. Screenshots are written to
`tmp/logos-alignment/` at 1440, 390, and 320 pixels, including text enlargement.

## Separate Data Products

The earlier SQL/dbt/DuckDB implementation remains available at
`dashboard/longitudinal.html`. Its seven-year data, scripts, and original
publication manifest are retained. The Data Lab also retains its original
warehouse and backend. Neither is presented as the source of the Logos report.

The August 2026 repository proof records remain unchanged. The assessment
project brief distinguishes those historical implementation qualifications from
the new presentation. A future upstream integration can move the report import
into Assessment Intelligence's publishing workflow without changing its data.

The reviewed helper corpus sources describe the alignment, but the live homepage
helper needs a separate corpus rebuild and authorized backend deployment to
consume those changes. Updating this site does not change a live knowledge base.

## Publication

Preview and review locally before publication. Commit, push, GitHub Pages release,
and backend deployment remain separate user-authorized actions. The Logos website
and its deployment are unchanged by this portfolio work.
