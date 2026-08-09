import type { CloudTranscript, TranscriptToolResult } from "./CloudTranscriptAdapter.js"
import type { NormalizedAgentRun } from "./AgentRun.js"
import {
  computeInterBatchGaps,
  computeTimeAttribution,
  groupToolBatches,
  type ToolBatch
} from "./TimeAttribution.js"
import { normalizeAgentRun } from "./TraceNormalizer.js"
import type { RawAgentRun } from "./AgentRun.js"

export const EXP004B_DECISIONS = ["ATTRIBUTED", "MIXED", "INVALID", "NO_SIGNAL"] as const
export type Exp004bDecision = (typeof EXP004B_DECISIONS)[number]

export const GAP_ATTRIBUTION_CATEGORIES = [
  "model_provider_latency",
  "agent_model_processing",
  "harness_scheduling",
  "tool_result_context_processing",
  "other_observable_runtime",
  "UNATTRIBUTED"
] as const
export type GapAttributionCategory = (typeof GAP_ATTRIBUTION_CATEGORIES)[number]

export interface TelemetryFieldAvailability {
  readonly field: string
  readonly available: boolean
  readonly supportsCausalAttribution: boolean
  readonly notes: string
}

export interface TelemetryCapabilityAudit {
  readonly transcriptMessageFields: ReadonlyArray<TelemetryFieldAvailability>
  readonly cloudEventsAvailable: boolean
  readonly directlyAttributableGapCategories: ReadonlyArray<GapAttributionCategory>
  readonly summary: string
}

export interface InterBatchGapAttribution {
  readonly gapIndex: number
  readonly afterBatchIndex: number
  readonly durationMs: number
  readonly batchEndMs: number
  readonly nextBatchStartMs: number
  readonly lastToolResultEndMs: number
  readonly toolResultProcessingMs: number
  readonly categoryMs: Readonly<Record<GapAttributionCategory, number>>
}

export interface GapAttributionResult {
  readonly interBatchGapMs: number
  readonly gapCount: number
  readonly medianGapMs: number | null
  readonly categoryMs: Readonly<Record<GapAttributionCategory, number>>
  readonly categoryShare: Readonly<Record<GapAttributionCategory, number>>
  readonly attributableMs: number
  readonly attributableShare: number
  readonly gaps: ReadonlyArray<InterBatchGapAttribution>
}

export interface GapAttributionRunRecord {
  readonly taskId: string
  readonly taskClass: string
  readonly finalStatus: RawAgentRun["finalStatus"]
  readonly cloudAgentBcId: string | null
  readonly interBatchGapMs: number
  readonly gapAttribution: GapAttributionResult
  readonly exp004InterBatchGapMs: number
}

const emptyCategoryMs = (): Record<GapAttributionCategory, number> =>
  Object.fromEntries(GAP_ATTRIBUTION_CATEGORIES.map((category) => [category, 0])) as Record<
    GapAttributionCategory,
    number
  >

const median = (values: ReadonlyArray<number>): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

const finiteMs = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null

const buildRelativeResultEndByCallIndex = (transcript: CloudTranscript): Map<number, number> => {
  const resultsById = new Map<string, TranscriptToolResult>()
  for (const message of transcript.messages) {
    if (message.role === "tool") resultsById.set(message.tool_call_id, message)
  }
  let relativeStart: number | null = null
  for (const message of transcript.messages) {
    if (message.role !== "assistant" || message.tool_calls === undefined) continue
    for (const call of message.tool_calls) {
      const startedAtMs = finiteMs(call.started_at_ms)
      if (startedAtMs !== null) {
        relativeStart = relativeStart === null ? startedAtMs : Math.min(relativeStart, startedAtMs)
      }
    }
  }
  const base = relativeStart ?? 0
  const resultEndByCallIndex = new Map<number, number>()
  let callIndex = 0
  for (const message of transcript.messages) {
    if (message.role !== "assistant" || message.tool_calls === undefined) continue
    for (const call of message.tool_calls) {
      const result = resultsById.get(call.tool_call_id)
      const callEndMs = finiteMs(call.completed_at_ms)
      const resultEndMs = finiteMs(result?.completed_at_ms) ?? finiteMs(result?.started_at_ms)
      const endedAtMs = Math.max(callEndMs ?? base, resultEndMs ?? base)
      resultEndByCallIndex.set(callIndex, Math.max(0, endedAtMs - base))
      callIndex += 1
    }
  }
  return resultEndByCallIndex
}

const maxBatchResultEndMs = (batch: ToolBatch, resultEndByCallIndex: ReadonlyMap<number, number>): number => {
  let maxEnd = batch.endMs
  for (const callIndex of batch.callIndexes) {
    const resultEnd = resultEndByCallIndex.get(callIndex)
    if (resultEnd !== undefined) maxEnd = Math.max(maxEnd, resultEnd)
  }
  return maxEnd
}

export const buildTelemetryCapabilityAudit = (cloudEventsAvailable: boolean): TelemetryCapabilityAudit => ({
  transcriptMessageFields: [
    {
      field: "assistant.tool_calls.started_at_ms",
      available: true,
      supportsCausalAttribution: true,
      notes: "Defines tool batch start boundary."
    },
    {
      field: "assistant.tool_calls.completed_at_ms",
      available: true,
      supportsCausalAttribution: true,
      notes: "Defines tool batch end boundary."
    },
    {
      field: "tool.started_at_ms / tool.completed_at_ms",
      available: true,
      supportsCausalAttribution: true,
      notes: "Tool result timestamps; in EXP-004 runs always equal call completion (no post-batch result lag)."
    },
    {
      field: "assistant.text / assistant.thinking",
      available: true,
      supportsCausalAttribution: false,
      notes: "Present between batches but carry no timestamps; cannot bound model or deliberation time."
    },
    {
      field: "user.text",
      available: true,
      supportsCausalAttribution: false,
      notes: "No timestamps on user messages."
    },
    {
      field: "model_request_duration_ms / token counts",
      available: false,
      supportsCausalAttribution: false,
      notes: "Not exported in native cloud transcript.json."
    }
  ],
  cloudEventsAvailable,
  directlyAttributableGapCategories: ["tool_result_context_processing", "other_observable_runtime"],
  summary:
    "Inter-batch gap duration is directly measurable as next batch start minus previous batch end. " +
    "Sub-gap decomposition requires timestamps that are absent on assistant turns and model requests; " +
    "cloud run events did not expose per-turn scheduling for EXP-004 agents."
})

const attributeGapDuration = (
  durationMs: number,
  toolResultProcessingMs: number
): Record<GapAttributionCategory, number> => {
  const categories = emptyCategoryMs()
  if (durationMs <= 0) return categories
  const toolProcessing = Math.min(durationMs, Math.max(0, toolResultProcessingMs))
  categories.tool_result_context_processing = toolProcessing
  categories.UNATTRIBUTED = Math.max(0, durationMs - toolProcessing)
  return categories
}

export const computeGapAttribution = (
  normalized: NormalizedAgentRun,
  transcript: CloudTranscript
): GapAttributionResult => {
  const batches = groupToolBatches(normalized.toolCalls)
  const interBatchGaps = computeInterBatchGaps(batches)
  const resultEndByCallIndex = buildRelativeResultEndByCallIndex(transcript)
  const categoryMs = emptyCategoryMs()
  const gapDetails: Array<InterBatchGapAttribution> = []

  for (let gapIndex = 0; gapIndex < interBatchGaps.length; gapIndex += 1) {
    const gap = interBatchGaps[gapIndex]
    const previous = batches[gapIndex]
    const current = batches[gapIndex + 1]
    if (gap === undefined || previous === undefined || current === undefined) continue
    const lastToolResultEndMs = maxBatchResultEndMs(previous, resultEndByCallIndex)
    const toolResultProcessingMs = Math.max(0, lastToolResultEndMs - previous.endMs)
    const gapCategories = attributeGapDuration(gap.durationMs, toolResultProcessingMs)
    for (const category of GAP_ATTRIBUTION_CATEGORIES) {
      categoryMs[category] += gapCategories[category]
    }
    gapDetails.push({
      gapIndex,
      afterBatchIndex: gapIndex,
      durationMs: gap.durationMs,
      batchEndMs: previous.endMs,
      nextBatchStartMs: current.startMs,
      lastToolResultEndMs,
      toolResultProcessingMs,
      categoryMs: gapCategories
    })
  }

  const interBatchGapMs = interBatchGaps.reduce((total, gap) => total + gap.durationMs, 0)
  const attributableMs = interBatchGapMs - categoryMs.UNATTRIBUTED
  const categoryShare = Object.fromEntries(
    GAP_ATTRIBUTION_CATEGORIES.map((category) => [
      category,
      interBatchGapMs === 0 ? 0 : categoryMs[category] / interBatchGapMs
    ])
  ) as Record<GapAttributionCategory, number>

  return {
    interBatchGapMs,
    gapCount: interBatchGaps.length,
    medianGapMs: median(interBatchGaps.map((gap) => gap.durationMs)),
    categoryMs,
    categoryShare,
    attributableMs,
    attributableShare: interBatchGapMs === 0 ? 0 : attributableMs / interBatchGapMs,
    gaps: gapDetails
  }
}

export const buildGapAttributionRunRecord = (
  run: RawAgentRun,
  transcript: CloudTranscript,
  cloudAgentBcId: string | null
): GapAttributionRunRecord => {
  const normalized = normalizeAgentRun(run)
  const exp004 = computeTimeAttribution(normalized)
  const gapAttribution = computeGapAttribution(normalized, transcript)
  return {
    taskId: run.taskId,
    taskClass: run.taskClass,
    finalStatus: run.finalStatus,
    cloudAgentBcId,
    interBatchGapMs: gapAttribution.interBatchGapMs,
    gapAttribution,
    exp004InterBatchGapMs: exp004.interToolGapMs
  }
}

export interface DominantGapCause {
  readonly category: GapAttributionCategory
  readonly medianShare: number
  readonly taskClasses: ReadonlyArray<string>
  readonly runCount: number
}

export const detectDominantGapCause = (
  records: ReadonlyArray<GapAttributionRunRecord>,
  options: { readonly minShare: number; readonly minTaskClasses: number }
): DominantGapCause | null => {
  const attributableCategories = GAP_ATTRIBUTION_CATEGORIES.filter((category) => category !== "UNATTRIBUTED")
  let best: DominantGapCause | null = null
  for (const category of attributableCategories) {
    const matching = records.filter((record) => record.gapAttribution.categoryMs[category] > 0)
    const taskClasses = [...new Set(matching.map((record) => record.taskClass))]
    const shares = records.map((record) => record.gapAttribution.categoryShare[category])
    const medianShare = median(shares) ?? 0
    if (taskClasses.length < options.minTaskClasses) continue
    if (medianShare < options.minShare) continue
    if (best === null || medianShare > best.medianShare) {
      best = { category, medianShare, taskClasses, runCount: matching.length }
    }
  }
  return best
}

export const decideExp004b = (
  records: ReadonlyArray<GapAttributionRunRecord>,
  options: { readonly minAttributableShare: number; readonly minDominantShare: number; readonly minTaskClasses: number }
): Exp004bDecision => {
  const totalGapMs = records.reduce((total, record) => total + record.gapAttribution.interBatchGapMs, 0)
  const totalAttributableMs = records.reduce((total, record) => total + record.gapAttribution.attributableMs, 0)
  const attributableShare = totalGapMs === 0 ? 0 : totalAttributableMs / totalGapMs
  if (attributableShare < options.minAttributableShare) return "INVALID"
  const dominant = detectDominantGapCause(records, {
    minShare: options.minDominantShare,
    minTaskClasses: options.minTaskClasses
  })
  if (dominant === null) return "MIXED"
  return "ATTRIBUTED"
}

export const aggregateGapCategoryMs = (
  records: ReadonlyArray<GapAttributionRunRecord>
): Record<GapAttributionCategory, number> => {
  const totals = emptyCategoryMs()
  for (const record of records) {
    for (const category of GAP_ATTRIBUTION_CATEGORIES) {
      totals[category] += record.gapAttribution.categoryMs[category]
    }
  }
  return totals
}

export type { NormalizedAgentRun }
