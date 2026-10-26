# Assessment Intelligence Alignment: 26 October 2026

## Source and release

The local candidate imports the reviewed Logos bundle from Website source
commit `65ab2c6b9ea8f151535649af399bd5da60501159` (LC-021 report release).
Website's LC-029W handoff confirms the successful production build
`56520a2e-9d27-4bc9-b038-f624146d3861`, completed 26 October 2026 at 21:20 UTC,
and fresh source-to-live checks. The analytical producer is
`5ae98d3be7ef28efd0a91a419c36b80d1af435a5`. The approved report is served at
https://logoseducation.group/sample-report/; the written report and methods are
at https://logoseducation.group/sample-report/supporting-evidence/.
The design-preview route is not the source of publication authority.

The live report JavaScript matched LC-021 SHA-256
`82d09ecb98269df83a99e9062e33be9d50752ab26c7d10bb1501f49cf5b8bc3d`.
The served HTML includes hosting instrumentation, so its raw hash differs from
the uninstrumented release HTML; do not claim byte identity for that page.

## Data and figures

The aggregate JSON remains byte-identical:
`1fae20cb0f8a26270b7ed931ae510b918a44e783354ae730857fe39dedf1c34f`.
It contains 500 fictional students, 21 classes and 15,000 item-response records
for LOGOS-MATH-V2 revision 5, 30 questions. Form SHA-256:
`af91b62f5581bef95f13432f739052d1ac3fe845bbdd8c4817e7fc86b780dabf`.

The checked importer refreshes two canonical annotation-free SVGs:

- `pairwise-audit.svg`: `9790a73f8f3605ebc96b6f90e4211b464bdff3545f495ed343694a79d516dad5`
- `section-periods.svg`: `0e55df90a2bedf49388e9ce9f23b3e2689e00e4e3e0e37d05b5307053cc7d111`

Both hashes match the public Logos assets. The other four figures, underlying
analysis and narrative export are unchanged. The full bundle hashes remain in
`data/logos/manifest.json`. No inference was rerun to remove annotations.

## Intended presentation differences

The portfolio emphasizes Grant's analysis, validation, implementation and
downloadable evidence. Logos emphasizes the educator's review workflow.
Both use the same synthetic cohort, not client results or live practice answers.

The portfolio retains native course violins, the course-difference heatmap,
course/track filters, selected question and class CSV exports, and question-level
analysis. It does not embed a screenshot as the analytical interface. It retains
all 21 classes; Logos's focused Classes view covers 19 classes and 440 students
in Algebra I through Precalculus. That is a view scope, not a changed cohort.

The portfolio retains 22 planned contrasts in separate 14/4/4 Holm families,
as well as the separate 45-pair exploratory heatmap. The current Logos comparison
workspace focuses on the 45 exploratory pairs; the planned contrasts remain in
supporting evidence. Do not replace 22 with 45 or combine their adjustments.
Signed differences are row minus column. Pointwise 95% intervals are unadjusted,
while decisions use the original family-adjusted p-values. Inconclusive does not
mean equivalent; shared classes and small cluster counts limit interpretation.

Logos provides a selected-pair panel and score-frequency dialogs. The portfolio
uses chart inspection and data tables; those are intentional interaction
differences, not a claim that the interfaces have identical features.

## Warehouse scope

The separate SQL/dbt/DuckDB demonstration is not the source of the Logos report.
The August qualification remains a historical quotation, followed by an explicit
scope note. Reading the warehouse README at `59e5aeb` confirms documented parity
and release-candidate commands, not a newly verified build. This change does not
update the historical repository-proof record or certify a warehouse release.

## Publication boundary

At inspection, public Portfolio was the older image/bar implementation based on
`41ea795`, with source-link corrections subsequently published in
`9b81a0e912427d2b0e215698c0279e91ff0cedbd`. Those corrections are preserved in
this candidate. The working tree and private preview had later native charts. Preparing
this candidate does not update public URLs or clear an external proposal hold.
The repository has unrelated unpublished work, including the new instructional
design sample. A public release must select only the assessment dependency set,
receive publication approval, and be verified at the actual public URLs.
