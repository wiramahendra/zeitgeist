EXP-004 REPORT: REAL AGENT TIME ATTRIBUTION

DECISION: STRONG_SIGNAL

BRANCH: cursor/exp-004-time-attribution-1db1
HEAD: 66dd4ebde68b3888512ce80f4af46758070d8eca
FROZEN REPOSITORY COMMIT: db5a57b
MODEL: composer-2.5-fast
RUNNER: cloud-transcript-adapter/v1
ENVIRONMENT: C_WARM_WORKSPACE (full Zeitgeist repo, dependencies installed)

TASK SET (10)
real-alpha-scorer-tests test_addition Add scoreAgentResult unit tests
real-beta-timeline-tests test_addition Add sortTimeline unit tests
real-gamma-timeline-compare refactor Extract timeline compare helper
real-delta-canonical-edge test_addition Add canonical edge-case tests
real-epsilon-reduction-metrics test_addition Add reduction() unit tests
real-zeta-report-total feature_addition Add total runs to eval report markdown
real-eta-inspect-unique cross_cutting Show unique timeline evidence IDs in inspect
real-theta-budget-bytes bug_fix Show context byte size on inspect
real-iota-secret-message validation_change Clarify secret-key validation error
real-kappa-report-adjudication feature_addition Add adjudication counts to eval report

INSTRUMENTATION COVERAGE
Observable: tool sequence, per-tool duration, inter-tool gaps, category attribution, duplicate reads, repeated tests, failures
Unavailable: input/output tokens, model request latency, pre-first-tool and post-last-tool session time, package/network bytes

AGGREGATE TIME ATTRIBUTION (all runs)
Total wall-clock (first-to-last tool span): 306627ms
Total busy wall (parallel-batch spans): 115573ms (37.7% of wall)
Total deterministic tool activity: 121820ms (sum of tool durations; may exceed busy wall when tools run in parallel)
Total inter-batch gap time (observable wait between tool batches): 191054ms (62.3% of wall)
Total parallel overlap (tool activity minus busy wall): 6247ms
Total unattributed within span: 0ms (0.0% of wall)
Median wall per run: 27145.5ms
Median inter-batch gap per run: 16838ms
Parallel-batch accounting used: yes (all runs had same-turn parallel tool calls)

PRIMARY FINDING
Inter-batch gap time (observable wait between tool batches, not attributed to any tool category) is the largest wall-clock component at 62.3% aggregate share. This is reported separately from tool categories and is not classified as model reasoning. Deterministic tool activity (busy wall) is only 37.7% of wall-clock.

CATEGORY TOTALS
test: total=60558ms wallShare=0.197 toolShare=0.497
git: total=44615ms wallShare=0.146 toolShare=0.366
shell_other: total=5289ms wallShare=0.017 toolShare=0.043
search: total=4178ms wallShare=0.014 toolShare=0.034
file_read: total=4145ms wallShare=0.014 toolShare=0.034
unknown: total=3035ms wallShare=0.010 toolShare=0.025

PER-RUN RESULTS
real-alpha-scorer-tests test_addition SUCCESS wall=30657 busy=9804 tool=10316 gap=20853 overlap=512 unattributed=0 verify=5923 explore=736 top=test dupRead=0 repeatTest=0
real-beta-timeline-tests test_addition SUCCESS wall=16684 busy=7071 tool=7506 gap=9613 overlap=435 unattributed=0 verify=4612 explore=493 top=test dupRead=0 repeatTest=0
real-gamma-timeline-compare refactor SUCCESS wall=45215 busy=16670 tool=17394 gap=28545 overlap=724 unattributed=0 verify=7889 explore=1089 top=git dupRead=0.1111111111111111 repeatTest=0
real-delta-canonical-edge test_addition SUCCESS wall=23785 busy=8973 tool=9180 gap=14812 overlap=207 unattributed=0 verify=6101 explore=402 top=test dupRead=0 repeatTest=0
real-epsilon-reduction-metrics test_addition SUCCESS wall=13714 busy=7711 tool=8184 gap=6003 overlap=473 unattributed=0 verify=6052 explore=508 top=test dupRead=0 repeatTest=0
real-zeta-report-total feature_addition SUCCESS wall=26673 busy=10797 tool=11350 gap=15876 overlap=553 unattributed=0 verify=6060 explore=713 top=test dupRead=0 repeatTest=0
real-eta-inspect-unique cross_cutting SUCCESS wall=27618 busy=9818 tool=10655 gap=17800 overlap=837 unattributed=0 verify=6314 explore=1050 top=test dupRead=0 repeatTest=0
real-theta-budget-bytes bug_fix SUCCESS wall=46445 busy=14024 tool=15403 gap=32421 overlap=1379 unattributed=0 verify=5124 explore=1682 top=shell_other dupRead=0 repeatTest=0
real-iota-secret-message validation_change SUCCESS wall=21820 busy=9285 tool=9820 gap=12535 overlap=535 unattributed=0 verify=6611 explore=674 top=test dupRead=0 repeatTest=0
real-kappa-report-adjudication feature_addition SUCCESS wall=54016 busy=21420 tool=22012 gap=32596 overlap=592 unattributed=0 verify=5872 explore=976 top=git dupRead=0.3333333333333333 repeatTest=0

RECURRING EXTERNALLY-REMOVABLE PATTERNS (>=5/10 runs, >=3 classes)
package_environment: runs=10 classes=test_addition,refactor,feature_addition,cross_cutting,bug_fix,validation_change medianWallShare=0.1129605009867776 medianToolShare=0.2891588689832448
exploration_overhead: runs=10 classes=test_addition,refactor,feature_addition,cross_cutting,bug_fix,validation_change medianWallShare=0.028140210056021547 medianToolShare=0.06425008598114167

FAILURES RETRIES REPEATED WORK
Successes: 10/10
Runs with failed tools: 0
Runs with duplicate reads: 2
Runs with repeated tests: 0

THREATS TO VALIDITY
Ten live runs on one repo commit; parallel agents may differ in micro-environment
Transcript wall-clock excludes time before first tool and after last tool
Category attribution depends on command-string heuristics
C_WARM_WORKSPACE removes cold-install confound but agents may still invoke package commands

ARTIFACTS
research/results/exp-004/raw.jsonl sha256 8a41ddb9cc744c8af6e07395e4b952ca9179f5501078f2e63a7afab75e6946d4
research/results/exp-004/summary.json
research/results/exp-004/report.md
research/results/exp-004/run-manifest.json

NO OPTIMIZATION IMPLEMENTED

RECOMMENDED NEXT EXPERIMENT
Run EXP-004b with explicit model-turn boundary timestamps to determine how much of the 62% inter-batch gap is model latency versus agent scheduling overhead. The git/package_environment STRONG_SIGNAL (29% tool-activity share) is secondary to gap-dominated wall-clock.
