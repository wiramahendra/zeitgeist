# EXP-002: Live Coding-Agent Trace Validation

Observes a real coding agent solving frozen tasks naturally, ingesting native cloud-agent transcripts into existing Zeitgeist metrics.

## Commands

```text
pnpm research:exp-002:ingest <run-manifest.json>
pnpm research:exp-002:report
```

Each live run is executed as a separate cloud agent session. Record bcId and transcript path in the run manifest before ingestion.
