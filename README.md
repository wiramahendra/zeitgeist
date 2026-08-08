# Zeitgeist

Zeitgeist is Gate 0 experimental software, not yet a product. The research question comes first: does a preassembled, bounded, structured, provenance-preserving incident context materially improve production incident investigation by a strong AI engineering agent?

The initial hypothesis is falsifiable. A manually curated `context.json` must reduce median external tool calls by at least 50% and time to a correct hypothesis by at least 40%, without reducing diagnostic accuracy or increasing false high-confidence hypotheses. If it does not, the project stops before collectors or an automated context compiler are built.

Zeitgeist gives engineering agents the production context they need to investigate incidents. In Gate 0A that context is manually assembled and uses sanitized historical data only.

Node.js 24 LTS is the preferred runtime (`.node-version`). The implementation remains compatible with ordinary supported Node.js APIs and does not use runtime-proprietary features.

## Truth model

- An observed fact is obtained directly from deterministic source evidence.
- A derived relationship is established from explicit identifiers or metadata.
- A hypothesis requires reasoning. Zeitgeist does not generate hypotheses; the external agent does.

Temporal proximity is not causation. Every factual context item references preserved source evidence. `context.json` has no hypothesis or root-cause field.

## Dataset

Each incident directory contains:

- `incident.json`: incident signal and scope.
- `evidence.json`: source evidence with stable IDs and provenance.
- `context.json`: manually curated Incident Context for the treatment condition.
- `expected.json`: deterministic and human-adjudicable scoring targets.

Persisted inputs reject unknown fields and unknown schema versions. Context defaults to a 25 KiB canonical JSON budget. Obvious secret-bearing field names are rejected as a narrow guardrail; this is not generic secret detection. Synthetic fixtures are labeled `SYNTHETIC_TEST_ONLY` and never count as research incidents.

## Commands

```text
pnpm zeitgeist dataset validate <dataset-dir>
pnpm zeitgeist context validate <context.json> --evidence <evidence.json>
pnpm zeitgeist context inspect <context.json>
pnpm zeitgeist eval run <dataset-dir> --runner <executable> --output <results.jsonl>
pnpm zeitgeist eval report <results.jsonl> --output-dir <dir>
```

The external runner is provider-neutral. It receives JSON on standard input and must return a structured JSON result on standard output. It is executed directly without a shell and is subject to an explicit timeout. Control receives incident and evidence material without `context`; manual context receives the same material plus validated `context`.

Results are append-only JSONL with deterministic run identities. Reports remain `INCOMPLETE` when paired conditions, at least ten real incidents, adjudication, or required metrics are missing. Missing optional runner metrics are unavailable, never coerced to zero.

## Deliberate boundary

There is no live collection, automatic Incident Context Compiler, LLM provider SDK, server, database, graph, web UI, MCP server, remediation, or production mutation path. Gate 0B may collect and run at least ten real sanitized historical incidents. Automated compilation remains unauthorized until manual ideal context passes the preregistered gate.
