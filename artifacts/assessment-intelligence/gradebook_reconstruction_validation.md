# Gradebook Reconstruction Validation

This report compares the private reference gradebook shape to the synthetic gradebook outputs without printing private values.

## Summary Checks

Check | Result | Detail
--- | --- | ---
Column count matches | TRUE | reference=39 synthetic=39
Row count matches | TRUE | reference=287 synthetic=287
Numeric column count matches | TRUE | reference=30 synthetic=30
No identity value overlap in wide gradebook | TRUE | overlap_count=0
No identity value overlap in long analytics data | TRUE | overlap_count=0
Missingness similarity within 15 percentage points | TRUE | columns_with_similar_missingness=89.7%
Assignment mean fidelity within 8 score points | TRUE | assignment_columns_with_similar_mean=100.0%
Assignment spread fidelity within 8 score points | TRUE | insufficient_reference_spread; skipped
Long analytics file exists | TRUE | path=data/synthetic/synthetic_student_scores_long.csv rows=8036
Long analytics schema is complete | TRUE | required_columns_present=TRUE
Assignment metadata file exists | TRUE | path=data/synthetic/synthetic_assignment_metadata.csv rows=28 expected=28

## Distribution Fidelity

Metric | Value
--- | ---
Median assignment mean gap |    0
Median assignment spread gap | NA
Assignment columns evaluated |   28
Long analytics rows | 8036
Assignment metadata rows |   28

## Role Counts

Reference roles:


          assignment        current_grade        current_score
                  29                    1                    1
         final_grade          final_score                   id
                   1                    1                    1
             section         sis_login_id          sis_user_id
                   1                    1                    1
             student unposted_final_score
                   1                    1

Synthetic roles:


          assignment        current_grade        current_score
                  29                    1                    1
         final_grade          final_score                   id
                   1                    1                    1
             section         sis_login_id          sis_user_id
                   1                    1                    1
             student unposted_final_score
                   1                    1
