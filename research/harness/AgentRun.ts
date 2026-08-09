export const TOOL_CATEGORIES = [
  "repository_discovery",
  "file_read",
  "file_write",
  "search",
  "test",
  "typecheck",
  "build",
  "package_manager",
  "git",
  "shell_other",
  "agent_internal",
  "unknown"
] as const

export type ToolCategory = (typeof TOOL_CATEGORIES)[number]

export const FINAL_RUN_STATUSES = [
  "SUCCESS",
  "TASK_FAILED",
  "RUNNER_FAILED",
  "PROVIDER_FAILED",
  "TIMEOUT",
  "INSTRUMENTATION_INVALID"
] as const

export type FinalRunStatus = (typeof FINAL_RUN_STATUSES)[number]

export const EXPERIMENT_DECISIONS = [
  "NO_SIGNAL",
  "WEAK_SIGNAL",
  "REPLICATE",
  "STRONG_SIGNAL",
  "BLOCKED"
] as const

export type ExperimentDecision = (typeof EXPERIMENT_DECISIONS)[number]

export interface RawToolCall {
  readonly callIndex: number
  readonly toolName: string
  readonly category: ToolCategory
  readonly startedAtMs: number
  readonly endedAtMs: number
  readonly durationMs: number
  readonly exitStatus: number | null
  readonly command: string | null
  readonly filesRead: ReadonlyArray<string>
  readonly filesWritten: ReadonlyArray<string>
  readonly stdoutBytes: number | null
  readonly stderrBytes: number | null
  readonly failed: boolean
  readonly retried: boolean
}

export interface RawAgentRun {
  readonly schemaVersion: "1.0"
  readonly experimentId: string
  readonly experimentVersion: string
  readonly repositoryCommit: string
  readonly taskSetDigest: string
  readonly runnerIdentity: string
  readonly runnerConfigDigest: string
  readonly taskId: string
  readonly runIndex: number
  readonly runIdentity: string
  readonly taskClass: string
  readonly startedAt: string
  readonly completedAt: string
  readonly durationMs: number
  readonly finalStatus: FinalRunStatus
  readonly modelIdentity: string | null
  readonly modelTurnCount: number | null
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly modelRequestDurationMs: number | null
  readonly toolCalls: ReadonlyArray<RawToolCall>
  readonly unavailableMetrics: ReadonlyArray<string>
  readonly notes: ReadonlyArray<string>
}

export interface NormalizedToolCall extends RawToolCall {
  readonly normalizedToolName: string
}

export interface NormalizedAgentRun extends Omit<RawAgentRun, "toolCalls"> {
  readonly toolCalls: ReadonlyArray<NormalizedToolCall>
  readonly timingSemantics: "sequential_non_overlapping" | "overlapping_unsupported"
}

export interface RunMetrics {
  readonly runIdentity: string
  readonly taskId: string
  readonly taskClass: string
  readonly finalStatus: FinalRunStatus
  readonly durationMs: number
  readonly deterministicToolDurationMs: number
  readonly modelRequestDurationMs: number | null
  readonly toolTimeShare: number | null
  readonly modelTimeShare: number | null
  readonly toolCallCount: number
  readonly fileReadCount: number
  readonly uniqueFileReadCount: number
  readonly duplicateFileReadRatio: number | null
  readonly searchCount: number
  readonly repeatedSearchRatio: number | null
  readonly testRunCount: number
  readonly repeatedTestRunCount: number
  readonly buildTypecheckCount: number
  readonly packageOperationCount: number
  readonly failedToolCallRate: number | null
  readonly retryRate: number | null
  readonly timeToFirstCodeChangeMs: number | null
  readonly timeToFirstVerificationMs: number | null
  readonly unavailableMetrics: ReadonlyArray<string>
  readonly categoryDurationMs: Readonly<Record<ToolCategory, number>>
}
