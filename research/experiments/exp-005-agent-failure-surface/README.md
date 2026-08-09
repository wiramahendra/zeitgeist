# EXP-005: Agent Failure Surface

Observational study of recurring failure modes when Composer 2.5 Fast agents perform realistic multi-module engineering tasks on the warm Zeitgeist monorepo.

## Workflow

1. Freeze scaffold commit on `cursor/exp-005-agent-failure-surface-1db1`
2. `pnpm research:exp-005:prepare` — create per-task seed branches
3. Launch one live cloud agent per task on its seed branch (C_WARM_WORKSPACE)
4. Record bcId, transcript path, and final commit hash in `research/results/exp-005/run-manifest.json`
5. `pnpm research:exp-005:ingest research/results/exp-005/run-manifest.json`
6. `pnpm research:exp-005:report`

## Agent prompt template

```text
EXP-005 live run. Branch: <seedBranch>
Environment: C_WARM_WORKSPACE — full Zeitgeist monorepo, dependencies installed.
Work in /workspace.

<task description from task-set-exp005-v1.json>

Rules: Work naturally. Do not ask for help after starting. Run pnpm test and pnpm typecheck before finishing.
Commit: exp-005: <taskId>
Push to origin.

Return: tests passed yes/no, commit hash, brief summary.
```

## Scoring

Repository truth only. Hidden acceptance: `test/research/exp-005-acceptance/<taskId>.test.ts`.
