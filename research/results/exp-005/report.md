EXP-005 REPORT: AGENT FAILURE SURFACE

DECISION: STRONG_SIGNAL

BRANCH: 
HEAD: 171adc44d953cf6a1d29494f40cdfd9a19362acf
MODEL: composer-2.5-fast
ENVIRONMENT: C_WARM_WORKSPACE

EXPERIMENT IDENTITY
Experiment: EXP-005 v1.0.0
Frozen task set: research/workloads/task-set-exp005-v1.json
Ground truth: research/experiments/exp-005-agent-failure-surface/ground-truth/
Scorer: failure-surface-scorer/v1

TASK MATRIX
fail-alpha-context-stats cross_module_feature Add context stats CLI subcommand
fail-beta-timeline-tiebreak bug_misleading_symptom Fix timeline ordering for equal timestamps
fail-gamma-decode-helper refactor_multi_module Extract shared persisted decode helper
fail-delta-report-generated-at schema_contract_change Add generatedAt to evaluation report schema
fail-epsilon-shared-median refactor_multi_module Consolidate duplicate median implementations
fail-zeta-min-incidents-flag config_plus_app Add eval report minimum-incidents CLI flag
fail-eta-condition-delta partial_completion Complete condition delta summary helper
fail-theta-import-extensions implicit_convention Fix ESM import paths in dataset loader
fail-iota-inspect-evidence-flag docs_tests_alignment Align context inspect CLI with documented evidence flag
fail-kappa-reduction-regression regression_root_cause Fix failing reduction metric tests
fail-lambda-orphan-timeline-evidence cross_module_miss Reject orphan timeline evidence references

GROUND-TRUTH METHODOLOGY
Acceptance criteria frozen per task in ground-truth JSON.
Hidden checks: test/research/exp-005-acceptance/<taskId>.test.ts (not referenced in agent prompts).
Full verification: pnpm test && pnpm typecheck on agent final commit.
Repository state scored via git checkout of agent-reported commit hash.

OUTCOME RATES
Success: 0/11 (0.0%)
Partial: 0/11 (0.0%)
Failure: 11/11 (100.0%)
Claim disagreement rate: 0.0%

PER-TASK OUTCOMES
fail-alpha-context-stats cross_module_feature FAILURE claimDisagree=false repair=medium primary=VERIFICATION_FAILURE tools=79 wall=139284
fail-beta-timeline-tiebreak bug_misleading_symptom FAILURE claimDisagree=false repair=medium primary=VERIFICATION_FAILURE tools=31 wall=98904
fail-gamma-decode-helper refactor_multi_module FAILURE claimDisagree=false repair=medium primary=VERIFICATION_FAILURE tools=87 wall=163499
fail-delta-report-generated-at schema_contract_change FAILURE claimDisagree=false repair=medium primary=VERIFICATION_FAILURE tools=98 wall=181614
fail-epsilon-shared-median refactor_multi_module FAILURE claimDisagree=false repair=medium primary=VERIFICATION_FAILURE tools=45 wall=99223
fail-zeta-min-incidents-flag config_plus_app FAILURE claimDisagree=false repair=medium primary=VERIFICATION_FAILURE tools=45 wall=73279
fail-eta-condition-delta partial_completion FAILURE claimDisagree=false repair=medium primary=VERIFICATION_FAILURE tools=80 wall=163895
fail-theta-import-extensions implicit_convention FAILURE claimDisagree=false repair=medium primary=VERIFICATION_FAILURE tools=30 wall=104797
fail-iota-inspect-evidence-flag docs_tests_alignment FAILURE claimDisagree=false repair=medium primary=VERIFICATION_FAILURE tools=61 wall=154611
fail-kappa-reduction-regression regression_root_cause FAILURE claimDisagree=false repair=medium primary=VERIFICATION_FAILURE tools=27 wall=54737
fail-lambda-orphan-timeline-evidence cross_module_miss FAILURE claimDisagree=false repair=medium primary=VERIFICATION_FAILURE tools=63 wall=151457

FAILURE TAXONOMY COUNTS
VERIFICATION_FAILURE: 11

RECURRING FAILURE PATTERNS (>=3 runs)
VERIFICATION_FAILURE: runs=11 rate=1.00 classes=cross_module_feature,bug_misleading_symptom,refactor_multi_module,schema_contract_change,config_plus_app,partial_completion,implicit_convention,docs_tests_alignment,regression_root_cause,cross_module_miss extAddressable=11

EXTERNALLY-ADDRESSABLE VS MODEL-NATIVE
Externally-addressable classes: CONTEXT_DISCOVERY_FAILURE, VERIFICATION_FAILURE, STATE_CONTINUITY_FAILURE, SCOPE_VIOLATION, CROSS_MODULE_MISS
Model-native examples: WRONG_ASSUMPTION, INCOMPLETE_CHANGE when acceptance logic passes but design is wrong

THREATS TO VALIDITY
Eleven realistic multi-module tasks on one monorepo; branch-per-task seeds reduce cross-task interference.
Scoring depends on agent-reported commit hashes when worktrees unavailable.
Hidden acceptance tests exist in repository; discovery is part of agent behavior.
Parallel agents may share push contention on shared infrastructure.

ARTIFACTS
research/results/exp-005/raw.jsonl sha256 794d1e553e1eef437164dde1751fb454bd4869319ca42cbbb7f59f34294d54b2
research/results/exp-005/by-task.json
research/results/exp-005/summary.json
research/results/exp-005/report.md
research/results/exp-005/run-manifest.json
research/results/exp-005/transcript-checksums.sha256

NO PRODUCT IMPLEMENTED

RECOMMENDED NEXT EXPERIMENT
EXP-006: pick the highest-frequency externally-addressable failure class from this run (if STRONG_SIGNAL or WEAK_SIGNAL) and attempt to falsify it with a controlled replication — not a product fix.
