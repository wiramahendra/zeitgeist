# Zeitgeist Research Laboratory

This directory contains observational experiments studying the engineering physics of coding agents. It is isolated from Gate 0 product-direction work under `src/`.

## Principles

1. Measure before optimizing.
2. Do not modify agent behavior to manufacture bottlenecks.
3. Preserve raw evidence before producing summaries.
4. Record unavailable metrics rather than estimating them.

## Layout

- `harness/` — Reusable instrumentation for agent run collection and normalization.
- `workloads/` — Task definitions and frozen task sets.
- `experiments/` — Per-experiment runners, configs, and report generators.
- `results/` — Append-only raw traces and deterministic aggregate outputs.

## Running EXP-001

```text
pnpm research:exp-001
pnpm research:exp-001:report
```

See `experiments/exp-001-agent-work-profile/README.md` for experiment-specific details.
