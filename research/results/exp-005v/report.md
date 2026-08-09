EXP-005V REPORT: FAILURE SIGNAL VALIDITY AUDIT

DECISION: SIGNAL_REJECTED

SOURCE: EXP-005 (recorded STRONG_SIGNAL, 11/11 VERIFICATION_FAILURE)

EXECUTIVE FINDING
EXP-005's 11/11 hidden-acceptance failures are scoring artifacts, not agent verification failures.
vitest.config.ts excludes the acceptance directory from all vitest invocations, so the scorer never executed hidden tests.
Seven acceptance files also contain incorrect ../../src import paths and fail at module load even with a corrected config.
Independent behavioral re-scoring at each agent's final commit: 11/11 pass hidden acceptance criteria.

CLASSIFICATION COUNTS
LEGITIMATE_MISS: 0/11
AMBIGUOUS_REQUIREMENT: 0/11
HIDDEN_REQUIREMENT: 0/11
EXPERIMENT_CONTAMINATION: 0/11
HARNESS_OR_SCORING_ERROR: 11/11

11-TASK CLASSIFICATION TABLE
taskId | taskClass | EXP-005 outcome | corrected hidden pass | classification | confidence
fail-alpha-context-stats | cross_module_feature | FAILURE/VERIFICATION_FAILURE | true | HARNESS_OR_SCORING_ERROR | HIGH
fail-beta-timeline-tiebreak | bug_misleading_symptom | FAILURE/VERIFICATION_FAILURE | true | HARNESS_OR_SCORING_ERROR | HIGH
fail-gamma-decode-helper | refactor_multi_module | FAILURE/VERIFICATION_FAILURE | true | HARNESS_OR_SCORING_ERROR | HIGH
fail-delta-report-generated-at | schema_contract_change | FAILURE/VERIFICATION_FAILURE | true | HARNESS_OR_SCORING_ERROR | HIGH
fail-epsilon-shared-median | refactor_multi_module | FAILURE/VERIFICATION_FAILURE | true | HARNESS_OR_SCORING_ERROR | HIGH
fail-zeta-min-incidents-flag | config_plus_app | FAILURE/VERIFICATION_FAILURE | true | HARNESS_OR_SCORING_ERROR | HIGH
fail-eta-condition-delta | partial_completion | FAILURE/VERIFICATION_FAILURE | true | HARNESS_OR_SCORING_ERROR | HIGH
fail-theta-import-extensions | implicit_convention | FAILURE/VERIFICATION_FAILURE | true | HARNESS_OR_SCORING_ERROR | HIGH
fail-iota-inspect-evidence-flag | docs_tests_alignment | FAILURE/VERIFICATION_FAILURE | true | HARNESS_OR_SCORING_ERROR | HIGH
fail-kappa-reduction-regression | regression_root_cause | FAILURE/VERIFICATION_FAILURE | true | HARNESS_OR_SCORING_ERROR | HIGH
fail-lambda-orphan-timeline-evidence | cross_module_miss | FAILURE/VERIFICATION_FAILURE | true | HARNESS_OR_SCORING_ERROR | HIGH

LEGITIMATE MISSES BY TASK CLASS
(none)

AGENT COMPLETION CLAIMS VS REPOSITORY TRUTH
Agents claiming tests passed: 11/11
Default suite passed at final commit: 11/11
Corrected hidden acceptance passed: 11/11
Legitimate miss with default-pass + hidden-fail: 0/11

CONTAMINATION / SCORING ISSUES
- vitest exclude misconfiguration (11/11)
- acceptance test import path defect (7/11 files)
- parallel /workspace branch contention (documented; did not prevent correct commits on seed branches except kappa branch name)

THREATS TO VALIDITY
- EXP-005 measured harness misconfiguration, not agent verification behavior.
- Hidden tests for alpha/iota/theta/zeta are weaker than full functional specs (CLI smoke / source regex).
- epsilon hidden test narrows export location beyond visible task wording (agent satisfied both).

RECOMMENDED NEXT EXPERIMENT
EXP-006: Re-run the frozen EXP-005 task set with a corrected scorer (dedicated vitest acceptance config, fixed import paths) and isolated per-task worktrees, without changing task prompts, to measure genuine verification-failure rates.

NO PRODUCT IMPLEMENTED
