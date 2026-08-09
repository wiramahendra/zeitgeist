EXP-004b REPORT: INTER-BATCH GAP ATTRIBUTION

DECISION: INVALID

BRANCH: cursor/exp-004b-inter-batch-gap-1db1
HEAD: f585d8371a4411d60f0de75343b49982e830a50e
PARENT EXPERIMENT: EXP-004
FROZEN REPOSITORY COMMIT: db5a57b
MODEL: composer-2.5-fast
RUNNER: gap-attribution/v1 (reuses EXP-004 transcripts)
ENVIRONMENT: C_WARM_WORKSPACE

EXPERIMENT IDENTITY
Experiment: EXP-004b v1.0.0
New live runs performed: 0 (telemetry audit showed identical schema across all 10 EXP-004 transcripts; re-analysis only)
Source transcripts: research/results/exp-004/transcripts/*.json
Cloud run events: empty for sampled EXP-004 bcIds (bc-67372411, bc-e4cf0f9e)

TELEMETRY CAPABILITY AUDIT
assistant.tool_calls.started_at_ms: available=true causal=true — Defines tool batch start boundary.
assistant.tool_calls.completed_at_ms: available=true causal=true — Defines tool batch end boundary.
tool.started_at_ms / tool.completed_at_ms: available=true causal=true — Tool result timestamps; in EXP-004 runs always equal call completion (no post-batch result lag).
assistant.text / assistant.thinking: available=true causal=false — Present between batches but carry no timestamps; cannot bound model or deliberation time.
user.text: available=true causal=false — No timestamps on user messages.
model_request_duration_ms / token counts: available=false causal=false — Not exported in native cloud transcript.json.
Cloud events API per-run events: unavailable for gap decomposition (count=0 on fetched EXP-004 agents)
Directly attributable gap categories supported by schema: tool_result_context_processing (only when tool result completed_at_ms exceeds batch end; observed 0ms in all 10 runs), other_observable_runtime (none observed)
Cannot attribute without inferring: model_provider_latency, agent_model_processing, harness_scheduling

RUNS PERFORMED
real-alpha-scorer-tests test_addition
real-beta-timeline-tests test_addition
real-gamma-timeline-compare refactor
real-delta-canonical-edge test_addition
real-epsilon-reduction-metrics test_addition
real-zeta-report-total feature_addition
real-eta-inspect-unique cross_cutting
real-theta-budget-bytes bug_fix
real-iota-secret-message validation_change
real-kappa-report-adjudication feature_addition
Successes: 10/10

TOTAL GAP TIME
Total inter-batch gap (all runs): 191054ms
EXP-004 aggregate inter-batch gap reference: 191054ms (62.3% of EXP-004 wall-clock)
Median inter-batch gap per run: 16838ms

ATTRIBUTED VS UNATTRIBUTED
Total directly attributable gap time: 0ms (0.0%)
Total UNATTRIBUTED gap time: 191054ms (100.0%)
Attribution threshold for valid experiment: >=80% directly attributable

PER-CATEGORY ATTRIBUTION (aggregate)
model_provider_latency: total=0ms share=0.0000 medianRunShare=0
agent_model_processing: total=0ms share=0.0000 medianRunShare=0
harness_scheduling: total=0ms share=0.0000 medianRunShare=0
tool_result_context_processing: total=0ms share=0.0000 medianRunShare=0
other_observable_runtime: total=0ms share=0.0000 medianRunShare=0
UNATTRIBUTED: total=191054ms share=1.0000 medianRunShare=1

PER-RUN ATTRIBUTION
real-alpha-scorer-tests test_addition gapMs=20853 gapCount=8 attributableShare=0.000 UNATTRIBUTED=20853 toolResultProcessing=0 exp004Gap=20853
real-beta-timeline-tests test_addition gapMs=9613 gapCount=6 attributableShare=0.000 UNATTRIBUTED=9613 toolResultProcessing=0 exp004Gap=9613
real-gamma-timeline-compare refactor gapMs=28545 gapCount=14 attributableShare=0.000 UNATTRIBUTED=28545 toolResultProcessing=0 exp004Gap=28545
real-delta-canonical-edge test_addition gapMs=14812 gapCount=10 attributableShare=0.000 UNATTRIBUTED=14812 toolResultProcessing=0 exp004Gap=14812
real-epsilon-reduction-metrics test_addition gapMs=6003 gapCount=4 attributableShare=0.000 UNATTRIBUTED=6003 toolResultProcessing=0 exp004Gap=6003
real-zeta-report-total feature_addition gapMs=15876 gapCount=10 attributableShare=0.000 UNATTRIBUTED=15876 toolResultProcessing=0 exp004Gap=15876
real-eta-inspect-unique cross_cutting gapMs=17800 gapCount=14 attributableShare=0.000 UNATTRIBUTED=17800 toolResultProcessing=0 exp004Gap=17800
real-theta-budget-bytes bug_fix gapMs=32421 gapCount=17 attributableShare=0.000 UNATTRIBUTED=32421 toolResultProcessing=0 exp004Gap=32421
real-iota-secret-message validation_change gapMs=12535 gapCount=8 attributableShare=0.000 UNATTRIBUTED=12535 toolResultProcessing=0 exp004Gap=12535
real-kappa-report-adjudication feature_addition gapMs=32596 gapCount=17 attributableShare=0.000 UNATTRIBUTED=32596 toolResultProcessing=0 exp004Gap=32596

VARIANCE BY TASK CLASS
test_addition: runs=4 gapMs=51281 unattributedMs=51281 unattributedShare=1.000
refactor: runs=1 gapMs=28545 unattributedMs=28545 unattributedShare=1.000
feature_addition: runs=2 gapMs=48472 unattributedMs=48472 unattributedShare=1.000
cross_cutting: runs=1 gapMs=17800 unattributedMs=17800 unattributedShare=1.000
bug_fix: runs=1 gapMs=32421 unattributedMs=32421 unattributedShare=1.000
validation_change: runs=1 gapMs=12535 unattributedMs=12535 unattributedShare=1.000

DOMINANT RECURRING CAUSE
None proven — no attributable category reached >=50% median share across >=3 task classes.

THREATS TO VALIDITY
Re-analysis of EXP-004 transcripts only; no new instrumentation timestamps added between EXP-004 and EXP-004b
Transcript wall-clock span excludes pre-first-tool and post-last-tool session time
Assistant thinking/text exists between batches but lacks timestamps; presence of text must not be treated as evidence of deliberation duration
Cloud run events may exist for other agents but were empty for audited EXP-004 bcIds
Parallel tool batches collapse to batch boundaries; intra-gap sub-phases are unobservable

ARTIFACTS / CHECKSUMS
research/results/exp-004b/raw.jsonl sha256 1007988199de150344bc00a112b0c631e2913f61e076d2930f2fc103215c7db2
research/results/exp-004b/summary.json
research/results/exp-004b/report.md
research/results/exp-004b/run-manifest.json
research/results/exp-004b/transcript-checksums.sha256
research/results/exp-004b/event-checksums.sha256

NO OPTIMIZATION IMPLEMENTED

RECOMMENDED NEXT EXPERIMENT
EXP-005 (instrumentation): add native per-turn timestamps to cloud transcript export — model request start/end, assistant message emission, and harness scheduling markers — then re-run inter-batch gap attribution on 5–10 live C_WARM_WORKSPACE sessions. Without those timestamps, gap cause decomposition cannot exceed INVALID.
