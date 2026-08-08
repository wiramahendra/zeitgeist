# Gate 0: research and falsification

## Research question

Does preassembled structured incident context materially improve production incident investigation by a strong AI engineering agent?

Gate 0A builds only the reproducible control-versus-manual-context harness. It does not validate the product hypothesis. Synthetic fixtures test software behavior and never count toward research evidence.

## Manual-context pass criteria

- At least 10 real sanitized historical incidents; 20 preferred.
- Median external tool-call reduction of at least 50%.
- Median time-to-correct-hypothesis reduction of at least 40%.
- No material diagnostic-accuracy reduction versus control.
- No increase in false high-confidence hypotheses.

Reports must remain `INCOMPLETE` until the dataset, paired conditions, adjudication, and required metrics are complete. Ambiguous diagnoses are `NEEDS_HUMAN_ADJUDICATION`, never silently correct.

## Kill criteria

Stop if manual ideal context produces marginal improvement, reduces accuracy, increases anchoring or false confidence, is unnecessary because ordinary tools are already efficient, requires unrelated structures per incident class, requires extensive ongoing human curation, or pressures the project into a graph database, observability backend, or continuously running telemetry system before value is demonstrated.

## Next gate

Gate 0B requires at least 10 real sanitized incidents with known outcomes and sufficient source evidence, a manual ideal `context.json` for each, a chosen strong external runner, and a frozen experiment configuration. Only after that experiment passes may an automated compiler be considered, and it must preserve at least 80% of the manual context improvement.
