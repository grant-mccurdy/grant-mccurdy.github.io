# AGENTS.md

## Repository Role

This repository is the public GitHub Pages presentation layer for Grant
McCurdy's portfolio. It is a static HTML, CSS, and JavaScript site that links
portfolio narratives, demonstrations, case studies, and public project
repositories.

Keep this repository independently understandable and safe to publish. Do not
make its operation depend on private workspace paths or private documentation.

## RAG Surface Boundaries

The site contains three distinct RAG interfaces. Preserve their separate
purposes, data sources, and backend routes.

| Surface | Purpose | Primary frontend | Worker route |
| --- | --- | --- | --- |
| Homepage helper | Answer questions about Grant, the portfolio, projects, and site navigation | `index.html`, `assets/js/portfolio-helper.js`, `content/rag/` | `/query` |
| Portfolio Data Lab | Analyze the synthetic education warehouse and render analytic response blocks | `data-lab.html`, `assets/js/data-lab.js` | `/analytics/query` |
| Content Intelligence RAG | Retrieve and answer from processed, citation-ready content artifacts | `demos/content-rag.html`, `assets/js/content-rag.js` | `/content/query` |

Do not silently route one surface to another corpus or merge their knowledge
bases. A deliberate handoff link is acceptable when a question belongs to a
different surface. Shared UI code is appropriate only when it does not blur
these product boundaries.

The private Worker implementation, model prompts, database bindings, secrets,
and deployment configuration belong in the private backend repository. The
content ingestion, conversion, chunking, and vector-record workflow belongs in
the public Content Intelligence repository.

## Frontend Editing Rules

- Preserve existing `data-*` hooks, element IDs, endpoint attributes, and
  script paths unless the corresponding JavaScript and checks are updated in
  the same change.
- Keep forms keyboard-accessible and use native buttons for actions. Preserve
  focus management, disabled/loading states, error handling, and reduced-motion
  behavior.
- Treat a suggested RAG prompt as an action. Unless a surface explicitly labels
  the control as an editor or preview, clicking a suggestion should submit it
  through the same request path as a typed form submission.
- Keep layouts usable without horizontal overflow on mobile and desktop.
- Use relative internal links and retain graceful states for unavailable,
  unauthorized, rate-limited, and timed-out services.
- Keep copy direct and specific. Avoid repeating architecture language when a
  concrete description of the artifact or user action is clearer.
- Write capability statements in durable present tense. Avoid unqualified
  `now`, `currently`, `recently`, and `newly`; use a specific date, release, or
  version when timing materially matters.

## Knowledge Sources And Generated Content

Only reviewed, public-safe material may be added to `content/rag/`. Changes to
that directory do not automatically update the live homepage helper: rebuild
the backend's generated corpus, validate it, and redeploy the Worker in its own
repository when a live knowledge-base update is intended.

Do not hand-edit generated publication outputs when a documented builder or
publisher owns them. Update the source and regenerate the output instead.
Preserve source identifiers, citations, safety metadata, and lineage fields in
retrieval-facing artifacts.

## Public Safety

Never add API keys, Cloudflare tokens, Worker secrets, demo tokens, `.env`
files, credentials, private URLs, raw exports, student or personnel records,
private transcripts, copyrighted source materials, or unsanitized notebooks.

Use synthetic, generated, aggregated, sanitized, public, or permission-safe
material. Review both source files and generated outputs before publication.
Public endpoint URLs may be stored in HTML; credentials and authorization
secrets may not.

## Validation

The site has no required build step. Run checks from this repository root.

```bash
make check
git diff --check
```

When JavaScript changes, also run `node --check` for every changed JavaScript
file. Use `make external-links` only when network-dependent link validation is
relevant. For interaction or layout changes, serve the site locally and verify
the affected flow at desktop and mobile widths.

Before handing off a change, inspect `git status --short --branch`, review the
exact diff, and scan changed files for secrets or private data.

## Git And Deployment

Preserve unrelated work in a dirty tree. Do not create branches, issues,
commits, pushes, pull requests, merges, or deployments unless the user
explicitly requests the corresponding action.

GitHub Pages publication and private Worker deployment are separate operations.
A frontend endpoint or corpus-source change may require coordinated updates,
but authorization for one repository does not imply authorization for another.
