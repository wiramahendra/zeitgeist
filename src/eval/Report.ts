import { Effect, Schema } from "effect"
import type { EvaluationResult } from "../domain/EvaluationResult.js"
import { decodePersisted } from "../domain/Common.js"
import { atomicWrite, canonicalize } from "../context/Canonicalize.js"
import { calculateConditionMetrics, reduction, type ConditionMetrics } from "./Metrics.js"

export interface EvaluationReport {
  readonly schemaVersion: "1.0"
  readonly generatedFrom: "results.jsonl"
  readonly experimentStatus: "PASS" | "FAIL" | "INCOMPLETE"
  readonly completenessReasons: ReadonlyArray<string>
  readonly distinctResearchIncidents: number
  readonly control: ConditionMetrics
  readonly manualContext: ConditionMetrics
  readonly comparisons: {
    readonly medianToolCallReduction: number | null
    readonly medianTimeToCorrectHypothesisReduction: number | null
  }
}

const NullableNumber = Schema.NullOr(Schema.Number)
const ConditionMetricsSchema = Schema.Struct({
  runCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  correctCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  needsHumanAdjudicationCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  diagnosticAccuracy: NullableNumber,
  medianDurationMs: NullableNumber,
  medianTimeToCorrectHypothesisMs: NullableNumber,
  medianToolCalls: NullableNumber,
  medianTotalTokens: NullableNumber,
  medianHumanInterventions: NullableNumber,
  medianFalseHighConfidenceHypotheses: NullableNumber,
  missingMetrics: Schema.Array(Schema.String)
})

const EvaluationReportSchema = Schema.Struct({
  schemaVersion: Schema.Literal("1.0"),
  generatedFrom: Schema.Literal("results.jsonl"),
  experimentStatus: Schema.Literal("PASS", "FAIL", "INCOMPLETE"),
  completenessReasons: Schema.Array(Schema.String),
  distinctResearchIncidents: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  control: ConditionMetricsSchema,
  manualContext: ConditionMetricsSchema,
  comparisons: Schema.Struct({
    medianToolCallReduction: NullableNumber,
    medianTimeToCorrectHypothesisReduction: NullableNumber
  })
})

export const buildReport = (results: ReadonlyArray<EvaluationResult>): EvaluationReport => {
  const researchResults = results.filter((result) => result.researchClassification === "REAL_SANITIZED_HISTORICAL")
  const control = calculateConditionMetrics(researchResults, "CONTROL")
  const manualContext = calculateConditionMetrics(researchResults, "MANUAL_CONTEXT")
  const incidentIds = new Set(researchResults.map((result) => result.incidentId))
  const completenessReasons: Array<string> = []
  if (incidentIds.size < 10) completenessReasons.push("Fewer than 10 distinct real incident results")
  const researchControlCount = researchResults.filter((result) => result.condition === "CONTROL").length
  const researchManualCount = researchResults.filter((result) => result.condition === "MANUAL_CONTEXT").length
  if (researchControlCount !== researchManualCount || researchControlCount < incidentIds.size) {
    completenessReasons.push("Conditions do not contain a complete paired run for every incident")
  }
  const pairKeys = new Map<string, Set<string>>()
  for (const result of researchResults) {
    const key = [result.incidentId, result.repetitionIndex, result.runnerIdentity, result.promptConfigDigest].join("\u0000")
    const conditions = pairKeys.get(key) ?? new Set<string>()
    conditions.add(result.condition)
    pairKeys.set(key, conditions)
  }
  if ([...pairKeys.values()].some((conditions) => !conditions.has("CONTROL") || !conditions.has("MANUAL_CONTEXT"))) {
    completenessReasons.push("At least one research run lacks its exact control/manual-context counterpart")
  }
  const requiredMissing = new Set([...control.missingMetrics, ...manualContext.missingMetrics])
  for (const metric of requiredMissing) completenessReasons.push(`Required metric unavailable: ${metric}`)
  if (control.diagnosticAccuracy === null || manualContext.diagnosticAccuracy === null) {
    completenessReasons.push("Diagnostic accuracy is unavailable pending adjudication")
  }
  const medianToolCallReduction = reduction(control.medianToolCalls, manualContext.medianToolCalls)
  const medianTimeToCorrectHypothesisReduction = reduction(
    control.medianTimeToCorrectHypothesisMs,
    manualContext.medianTimeToCorrectHypothesisMs
  )
  let experimentStatus: EvaluationReport["experimentStatus"] = "INCOMPLETE"
  if (completenessReasons.length === 0) {
    const accuracyMaintained = (manualContext.diagnosticAccuracy ?? 0) >= (control.diagnosticAccuracy ?? 0)
    const falseHypothesesNotIncreased =
      (manualContext.medianFalseHighConfidenceHypotheses ?? Number.POSITIVE_INFINITY) <=
      (control.medianFalseHighConfidenceHypotheses ?? Number.NEGATIVE_INFINITY)
    experimentStatus =
      (medianToolCallReduction ?? -1) >= 0.5 &&
      (medianTimeToCorrectHypothesisReduction ?? -1) >= 0.4 &&
      accuracyMaintained &&
      falseHypothesesNotIncreased
        ? "PASS"
        : "FAIL"
  }
  return {
    schemaVersion: "1.0",
    generatedFrom: "results.jsonl",
    experimentStatus,
    completenessReasons,
    distinctResearchIncidents: incidentIds.size,
    control,
    manualContext,
    comparisons: { medianToolCallReduction, medianTimeToCorrectHypothesisReduction }
  }
}

const display = (value: number | null): string => value === null ? "unavailable" : String(value)

export const renderReportMarkdown = (report: EvaluationReport): string => `# Zeitgeist Gate 0 Evaluation Report

Experiment status: **${report.experimentStatus}**

Distinct research incidents: ${report.distinctResearchIncidents}
Total evaluations: ${report.control.runCount + report.manualContext.runCount}

## Control

- Runs: ${report.control.runCount}
- Needs human adjudication: ${report.control.needsHumanAdjudicationCount}
- Diagnostic accuracy: ${display(report.control.diagnosticAccuracy)}
- Median investigation duration (ms): ${display(report.control.medianDurationMs)}
- Median tool calls: ${display(report.control.medianToolCalls)}
- Median total tokens: ${display(report.control.medianTotalTokens)}
- Missing metrics: ${report.control.missingMetrics.length === 0 ? "none" : report.control.missingMetrics.join(", ")}

## Manual context

- Runs: ${report.manualContext.runCount}
- Needs human adjudication: ${report.manualContext.needsHumanAdjudicationCount}
- Diagnostic accuracy: ${display(report.manualContext.diagnosticAccuracy)}
- Median investigation duration (ms): ${display(report.manualContext.medianDurationMs)}
- Median tool calls: ${display(report.manualContext.medianToolCalls)}
- Median total tokens: ${display(report.manualContext.medianTotalTokens)}
- Missing metrics: ${report.manualContext.missingMetrics.length === 0 ? "none" : report.manualContext.missingMetrics.join(", ")}

## Completeness

${report.completenessReasons.length === 0 ? "Complete." : report.completenessReasons.map((reason) => `- ${reason}`).join("\n")}
`

export const writeReport = (outputDirectory: string, report: EvaluationReport) =>
  decodePersisted(EvaluationReportSchema)(report).pipe(
    Effect.flatMap((validated) =>
      Effect.all([
        atomicWrite(`${outputDirectory}/report.json`, canonicalize(validated)),
        atomicWrite(`${outputDirectory}/report.md`, renderReportMarkdown(report))
      ], { concurrency: 2, discard: true })
    )
  )
