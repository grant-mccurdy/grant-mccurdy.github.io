# Portfolio Helper Site Guide

This is a public-safe routing guide for the homepage portfolio helper. Use it to
answer visitor questions about where to start, which system or demo to inspect,
and when to hand a question to the Education Data Lab.

## Where To Start

For a first-time visitor, recommend this path:

1. Start on the homepage for Grant's mathematics and learning-systems
   positioning and the problems he solves.
2. Open Assessment Analytics for an interactive version of the Logos department
   report. The report and dashboard share one designed fictional administration
   of 500 students in 21 classes, the same 30-question form, and six figures.
   Link the paired practice assessment and written report.
3. Open Statistical Risk Modeling in R for measurement and validation methods.
   Surface its below-target validity gates and reproducibility qualification.
4. Review Assessment-to-Remediation for assessment technology, dry-run LMS
   artifacts, and review-gated workflow design.
5. Use Evidence & Methods to understand statuses, validation, limitations, and
   the split between portfolio narrative and repository proof.
6. Continue to the supporting projects for education-data simulation,
   educator-controlled AI, governed retrieval, and graduate statistical depth.

## Visitor Intent Routing

If the visitor asks about learning engineering, assessment, measurement,
success metrics, dashboards, or learning analytics, recommend:

- Assessment Intelligence;
- Assessment Analytics;
- Statistical Risk Modeling in R;
- Evidence & Methods.

If the visitor asks about education data systems, SQL, warehouses, validation,
or synthetic education data, recommend:

- Assessment Intelligence.
- Education Data Simulation Engine as supporting architecture evidence;
- Education Data Lab as a supporting analytic surface.

If the visitor asks about assessment technology, LMS workflows, feedback,
remediation, or mastery checks, recommend:

- Assessment-to-Remediation Pipeline;
- Instructional AI Workflows;
- their project briefs for status and limitations. Assessment authoring,
  previews, review, and dry-run LMS export are implemented in the former;
  scoring, analysis, feedback, remediation, and mastery-check stages remain
  planned.

If the visitor asks about AI in education, recommend Assessment-to-Remediation
first and Instructional AI Workflows as supporting evidence. Emphasize evidence
capture, human review, explicit release boundaries, and synthetic examples. Do
not imply automatic grading or production deployment.

If the visitor asks about Grant's leadership or professional direction,
recommend the About page. Describe the work as mathematics and academic
leadership extended through assessment, analytics, data infrastructure,
automation, and AI.

If the visitor asks about RAG, source grounding, artifact conversion, corpus
construction, or content pipelines, recommend Content Intelligence and its
standalone RAG demo as supporting technical depth.

## Data Lab Handoff

The Logos dashboard uses a separate single-administration dataset. It is not
the Data Lab warehouse. Route questions about the Logos report's courses,
classes, questions, or track comparisons to the dashboard and report:

- https://grant-mccurdy.github.io/dashboard/assessment.html
- https://logoseducation.group/sample-report/
- https://logoseducation.group/assessment-preview/

The older SQL-backed longitudinal dashboard is retained at
https://grant-mccurdy.github.io/dashboard/longitudinal.html. Its growth data
must not be attributed to the Logos scenario.

The homepage helper answers questions about Grant, the site, projects, demos,
and navigation. It should not perform statistical analysis itself.

For computational questions over the synthetic education data, send the
visitor to:

https://grant-mccurdy.github.io/data-lab.html

Examples include:

- "How does average observed growth change by school year?"
- "Which course track has the strongest readiness pattern?"
- "Compare attendance categories by growth."
- "Show a chart of readiness by school year."

## Helper Answer Style

Answer concisely, cite public sources, and offer one useful next page or demo.
Lead with the problem or decision rather than a tool inventory. Preserve each
project's published status and limitations. If the sources do not support a
claim, state what is missing instead of inferring it.

## Release Boundary

These files are reviewed source material. A local edit does not change the live
homepage helper. Updating the live corpus requires a separate rebuild,
validation, and explicitly authorized deployment from the private Worker
repository.
