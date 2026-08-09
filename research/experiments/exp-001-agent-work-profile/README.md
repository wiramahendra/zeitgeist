# EXP-001: Coding Agent Work Profile

Observational smoke experiment measuring where deterministic tool work accumulates during realistic repository tasks.

## Question

What are the dominant sources of wall-clock time, tool activity, repeated work, and deterministic-compute overhead when a coding agent executes realistic repository tasks?

## Runner

This experiment uses the `instrumented-workload-runner/v1`, which executes frozen task workloads with subprocess-level instrumentation. Cloud agent transcript and model/provider timing are recorded as unavailable rather than estimated.

## Commands

```text
pnpm research:exp-001
pnpm research:exp-001:report
```

## Outputs

- `research/results/exp-001/raw.jsonl`
- `research/results/exp-001/summary.json`
- `research/results/exp-001/by-task.json`
- `research/results/exp-001/report.md`

## Stop conditions

This experiment stops after the 10-task smoke and aggregate report. It does not authorize optimization or EXP-002.
