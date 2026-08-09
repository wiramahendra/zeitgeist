# EXP-002 Report: Live Coding-Agent Trace Validation

## Executive summary

Live cloud-agent transcripts were ingested for 5/5 frozen tasks. The agent solved tasks naturally without a prescribed tool sequence. Decision: **STRONG_SIGNAL**.

## Experiment identity

- Experiment: EXP-002 v1.0.0
- Repository commit: 36bd1b0b62a43a6827f6e29979fea3d5034658c3
- Task set digest: 3629fd5566135dd8a13e597d8099a1845e435f11d6aaae5ee1d0889d2e6d5d5d
- Runner: cloud-transcript-adapter/v1
- Model identity: composer-2.5-fast
- Branch: cursor/exp-002-live-trace-validation-1db1
- HEAD: 36bd1b0b62a43a6827f6e29979fea3d5034658c3

## Five frozen tasks

- live-alpha-ratio (bug_fix): Fix zero denominator crash in computeRatio
- live-beta-label (feature_addition): Implement formatLabel helper
- live-gamma-parser (refactor): Extract parseLine helper
- live-delta-slug (test_addition): Add slugify edge-case tests
- live-epsilon-name (validation_change): Reject whitespace-only names

## Instrumentation changes

Added `research/harness/CloudTranscriptAdapter.ts` — minimum adapter from native `transcript.json` tool-call messages into existing RawAgentRun / metrics pipeline. No simulated workload runner used.

## Available telemetry

- Native tool sequence, per-tool duration, command/path args (when present), exit status, stdout bytes (terminal commands), file read/write paths, model turn count (user messages), wall-clock span from first to last tool call.

## Unavailable telemetry

- Input tokens, output tokens, model request latency — not exposed in cloud transcript schema; recorded as unavailable.

## Per-run results

- **live-alpha-ratio** (bug_fix, SUCCESS): wall-clock 9238 ms, deterministic 4373 ms, 9 tool calls, top category package_manager (2598 ms), duplicate read ratio 0, repeated tests 0
- **live-beta-label** (feature_addition, SUCCESS): wall-clock 8468 ms, deterministic 4112 ms, 9 tool calls, top category package_manager (2410 ms), duplicate read ratio 0, repeated tests 0
- **live-gamma-parser** (refactor, SUCCESS): wall-clock 12249 ms, deterministic 4249 ms, 9 tool calls, top category package_manager (2494 ms), duplicate read ratio 0, repeated tests 0
- **live-delta-slug** (test_addition, SUCCESS): wall-clock 10544 ms, deterministic 4243 ms, 9 tool calls, top category package_manager (2536 ms), duplicate read ratio 0, repeated tests 0
- **live-epsilon-name** (validation_change, SUCCESS): wall-clock 8630 ms, deterministic 4267 ms, 9 tool calls, top category package_manager (2498 ms), duplicate read ratio 0, repeated tests 0

## Aggregate tool breakdown

1. **package_manager** — 12536 ms total, 2498 ms median per run
2. **git** — 6363 ms total, 1253 ms median per run
3. **file_read** — 985 ms total, 182 ms median per run
4. **search** — 702 ms total, 157 ms median per run
5. **unknown** — 658 ms total, 131 ms median per run
6. **repository_discovery** — 0 ms total
7. **file_write** — 0 ms total
8. **test** — 0 ms total
9. **typecheck** — 0 ms total
10. **build** — 0 ms total
11. **shell_other** — 0 ms total
12. **agent_internal** — 0 ms total

- Median wall-clock: 9238 ms
- Median deterministic tool time: 4249 ms
- Total tool calls: 45

## Repeated-work findings

- Runs with duplicate file reads: 0
- Runs with repeated test commands: 0
- Runs with repeated searches: 0

## Failures and retries

- Successes: 5/5
- Failed tool calls observed in: none

## Patterns meeting preregistered threshold (>=20% wall-clock OR >=25% tool activity, >=3/5 runs, >=2 task classes)

- **package_manager**: wall-clock share 25.5%, tool-activity share 59.0%, observed in 5/5 runs across classes bug_fix, feature_addition, refactor, test_addition, validation_change
- **git**: wall-clock share 13.0%, tool-activity share 30.0%, observed in 5/5 runs across classes bug_fix, feature_addition, refactor, test_addition, validation_change

## Top observed categories

1. package_manager — 12536 ms
2. git — 6363 ms
3. file_read — 985 ms

## Threats to validity

- Five runs is a small sample.
- Separate agent sessions may differ in environment warmth (e.g. cached dependencies).
- Transcript omits model latency and tokens.
- Task difficulty varies; not all task classes may trigger the same tool profile.

## Decision

**STRONG_SIGNAL**

## Artifact paths and checksums

- Raw traces: `research/results/exp-002/raw.jsonl` (sha256 9945affa1c98fd09feb9479bee9260918bb8b04bb3d4b900a4ac1e631add83ab)
- Summary: `research/results/exp-002/summary.json`
- Report: `research/results/exp-002/report.md`

## Explicit confirmation

No optimization, caching, shared memory, CI acceleration, dashboard, MCP server, or product feature was implemented.

## Recommended next experiment

If decision is REPLICATE or STRONG_SIGNAL: run 15–20 live-agent tasks with transcript ingestion and compare category shares across repository sizes; still no intervention.
