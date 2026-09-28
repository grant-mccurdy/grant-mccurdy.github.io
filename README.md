# grant-mccurdy.github.io

GitHub Pages learning-systems portfolio for Grant McCurdy.

The site presents Grant as a mathematics and learning-systems leader working across assessment, measurement, analytics, education data infrastructure, automation, and human-reviewed AI. Project briefs explain the work, demos provide a direct path into public systems, and source and validation links stay attached to the project that owns them.

## Role Of This Repo

This repo is the presentation layer. It links to project repositories and provides concise briefs, demos, generated reports, and public-safe review assets.

It should not contain all project source code, raw data, private Canvas extracts, student records, transcripts, or private workflow artifacts.

## Repository Structure

```text
grant-mccurdy.github.io/
├── index.html
├── projects/
├── demos/
├── assets/
├── data/
├── scripts/
└── README.md
```

## Template Files

- `index.html` is the portfolio homepage.
- `about.html` contains the canonical public positioning, professional throughline, role alignment, and contact routes.
- `evidence-methods.html` explains evidence status, validation, limitations, the case-study template, and the portfolio/repository boundary.
- `demos/index.html` is the canonical directory for working portfolio experiences.
- `data-lab.html` is the Education Data Lab over the Worker-backed synthetic warehouse.
- `projects/*.html` are lightweight project-brief pages.
- `case-studies/` contains compatibility redirects to project briefs.
- `docs/github-profile/README.md` is a ready-to-use GitHub profile README draft.
- `docs/github-profile/repository-metadata.md` records the recommended public repo descriptions, topics, homepages, and profile setup commands.
- `assets/css/styles.css` controls the shared visual system and responsive experience layouts.
- `assets/js/site.js` controls the mobile navigation and header state.
- `data/portfolio-projects.json` is the curated presentation registry;
  repositories are never added automatically. Its seven campaign entries and
  fourteen qualification-bound claims are bound to Projects
  `portfolio-proof.v1` fingerprint
  `75479d72822392455359e9517c0e2751d36256044adfb6cc5ccf956d7cb30566`.
  The registry retains project eligibility, repository revisions, claim IDs,
  statements, statuses, qualifications, evidence references, and item hashes.
- `dashboard/assessment.html` presents the Logos department report as an
  interactive dashboard: the same 500 students, 21 classes, 30 questions,
  six figures, and reviewed interpretation.
- `data/logos/manifest.json` binds that dashboard's aggregate data, narrative,
  and figures to the reviewed Logos source. See
  [the alignment guide](docs/logos-alignment.md) for refresh and verification.
- `dashboard/longitudinal.html` preserves the earlier seven-year simulation.
  `data/synthetic/assessment-dashboard.manifest.json` binds that separate
  demonstration to its SQL extracts and builder.
- `assets/js/data-lab.js` renders analytic response blocks from the private backend. Configure the endpoint through the `data-api-endpoint` attribute after Worker deployment, or use an `endpoint` query parameter for local testing.
- `assets/images/logos/course-distributions.png` is the homepage report image,
  rendered from the checked original SVG by the review-capture script.
  The earlier workflow video and poster are retained but are not used by the homepage.
- `assets/images/social/` contains current 1280x640 review and social-preview captures for the curated portfolio surfaces.
- `.nojekyll` keeps GitHub Pages from applying Jekyll processing.
- `scripts/build_sitemap.mjs` generates the curated canonical sitemap from the project registry.
- `sitemap.xml` and `robots.txt` expose canonical portal pages to crawlers.

## Presentation And Evidence Boundary

The portfolio site owns problem framing, intended audience, decision relevance,
selected evidence, explicit status and limitations, demos, and routes to deeper
inspection. Project repositories own code, setup, tests, data contracts, model
cards, detailed architecture, generated artifacts, validation logic, and
implementation history.

The files in `content/rag/` are reviewed, public-safe source inputs. Editing
them does not update the live homepage helper. A live knowledge update requires
a separate corpus rebuild, validation, and explicitly authorized deployment in
the private Worker repository.

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

The check suite validates prose conventions, local links and fragments, the
curated project/demo inventory, sitemap and site-shell contracts, assessment
publication integrity, dashboard logic, accessibility, and responsive browser
rendering. GitHub Actions runs the same suite for pull requests and main-branch
updates; external and live-service checks remain separate because network hosts
can be transient.

External GitHub links require network access and are checked separately:

```bash
make external-links
```

## Public Safety Rules

Use only public-safe screenshots, synthetic data, generalized case-study language, and links to sanitized repos. Do not publish private school data, student data, API credentials, Canvas links, private transcripts, or copyrighted course materials.

## Licensing

- Site code is available under the [MIT License](LICENSE).
- Original copy, documentation, and generated visual content are available under [CC BY 4.0](LICENSE-CONTENT.md).
- Original synthetic data published with the dashboard are available under [CC BY 4.0](LICENSE-DATA.md).

Third-party materials, trademarks, personal likenesses, and acquired source material are excluded unless explicitly stated otherwise.
