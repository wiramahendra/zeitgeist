import type { NormalizedAgentRun, ToolCategory } from "./AgentRun.js"
import { TOOL_CATEGORIES } from "./AgentRun.js"
import type { RunMetrics } from "./AgentRun.js"
import { computeRunMetrics } from "./Metrics.js"
import { normalizeAgentRun } from "./TraceNormalizer.js"

export const EXP004_DECISIONS = ["STRONG_SIGNAL", "WEAK_SIGNAL", "NO_SIGNAL", "INVALID"] as const
export type Exp004Decision = (typeof EXP004_DECISIONS)[number]

export const VERIFICATION_CATEGORIES = ["test", "typecheck", "build"] as const
export type VerificationCategory = (typeof VERIFICATION_CATEGORIES)[number]

export const EXTERNALLY_REMOVABLE_PATTERNS = [
  "package_environment",
  "repeated_file_reads",
  "repeated_tests",
  "exploration_overhead"
] as const
export type ExternallyRemovablePattern = (typeof EXTERNALLY_REMOVABLE_PATTERNS)[number]

export interface InterToolGap {
  readonly afterCallIndex: number
  readonly durationMs: number
}

export interface ToolBatch {
  readonly startMs: number
  readonly endMs: number
  readonly wallMs: number
  readonly toolMs: number
  readonly callIndexes: ReadonlyArray<number>
}

export interface TimeAttribution {
  readonly wallClockMs: number
  readonly deterministicToolMs: number
  readonly parallelBatchCount: number
  readonly busyWallMs: number
  readonly interToolGapMs: number
  readonly parallelOverlapMs: number
  readonly unattributedMs: number
  readonly interToolGapCount: number
  readonly medianInterToolGapMs: number | null
  readonly maxInterToolGapMs: number | null
  readonly categoryDurationMs: Readonly<Record<ToolCategory, number>>
  readonly categoryWallShare: Readonly<Record<ToolCategory, number>>
  readonly verificationMs: number
  readonly explorationMs: number
  readonly timingSemantics: NormalizedAgentRun["timingSemantics"]
  readonly usesParallelBatchAccounting: boolean
}

export interface RecurringPattern {
  readonly pattern: ExternallyRemovablePattern
  readonly runCount: number
  readonly taskClasses: ReadonlyArray<string>
  readonly medianWallShare: number | null
  readonly medianToolShare: number | null
}

const median = (values: ReadonlyArray<number>): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

export const groupToolBatches = (
  toolCalls: ReadonlyArray<{ readonly callIndex: number; readonly startedAtMs: number; readonly endedAtMs: number; readonly durationMs: number }>
): ReadonlyArray<ToolBatch> => {
  const ordered = [...toolCalls].sort((left, right) =>
    left.startedAtMs === right.startedAtMs ? left.callIndex - right.callIndex : left.startedAtMs - right.startedAtMs
  )
  const batches: Array<ToolBatch> = []
  for (const call of ordered) {
    const last = batches[batches.length - 1]
    if (last !== undefined && call.startedAtMs <= last.endMs) {
      batches[batches.length - 1] = {
        startMs: last.startMs,
        endMs: Math.max(last.endMs, call.endedAtMs),
        wallMs: Math.max(last.endMs, call.endedAtMs) - last.startMs,
        toolMs: last.toolMs + call.durationMs,
        callIndexes: [...last.callIndexes, call.callIndex]
      }
      continue
    }
    batches.push({
      startMs: call.startedAtMs,
      endMs: call.endedAtMs,
      wallMs: Math.max(0, call.endedAtMs - call.startedAtMs),
      toolMs: call.durationMs,
      callIndexes: [call.callIndex]
    })
  }
  return batches
}

export const computeInterBatchGaps = (batches: ReadonlyArray<ToolBatch>): ReadonlyArray<InterToolGap> => {
  const gaps: Array<InterToolGap> = []
  for (let index = 1; index < batches.length; index += 1) {
    const previous = batches[index - 1]
    const current = batches[index]
    if (previous === undefined || current === undefined) continue
    const durationMs = Math.max(0, current.startMs - previous.endMs)
    if (durationMs > 0) {
      gaps.push({ afterCallIndex: previous.callIndexes[previous.callIndexes.length - 1] ?? -1, durationMs })
    }
  }
  return gaps
}

export const computeInterToolGaps = (
  toolCalls: ReadonlyArray<{ readonly callIndex: number; readonly startedAtMs: number; readonly endedAtMs: number }>
): ReadonlyArray<InterToolGap> => {
  const ordered = [...toolCalls].sort((left, right) => left.startedAtMs - right.startedAtMs)
  const gaps: Array<InterToolGap> = []
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]
    const current = ordered[index]
    if (previous === undefined || current === undefined) continue
    const durationMs = Math.max(0, current.startedAtMs - previous.endedAtMs)
    if (durationMs > 0) {
      gaps.push({ afterCallIndex: previous.callIndex, durationMs })
    }
  }
  return gaps
}

export const computeTimeAttribution = (run: NormalizedAgentRun): TimeAttribution => {
  const metrics = computeRunMetrics(run)
  const usesParallelBatchAccounting = run.timingSemantics === "overlapping_unsupported"
  const batches = groupToolBatches(run.toolCalls)
  const gaps = usesParallelBatchAccounting ? computeInterBatchGaps(batches) : computeInterToolGaps(run.toolCalls)
  const interToolGapMs = gaps.reduce((total, gap) => total + gap.durationMs, 0)
  const busyWallMs = batches.reduce((total, batch) => total + batch.wallMs, 0)
  const parallelOverlapMs = usesParallelBatchAccounting
    ? Math.max(0, metrics.deterministicToolDurationMs - busyWallMs)
    : 0
  const unattributedMs = Math.max(0, run.durationMs - busyWallMs - interToolGapMs)
  const categoryWallShare = Object.fromEntries(
    TOOL_CATEGORIES.map((category) => [
      category,
      run.durationMs === 0 ? 0 : metrics.categoryDurationMs[category] / run.durationMs
    ])
  ) as Record<ToolCategory, number>
  const verificationMs = VERIFICATION_CATEGORIES.reduce(
    (total, category) => total + metrics.categoryDurationMs[category],
    0
  )
  const explorationMs =
    metrics.categoryDurationMs.repository_discovery +
    metrics.categoryDurationMs.search +
    metrics.categoryDurationMs.file_read

  return {
    wallClockMs: run.durationMs,
    deterministicToolMs: metrics.deterministicToolDurationMs,
    parallelBatchCount: batches.length,
    busyWallMs,
    interToolGapMs,
    parallelOverlapMs,
    unattributedMs,
    interToolGapCount: gaps.length,
    medianInterToolGapMs: median(gaps.map((gap) => gap.durationMs)),
    maxInterToolGapMs: gaps.length === 0 ? null : Math.max(...gaps.map((gap) => gap.durationMs)),
    categoryDurationMs: metrics.categoryDurationMs,
    categoryWallShare,
    verificationMs,
    explorationMs,
    timingSemantics: run.timingSemantics,
    usesParallelBatchAccounting
  }
}

export interface AttributionRunRecord {
  readonly taskId: string
  readonly taskClass: string
  readonly finalStatus: RunMetrics["finalStatus"]
  readonly metrics: RunMetrics
  readonly attribution: TimeAttribution
}

export const buildAttributionRecords = (
  runs: ReadonlyArray<Parameters<typeof normalizeAgentRun>[0]>
): ReadonlyArray<AttributionRunRecord> =>
  runs.map((run) => {
    const normalized = normalizeAgentRun(run)
    const metrics = computeRunMetrics(normalized)
    return {
      taskId: run.taskId,
      taskClass: run.taskClass,
      finalStatus: run.finalStatus,
      metrics,
      attribution: computeTimeAttribution(normalized)
    }
  })

const patternWallShare = (record: AttributionRunRecord, pattern: ExternallyRemovablePattern): number => {
  switch (pattern) {
    case "package_environment":
      return record.attribution.categoryWallShare.package_manager + record.attribution.categoryWallShare.git
    case "repeated_file_reads":
      return (record.metrics.duplicateFileReadRatio ?? 0) * record.attribution.categoryWallShare.file_read
    case "repeated_tests":
      return record.metrics.repeatedTestRunCount > 0
        ? record.attribution.categoryWallShare.test
        : 0
    case "exploration_overhead":
      return (
        record.attribution.categoryWallShare.repository_discovery +
        record.attribution.categoryWallShare.search +
        record.attribution.categoryWallShare.file_read
      )
  }
}

const patternToolShare = (record: AttributionRunRecord, pattern: ExternallyRemovablePattern): number => {
  if (record.metrics.deterministicToolDurationMs === 0) return 0
  switch (pattern) {
    case "package_environment":
      return (
        record.metrics.categoryDurationMs.package_manager + record.metrics.categoryDurationMs.git
      ) / record.metrics.deterministicToolDurationMs
    case "repeated_file_reads":
      return ((record.metrics.duplicateFileReadRatio ?? 0) * record.metrics.categoryDurationMs.file_read) /
        record.metrics.deterministicToolDurationMs
    case "repeated_tests":
      return record.metrics.repeatedTestRunCount > 0
        ? record.metrics.categoryDurationMs.test / record.metrics.deterministicToolDurationMs
        : 0
    case "exploration_overhead":
      return record.attribution.explorationMs / record.metrics.deterministicToolDurationMs
  }
}

const patternMatchesRun = (record: AttributionRunRecord, pattern: ExternallyRemovablePattern): boolean => {
  switch (pattern) {
    case "package_environment":
      return record.metrics.categoryDurationMs.package_manager > 0 || record.metrics.categoryDurationMs.git > 0
    case "repeated_file_reads":
      return (record.metrics.duplicateFileReadRatio ?? 0) > 0
    case "repeated_tests":
      return record.metrics.repeatedTestRunCount > 0
    case "exploration_overhead":
      return record.attribution.explorationMs > 0
  }
}

export const detectRecurringPatterns = (
  records: ReadonlyArray<AttributionRunRecord>,
  options: {
    readonly minRuns: number
    readonly minTaskClasses: number
    readonly minWallShare: number
    readonly minToolShare: number
  }
): ReadonlyArray<RecurringPattern> =>
  EXTERNALLY_REMOVABLE_PATTERNS.flatMap((pattern) => {
    const matching = records.filter((record) => patternMatchesRun(record, pattern))
    const taskClasses = [...new Set(matching.map((record) => record.taskClass))]
    if (matching.length < options.minRuns || taskClasses.length < options.minTaskClasses) return []
    const wallShares = matching.map((record) => patternWallShare(record, pattern))
    const toolShares = matching.map((record) => patternToolShare(record, pattern))
    const medianWallShare = median(wallShares)
    const medianToolShare = median(toolShares)
    return [
      {
        pattern,
        runCount: matching.length,
        taskClasses,
        medianWallShare,
        medianToolShare
      }
    ]
  })

export const decideExp004 = (
  records: ReadonlyArray<AttributionRunRecord>,
  expectedRunCount: number,
  patterns: ReadonlyArray<RecurringPattern>,
  thresholds: { readonly minWallShare: number; readonly minToolShare: number }
): Exp004Decision => {
  if (records.length < expectedRunCount) return "INVALID"
  const strong = patterns.filter(
    (pattern) =>
      (pattern.medianWallShare ?? 0) >= thresholds.minWallShare ||
      (pattern.medianToolShare ?? 0) >= thresholds.minToolShare
  )
  if (strong.length > 0) return "STRONG_SIGNAL"
  if (patterns.length > 0) return "WEAK_SIGNAL"
  return "NO_SIGNAL"
}
