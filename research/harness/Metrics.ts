import { TOOL_CATEGORIES, type NormalizedAgentRun, type RunMetrics, type ToolCategory } from "./AgentRun.js"
import { repeatedFileReads, repeatedSearches, repeatedTests } from "./TraceNormalizer.js"

const ratio = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator

const emptyCategoryDurations = (): Record<ToolCategory, number> =>
  Object.fromEntries(TOOL_CATEGORIES.map((category) => [category, 0])) as Record<ToolCategory, number>

export const computeRunMetrics = (run: NormalizedAgentRun): RunMetrics => {
  const categoryDurationMs = emptyCategoryDurations()
  let deterministicToolDurationMs = 0

  for (const call of run.toolCalls) {
    if (call.category === "agent_internal") continue
    categoryDurationMs[call.category] += call.durationMs
    deterministicToolDurationMs += call.durationMs
  }

  const fileReads = repeatedFileReads(run.toolCalls)
  const searches = repeatedSearches(run.toolCalls)
  const failedCalls = run.toolCalls.filter((call) => call.failed).length
  const retriedCalls = run.toolCalls.filter((call) => call.retried).length

  const firstWrite = run.toolCalls.find((call) => call.category === "file_write")
  const firstVerification = run.toolCalls.find((call) =>
    call.category === "test" || call.category === "typecheck" || call.category === "build"
  )

  const toolTimeShare =
    run.timingSemantics === "overlapping_unsupported"
      ? null
      : ratio(deterministicToolDurationMs, run.durationMs)

  const modelTimeShare =
    run.modelRequestDurationMs === null || run.timingSemantics === "overlapping_unsupported"
      ? null
      : ratio(run.modelRequestDurationMs, run.durationMs)

  const unavailableMetrics = [...run.unavailableMetrics]
  if (run.timingSemantics === "overlapping_unsupported") {
    unavailableMetrics.push("overlapping_timing_aggregation")
  }
  if (run.modelRequestDurationMs === null) {
    unavailableMetrics.push("model_request_duration_ms")
  }
  if (run.inputTokens === null) unavailableMetrics.push("input_tokens")
  if (run.outputTokens === null) unavailableMetrics.push("output_tokens")
  if (run.modelTurnCount === null) unavailableMetrics.push("model_turn_count")

  return {
    runIdentity: run.runIdentity,
    taskId: run.taskId,
    taskClass: run.taskClass,
    finalStatus: run.finalStatus,
    durationMs: run.durationMs,
    deterministicToolDurationMs,
    modelRequestDurationMs: run.modelRequestDurationMs,
    toolTimeShare,
    modelTimeShare,
    toolCallCount: run.toolCalls.length,
    fileReadCount: fileReads.total,
    uniqueFileReadCount: fileReads.unique,
    duplicateFileReadRatio: ratio(fileReads.repeated, fileReads.total),
    searchCount: searches.total,
    repeatedSearchRatio: ratio(searches.repeated, searches.total),
    testRunCount: run.toolCalls.filter((call) => call.category === "test").length,
    repeatedTestRunCount: repeatedTests(run.toolCalls),
    buildTypecheckCount: run.toolCalls.filter((call) => call.category === "build" || call.category === "typecheck").length,
    packageOperationCount: run.toolCalls.filter((call) => call.category === "package_manager").length,
    failedToolCallRate: ratio(failedCalls, run.toolCalls.length),
    retryRate: ratio(retriedCalls, run.toolCalls.length),
    timeToFirstCodeChangeMs: firstWrite?.startedAtMs ?? null,
    timeToFirstVerificationMs: firstVerification?.startedAtMs ?? null,
    unavailableMetrics: [...new Set(unavailableMetrics)].sort(),
    categoryDurationMs
  }
}

export const median = (values: ReadonlyArray<number>): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const right = sorted[middle]
  if (right === undefined) return null
  if (sorted.length % 2 === 1) return right
  const left = sorted[middle - 1]
  return left === undefined ? null : (left + right) / 2
}

export const sum = (values: ReadonlyArray<number>): number => values.reduce((total, value) => total + value, 0)

export interface AggregateMetrics {
  readonly runCount: number
  readonly successCount: number
  readonly medianDurationMs: number | null
  readonly medianDeterministicToolDurationMs: number | null
  readonly medianToolTimeShare: number | null
  readonly totalToolCalls: number
  readonly medianToolCalls: number | null
  readonly categoryDurationTotalsMs: Record<ToolCategory, number>
  readonly categoryDurationMediansMs: Record<ToolCategory, number | null>
  readonly incomplete: boolean
  readonly missingRuns: ReadonlyArray<string>
}

export const computeAggregateMetrics = (
  perTaskMetrics: ReadonlyArray<RunMetrics>,
  expectedTaskIds: ReadonlyArray<string>
): AggregateMetrics => {
  const observed = new Set(perTaskMetrics.map((metric) => metric.taskId))
  const missingRuns = expectedTaskIds.filter((taskId) => !observed.has(taskId))
  const categoryDurationTotalsMs = emptyCategoryDurations()
  const categoryValues: Record<ToolCategory, Array<number>> = Object.fromEntries(
    TOOL_CATEGORIES.map((category) => [category, [] as Array<number>])
  ) as Record<ToolCategory, Array<number>>

  for (const metric of perTaskMetrics) {
    for (const category of TOOL_CATEGORIES) {
      categoryDurationTotalsMs[category] += metric.categoryDurationMs[category]
      if (metric.categoryDurationMs[category] > 0) {
        categoryValues[category].push(metric.categoryDurationMs[category])
      }
    }
  }

  return {
    runCount: perTaskMetrics.length,
    successCount: perTaskMetrics.filter((metric) => metric.finalStatus === "SUCCESS").length,
    medianDurationMs: median(perTaskMetrics.map((metric) => metric.durationMs)),
    medianDeterministicToolDurationMs: median(perTaskMetrics.map((metric) => metric.deterministicToolDurationMs)),
    medianToolTimeShare: median(
      perTaskMetrics.flatMap((metric) => (metric.toolTimeShare === null ? [] : [metric.toolTimeShare]))
    ),
    totalToolCalls: sum(perTaskMetrics.map((metric) => metric.toolCallCount)),
    medianToolCalls: median(perTaskMetrics.map((metric) => metric.toolCallCount)),
    categoryDurationTotalsMs,
    categoryDurationMediansMs: Object.fromEntries(
      TOOL_CATEGORIES.map((category) => [category, median(categoryValues[category])])
    ) as Record<ToolCategory, number | null>,
    incomplete: missingRuns.length > 0 || perTaskMetrics.length < expectedTaskIds.length,
    missingRuns
  }
}

export const rankCategoriesByDuration = (
  totals: Record<ToolCategory, number>
): ReadonlyArray<{ readonly category: ToolCategory; readonly durationMs: number }> =>
  [...TOOL_CATEGORIES]
    .map((category) => ({ category, durationMs: totals[category] }))
    .sort((left, right) => right.durationMs - left.durationMs)
