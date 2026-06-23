# Advanced Synthetic Gradebook Synthesis

This public-safe report documents the R workflow used to reconstruct a realistic synthetic gradebook from private reference structure.
It prints aggregate workflow properties only; it does not print private rows, identifiers, section labels, or assignment names.

## Output Summary

Metric | Value
--- | ---
Reference rows |  287
Synthetic rows |  287
Columns preserved |   39
Numeric assignment columns synthesized |   28
Long-form score records | 8036
Synthetic sections |    1
Synthetic assignment families |    5

## R Synthesis Techniques

Technique | Implementation
--- | ---
Schema reconstruction | Column order, standard Canvas fields, numeric-like roles, blank rates, and score ranges are profiled from the private reference.
Latent trait simulation | Synthetic students receive correlated ability, engagement, growth, and submission-risk factors.
Distribution mapping | Generated scores are rank-mapped onto observed reference quantiles by assignment column without copying rows.
Missingness modeling | Completion is modeled separately from low performance using assignment blank rates and synthetic engagement/risk factors.
Analytics reshaping | The wide Canvas-style gradebook is converted into a long student-assignment record table for modeling and dashboards.
Privacy protection | Identity fields, student labels, IDs, SIS IDs, login IDs, section labels, and assignment labels are generated or sanitized by default.

## Outputs

- `data/synthetic/synthetic_gradebook.csv`: Canvas-style wide synthetic gradebook.
- `data/synthetic/synthetic_student_scores_long.csv`: analytics-ready student-assignment score records.
- `data/synthetic/synthetic_assignment_metadata.csv`: public-safe assignment families, sequence, domain, and calibration metrics.

## Public Boundary

The public workflow can be shown in the repository. The reference gradebook path and any detailed private profile remain local/private.
