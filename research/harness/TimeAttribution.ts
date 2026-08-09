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

export interface TimeAttribution {
  readonly wallClockMs: number
  readonly deterministicToolMs: number
  readonly interToolGapMs: number
  readonly unattributedMs: number
  readonly interToolGapCount: number
  readonly medianInterToolGapMs: number | null
  readonly maxInterToolGapMs: number | null
  readonly categoryDurationMs: Readonly<Record<ToolCategory, number>>
  readonly categoryWallShare: Readonly<Record<ToolCategory, number>>
  readonly verificationMs: number
  readonly explorationMs: number
  readonly timingSemantics: NormalizedAgentRun["timingSemantics"]
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
  const gaps = computeInterToolGaps(run.toolCalls)
  const interToolGapMs = gaps.reduce((total, gap) => total + gap.durationMs, 0)
  const unattributedMs = Math.max(0, run.durationMs - metrics.deterministicToolDurationMs - interToolGapMs)
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
    interToolGapMs,
    unattributedMs,
    interToolGapCount: gaps.length,
    medianInterToolGapMs: median(gaps.map((gap) => gap.durationMs)),
    maxInterToolGapMs: gaps.length === 0 ? null : Math.max(...gaps.map((gap) => gap.durationMs)),
    categoryDurationMs: metrics.categoryDurationMs,
    categoryWallShare,
    verificationMs,
    explorationMs,
    timingSemantics: run.timingSemantics
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
  if (records.some((record) => record.attribution.timingSemantics === "overlapping_unsupported")) {
    return "INVALID"
  }
  const strong = patterns.filter(
    (pattern) =>
      (pattern.medianWallShare ?? 0) >= thresholds.minWallShare ||
      (pattern.medianToolShare ?? 0) >= thresholds.minToolShare
  )
  if (strong.length > 0) return "STRONG_SIGNAL"
  if (patterns.length > 0) return "WEAK_SIGNAL"
  return "NO_SIGNAL"
}
