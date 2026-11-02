# Mathematics Program Evaluation

The report at `demos/math-program-report/` mirrors a versioned public Logos report.
Logos remains the source of truth for analytical code and data. The portfolio
adds its own navigation, Overview, Priorities, and within-track presentation.

Run `make report-mirror` to verify source hashes, the 14 published class
comparisons, narrative values, navigation, and desktop/mobile behavior.
Run `node scripts/sync-logos-report.mjs --rebuild-shell` after adapter changes.
Running that script without a flag deliberately retrieves a new public snapshot;
review and test it before release.

The retained public source fixtures in `sources/logos-report/` are not portfolio
pages; their original links are preserved for provenance. The HTML link checker
excludes those fixtures. The served report links to Logos for original evidence.
No private institutional records or independent analysis of a real school are
included.

The class extension uses existing student-level Welch tests with Holm adjustment
across 14 planned class comparisons. The separate course comparison view contains
45 exploratory comparisons. Descriptive domain patterns are not new inferential
tests. Detailed interpretation remains with the relevant analysis.

Overview headings match the four chart tabs. Each section describes the figure,
the overall pattern, and relevant detail. Priorities names proposed owners, tasks,
and follow-up evidence. Keep claims tied to the source data and avoid repeated
disclaimers or sentences that merely announce a need for review.

Refresh the four homepage carousel figures with
`node scripts/capture-report-previews.mjs`. It retains the selected chart types,
groups and framing, captures at 2x resolution, and checks desktop/mobile carousel
navigation. `scripts/report-preview-snapshots.json` records source and image
hashes so the captures can be traced to the report version they show.
