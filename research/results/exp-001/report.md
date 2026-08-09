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
- HEAD: 2df6c8b99e3ef248503e0eeccdb6f88a968b7854
- Upstream: none
- Working tree: M .gitignore
 M package.json
 M tsconfig.json
?? research/
?? test/research/
?? vitest.config.ts

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

## Per-task results

| taskId | class | status | wallMs | deterministicMs | toolCalls | repeatedTests | duplicateReadRatio |
|---|---|---|---:|---:|---:|---:|---:|
| task-01-bug-fix-median | bug_fix | SUCCESS | 2636 | 2627 | 15 | 1 | 0.625 |
| task-02-feature-add-cli-flag | feature_addition | SUCCESS | 2080 | 2076 | 15 | 1 | 0.625 |
| task-03-refactor-extract-parser | refactor | SUCCESS | 2049 | 2046 | 15 | 1 | 0.625 |
| task-04-schema-add-field | schema_or_contract_change | SUCCESS | 2086 | 2083 | 15 | 1 | 0.625 |
| task-05-dependency-upgrade | dependency_change | SUCCESS | 2109 | 2106 | 15 | 1 | 0.625 |
| task-06-validation-tighten | validation_change | SUCCESS | 2060 | 2054 | 15 | 1 | 0.625 |
| task-07-test-addition | test_addition | SUCCESS | 2073 | 2068 | 15 | 1 | 0.625 |
| task-08-test-failure-diagnosis | test_failure_diagnosis | SUCCESS | 2059 | 2055 | 15 | 1 | 0.625 |
| task-09-cross-cutting-logging | cross_cutting_change | SUCCESS | 2055 | 2050 | 15 | 1 | 0.625 |
| task-10-doc-alignment | documentation_or_interface_alignment | SUCCESS | 2037 | 2034 | 15 | 1 | 0.625 |

## Aggregate wall-clock profile

- Median wall-clock duration: 2066.5 ms
- Median deterministic tool duration: 2061.5 ms
- Median tool-time share: 0.9985272459499264

## Tool activity profile

| category | totalMs | medianMs |
|---|---:|---:|
| test | 14046 | 1401 |
| package_manager | 7045 | 651 |
| search | 44 | 4 |
| git | 32 | 3 |
| repository_discovery | 21 | 2 |
| file_write | 10 | 1 |
| file_read | 1 | 1 |
| typecheck | 0 | n/a |
| build | 0 | n/a |
| shell_other | 0 | n/a |
| agent_internal | 0 | n/a |
| unknown | 0 | n/a |

- Total tool calls: 150
- Median tool calls per task: 15

## Repeated-work profile

- Tasks with repeated test runs: 10
- Tasks with duplicate file reads: 10
- Median duplicate file-read ratio: see per-task

## Failures and retries

- Successes: 10/10
- Failed tool-call rate (per task): see by-task.json
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
