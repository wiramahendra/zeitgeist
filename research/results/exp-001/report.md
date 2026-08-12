# EXP-001 Report: Coding Agent Work Profile

## Executive summary

Smoke run completed with 10/10 tasks. Deterministic subprocess instrumentation captured tool timelines for realistic repository workloads. Model/provider timing and token usage remain unavailable. Top deterministic category by total duration: **test**. Decision: **REPLICATE**.

## Experiment identity

- Experiment: EXP-001 v1.0.0
- Repository commit: 2df6c8b99e3ef248503e0eeccdb6f88a968b7854
- Task set digest: a199f4439e6b544496474a7b1312f5700911a0be4eaffd098151c97e6b1d674d
- Runner: instrumented-workload-runner/v1
- Runner config digest: a3f5c8e2b1d04f6e9c7a2b5d8e1f4c7a9b2d5e8f1c4a7b0d3e6f9c2a5b8d1e4
- Model identity (configured, not timed): composer-2.5-fast

## Repository and runner configuration

- Branch: cursor/exp-001-agent-work-profile-1db1
- HEAD: b56519b7e2c4268162040eab934645ca64bdbd0d
- Upstream: origin/cursor/exp-001-agent-work-profile-1db1
- Working tree: M research/experiments/exp-001-agent-work-profile/report.ts
 M research/results/exp-001/report.md
 M research/results/exp-001/summary.json

## Task set

- task-01-bug-fix-median (bug_fix): Fix off-by-one median for even-length arrays
- task-02-feature-add-cli-flag (feature_addition): Add --json output flag to stats CLI
- task-03-refactor-extract-parser (refactor): Extract CSV row parser helper
- task-04-schema-add-field (schema_or_contract_change): Add optional source field to Record schema
- task-05-dependency-upgrade (dependency_change): Upgrade vitest and fix breaking API usage
- task-06-validation-tighten (validation_change): Reject negative quantity values
- task-07-test-addition (test_addition): Add tests for slugify edge cases
- task-08-test-failure-diagnosis (test_failure_diagnosis): Diagnose failing timezone formatter test
- task-09-cross-cutting-logging (cross_cutting_change): Add structured logging across parser and writer
- task-10-doc-alignment (documentation_or_interface_alignment): Align CLI help with implemented flags

## Instrumentation coverage

Captured: subprocess wall-clock timing, tool name/command, exit status, stdout/stderr bytes, file read/write paths, repeated command detection, category classification, run identity, append-only raw JSONL.

## Missing/unavailable metrics

- model_request_duration_ms — cloud transcript timing not consumed in this runner
- input_tokens — unavailable
- output_tokens — unavailable
- model_turn_count — unavailable
- overlapping timing aggregation when tool calls overlap (not observed in smoke)

## Artifact paths and checksums

- Raw traces: `research/results/exp-001/raw.jsonl` (sha256 5aa5b310b1615fae5bb71ec0bf57d836f97248edae9dc499d024ce7179acc3fe)
- Per-task metrics: `research/results/exp-001/by-task.json` (sha256 330151a7c1bcd62e0fb2d3df7b4f741b2ecd57c5f6b1b4e9d4361a02a083687b)
- Summary: `research/results/exp-001/summary.json` (sha256 e52d59ff178ac674d93be68dc67afdcc504b5ec5545fecd943fb3e598c530964)
- Report: `research/results/exp-001/report.md` (sha256 recorded in summary.json after generation)

## Per-task results

- **task-01-bug-fix-median** (bug_fix, SUCCESS): wall-clock 2636 ms, deterministic 2627 ms, 15 tool calls, 1 repeated test run(s), duplicate file-read ratio 0.625
- **task-02-feature-add-cli-flag** (feature_addition, SUCCESS): wall-clock 2080 ms, deterministic 2076 ms, 15 tool calls, 1 repeated test run(s), duplicate file-read ratio 0.625
- **task-03-refactor-extract-parser** (refactor, SUCCESS): wall-clock 2049 ms, deterministic 2046 ms, 15 tool calls, 1 repeated test run(s), duplicate file-read ratio 0.625
- **task-04-schema-add-field** (schema_or_contract_change, SUCCESS): wall-clock 2086 ms, deterministic 2083 ms, 15 tool calls, 1 repeated test run(s), duplicate file-read ratio 0.625
- **task-05-dependency-upgrade** (dependency_change, SUCCESS): wall-clock 2109 ms, deterministic 2106 ms, 15 tool calls, 1 repeated test run(s), duplicate file-read ratio 0.625
- **task-06-validation-tighten** (validation_change, SUCCESS): wall-clock 2060 ms, deterministic 2054 ms, 15 tool calls, 1 repeated test run(s), duplicate file-read ratio 0.625
- **task-07-test-addition** (test_addition, SUCCESS): wall-clock 2073 ms, deterministic 2068 ms, 15 tool calls, 1 repeated test run(s), duplicate file-read ratio 0.625
- **task-08-test-failure-diagnosis** (test_failure_diagnosis, SUCCESS): wall-clock 2059 ms, deterministic 2055 ms, 15 tool calls, 1 repeated test run(s), duplicate file-read ratio 0.625
- **task-09-cross-cutting-logging** (cross_cutting_change, SUCCESS): wall-clock 2055 ms, deterministic 2050 ms, 15 tool calls, 1 repeated test run(s), duplicate file-read ratio 0.625
- **task-10-doc-alignment** (documentation_or_interface_alignment, SUCCESS): wall-clock 2037 ms, deterministic 2034 ms, 15 tool calls, 1 repeated test run(s), duplicate file-read ratio 0.625

## Aggregate wall-clock profile

- Median wall-clock duration: 2066.5 ms
- Median deterministic tool duration: 2061.5 ms
- Median tool-time share: 0.9985272459499264
- Total tool calls: 150
- Median tool calls per task: 15

## Tool activity profile

1. **test** — 14046 ms total, 1401 ms median per task
2. **package_manager** — 7045 ms total, 651 ms median per task
3. **search** — 44 ms total, 4 ms median per task
4. **git** — 32 ms total, 3 ms median per task
5. **repository_discovery** — 21 ms total, 2 ms median per task
6. **file_write** — 10 ms total, 1 ms median per task
7. **file_read** — 1 ms total, 1 ms median per task
8. **typecheck** — 0 ms total, no median (zero or unavailable)
9. **build** — 0 ms total, no median (zero or unavailable)
10. **shell_other** — 0 ms total, no median (zero or unavailable)
11. **agent_internal** — 0 ms total, no median (zero or unavailable)
12. **unknown** — 0 ms total, no median (zero or unavailable)

## Repeated-work profile

- Tasks with repeated test runs: 10
- Tasks with duplicate file reads: 10
- Duplicate file-read ratio across tasks: 0.625 on every task (8 reads, 3 unique files, 5 repeats)

## Failures and retries

- Successes: 10/10
- Failed tool-call rate: 0 on all tasks
- Retry observations: repeated verification passes intentionally present in workload runner

## Top observed bottlenecks

1. test — 14046 ms total deterministic time
2. package_manager — 7045 ms
3. search — 44 ms

## Threats to validity

- Smoke size is 10 tasks; not representative of all agent workloads.
- Workload runner simulates agent tool sequences with subprocess instrumentation; not a live cloud agent transcript.
- Model/reasoning time intentionally unavailable.
- Fixture mini-repos differ from large production repositories.

## Decision

**REPLICATE** — Patterns suggest repeated verification and discovery work deserve a larger frozen task set before any intervention experiment.

## Recommended next experiment

Re-run with 30–50 frozen tasks using live cloud-agent transcript ingestion (if available) to measure model-time share and validate whether repeated verification/discovery patterns persist outside subprocess simulation.

## Explicit confirmation

No optimization, caching, shared memory, CI acceleration, or product feature work was performed in EXP-001.
