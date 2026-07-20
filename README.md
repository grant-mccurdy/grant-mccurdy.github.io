# grant-mccurdy.github.io

GitHub Pages systems portfolio for Grant McCurdy.

The site routes reviewers through two primary surfaces: project briefs explain the work, while demos provide a direct path into working public systems. Source and validation links stay attached to the project that owns them.

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
- `demos/index.html` is the canonical directory for working portfolio experiences.
- `data-lab.html` is the Education Data Lab over the Worker-backed synthetic warehouse.
- `projects/*.html` are lightweight project-brief pages.
- `case-studies/` contains compatibility redirects to project briefs.
- `docs/github-profile/README.md` is a ready-to-use GitHub profile README draft.
- `docs/github-profile/repository-metadata.md` records the recommended public repo descriptions, topics, homepages, and profile setup commands.
- `assets/css/styles.css` controls the shared visual system and responsive experience layouts.
- `assets/js/site.js` controls the mobile navigation and header state.
- `data/portfolio-projects.json` is the curated project registry; repositories
  are never added to the public directory automatically. It owns canonical
  titles, status, summaries, evidence links, demo metadata, and sitemap dates.
- `data/synthetic/assessment-dashboard.manifest.json` binds the hosted
  assessment dashboard to its source extracts and builder.
- `scripts/publish_hotel_comp_site.py` converts the approved stakeholder report, simulation audit, and Markdown evidence from the separately maintained hotel-comp project into a public-safe static Pages bundle.
- `assets/js/data-lab.js` renders analytic response blocks from the private backend. Configure the endpoint through the `data-api-endpoint` attribute after Worker deployment, or use an `endpoint` query parameter for local testing.
- `assets/video/workflow-hero.mp4` is the muted, grayscale homepage hero loop generated from the latest local workflow recording.
- `assets/images/workflow-hero-poster.jpg` is the static poster and reduced-motion fallback for the homepage hero.
- `assets/images/social/` contains current 1280x640 review and social-preview captures for the curated portfolio surfaces.
- `.nojekyll` keeps GitHub Pages from applying Jekyll processing.
- `scripts/build_sitemap.mjs` generates the curated canonical sitemap from the project registry.
- `sitemap.xml` and `robots.txt` expose canonical portal pages to crawlers.

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
