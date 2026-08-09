EXP-003 REPORT: ENVIRONMENT WARMTH / SETUP TAX

DECISION: REPLICATE

BRANCH: cursor/exp-003-environment-warmth-1db1
HEAD: f1900fcef82499ac2dc59d80cdf9549d25e74192
MODEL: composer-2.5-fast
RUNNER: cloud-transcript-adapter/v1

HYPOTHESIS H0: In C_WARM_WORKSPACE, environment/bootstrap overhead is below 10% of wall-clock.

CONDITION DEFINITIONS
A_COLD: Fresh workspace copy, no node_modules, no workspace-level dependency install before agent start.
B_WARM_PACKAGE: Fresh workspace copy, no node_modules, global pnpm store pre-warmed via seed install of same fixture (experiment prep only, not agent-directed).
C_WARM_WORKSPACE: Workspace copy with pnpm install --ignore-workspace completed before agent start (node_modules present).

FROZEN TASKS (6)
warm-alpha-ratio bug_fix
warm-beta-label feature_addition
warm-gamma-parser refactor
warm-delta-slug test_addition
warm-epsilon-name validation_change
warm-zeta-record schema_or_contract_change

COUNTERBALANCE: Condition order rotated by task index (Latin-style offsets in Exp003Conditions.ts).

MEDIAN BY CONDITION
A_COLD: n=6 medianWall=46364 medianPkg=8100 medianBootstrap=11185 medianBootstrapShare=0.25256298868480237
B_WARM_PACKAGE: n=6 medianWall=51001 medianPkg=7868 medianBootstrap=10956.5 medianBootstrapShare=0.19935694746723737
C_WARM_WORKSPACE: n=6 medianWall=52430.5 medianPkg=3002.5 medianBootstrap=6225.5 medianBootstrapShare=0.11943780491380876

PER-RUN RESULTS
warm-alpha-ratio A_COLD SUCCESS wall=35443 pkg=7169 bootstrap=9107 firstEdit=n/a
warm-alpha-ratio B_WARM_PACKAGE SUCCESS wall=44888 pkg=5896 bootstrap=7517 firstEdit=n/a
warm-alpha-ratio C_WARM_WORKSPACE SUCCESS wall=51054 pkg=0 bootstrap=3488 firstEdit=n/a
warm-beta-label B_WARM_PACKAGE SUCCESS wall=39056 pkg=6001 bootstrap=8099 firstEdit=n/a
warm-beta-label C_WARM_WORKSPACE SUCCESS wall=44419 pkg=0 bootstrap=3730 firstEdit=n/a
warm-beta-label A_COLD SUCCESS wall=24345 pkg=6066 bootstrap=9476 firstEdit=n/a
warm-gamma-parser C_WARM_WORKSPACE SUCCESS wall=45708 pkg=4121 bootstrap=7256 firstEdit=n/a
warm-gamma-parser A_COLD SUCCESS wall=34832 pkg=8513 bootstrap=10612 firstEdit=n/a
warm-gamma-parser B_WARM_PACKAGE SUCCESS wall=57770 pkg=7960 bootstrap=11054 firstEdit=n/a
warm-delta-slug A_COLD SUCCESS wall=57285 pkg=9620 bootstrap=12527 firstEdit=n/a
warm-delta-slug C_WARM_WORKSPACE SUCCESS wall=53807 pkg=1884 bootstrap=5195 firstEdit=n/a
warm-delta-slug B_WARM_PACKAGE SUCCESS wall=42525 pkg=7776 bootstrap=10859 firstEdit=n/a
warm-epsilon-name B_WARM_PACKAGE SUCCESS wall=57114 pkg=8140 bootstrap=16404 firstEdit=n/a
warm-epsilon-name A_COLD SUCCESS wall=75813 pkg=8153 bootstrap=11758 firstEdit=n/a
warm-epsilon-name C_WARM_WORKSPACE SUCCESS wall=60980 pkg=5953 bootstrap=9281 firstEdit=n/a
warm-zeta-record C_WARM_WORKSPACE SUCCESS wall=73542 pkg=7757 bootstrap=10467 firstEdit=n/a
warm-zeta-record B_WARM_PACKAGE SUCCESS wall=86089 pkg=11235 bootstrap=14222 firstEdit=n/a
warm-zeta-record A_COLD SUCCESS wall=62850 pkg=8047 bootstrap=15598 firstEdit=n/a

EXP-002 PACKAGE_MANAGER SIGNAL IN C_WARM_WORKSPACE
yes — package/setup share remains material in C_WARM_WORKSPACE

UNAVAILABLE
package/network bytes — not exposed in transcript
model tokens and model latency — not in transcript

THREATS TO VALIDITY
VM-global pnpm store may warm A_COLD relative to truly cold network install
Six tasks, eighteen runs, mini-fixtures only
Bootstrap proxy = package_manager + git category time

ARTIFACTS
research/results/exp-003/raw.jsonl sha256 9676a3e874f97149d47bf929e44b50afc33cf8f8d45786de5623d406af087da5
research/results/exp-003/summary.json
research/results/exp-003/report.md

NO OPTIMIZATION IMPLEMENTED

RECOMMENDED NEXT EXPERIMENT
If KILL_BRANCH: re-run EXP-001/002 style workload profiling on a warm monorepo checkpoint to find the next bottleneck (likely file_read/search or verification, not setup).
If STRONG_SIGNAL: replicate on full zeitgeist repo workspace at C_WARM_WORKSPACE with 10+ tasks before any setup intervention research.
