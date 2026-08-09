import type { EvaluationResult, ExperimentCondition } from "../domain/EvaluationResult.js"

export interface ConditionMetrics {
  readonly runCount: number
  readonly correctCount: number
  readonly needsHumanAdjudicationCount: number
  readonly diagnosticAccuracy: number | null
  readonly medianDurationMs: number | null
  readonly medianTimeToCorrectHypothesisMs: number | null
  readonly medianToolCalls: number | null
  readonly medianTotalTokens: number | null
  readonly medianHumanInterventions: number | null
  readonly medianFalseHighConfidenceHypotheses: number | null
  readonly missingMetrics: ReadonlyArray<string>
}

const median = (values: ReadonlyArray<number>): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const right = sorted[middle]
  if (right === undefined) return null
  if (sorted.length % 2 === 1) return right
  const left = sorted[middle - 1]
  return left === undefined ? null : (left + right) / 2
}

const optionalValues = (results: ReadonlyArray<EvaluationResult>, select: (result: EvaluationResult) => number | undefined) =>
  results.flatMap((result) => {
    const value = select(result)
    return value === undefined ? [] : [value]
  })

export const calculateConditionMetrics = (
  allResults: ReadonlyArray<EvaluationResult>,
  condition: ExperimentCondition
): ConditionMetrics => {
  const results = allResults.filter((result) => result.condition === condition)
  const adjudicated = results.filter((result) => result.score.status !== "NEEDS_HUMAN_ADJUDICATION")
  const metricEntries = {
    timeToCorrectHypothesis: optionalValues(results, (result) => result.agentResult.correctHypothesisAtMs),
    toolCalls: optionalValues(results, (result) => result.agentResult.toolCallCount),
    totalTokens: optionalValues(results, (result) => {
      const input = result.agentResult.inputTokens
      const output = result.agentResult.outputTokens
      return input === undefined || output === undefined ? undefined : input + output
    }),
    humanInterventions: optionalValues(results, (result) => result.agentResult.humanInterventionCount),
    falseHighConfidenceHypotheses: optionalValues(results, (result) => result.agentResult.falseHighConfidenceHypotheses)
  }
  const missingMetrics = Object.entries(metricEntries)
    .filter(([, values]) => values.length !== results.length)
    .map(([name]) => name)
  return {
    runCount: results.length,
    correctCount: results.filter((result) => result.score.status === "CORRECT").length,
    needsHumanAdjudicationCount: results.length - adjudicated.length,
    diagnosticAccuracy: adjudicated.length === 0
      ? null
      : results.filter((result) => result.score.status === "CORRECT").length / adjudicated.length,
    medianDurationMs: median(results.map((result) => result.durationMs)),
    medianTimeToCorrectHypothesisMs: median(metricEntries.timeToCorrectHypothesis),
    medianToolCalls: median(metricEntries.toolCalls),
    medianTotalTokens: median(metricEntries.totalTokens),
    medianHumanInterventions: median(metricEntries.humanInterventions),
    medianFalseHighConfidenceHypotheses: median(metricEntries.falseHighConfidenceHypotheses),
    missingMetrics
  }
}

export const reduction = (control: number | null, treatment: number | null): number | null =>
  control === null || treatment === null || control === 0 ? null : (control - treatment) / control
