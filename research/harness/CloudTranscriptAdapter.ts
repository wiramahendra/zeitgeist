import type { FinalRunStatus, RawAgentRun, RawToolCall } from "./AgentRun.js"
import { createRunIdentity } from "./RunIdentity.js"
import { categorizeCommand, categorizeToolName } from "./TraceNormalizer.js"
import { unavailableAgentMetrics } from "./AgentRunner.js"

export interface LiveTaskDefinition {
  readonly taskId: string
  readonly taskClass: string
  readonly title: string
  readonly description: string
  readonly workspacePath: string
}

export interface TranscriptToolCall {
  readonly tool_call_id: string
  readonly tool_name: string
  readonly tool_args?: Record<string, unknown>
  readonly started_at_ms: number
  readonly completed_at_ms: number
  readonly duration_ms: number
}

export interface TranscriptToolResult {
  readonly role: "tool"
  readonly tool_call_id: string
  readonly tool_name: string
  readonly tool_args?: Record<string, unknown>
  readonly started_at_ms: number
  readonly completed_at_ms: number
  readonly duration_ms: number
  readonly tool_result?: {
    readonly resultType?: string
    readonly value?: Record<string, unknown>
  }
}

export type TranscriptMessage =
  | { readonly role: "user"; readonly text?: string }
  | { readonly role: "assistant"; readonly thinking?: string; readonly text?: string; readonly tool_calls?: ReadonlyArray<TranscriptToolCall> }
  | TranscriptToolResult

export interface CloudTranscript {
  readonly messages: ReadonlyArray<TranscriptMessage>
}

export interface TranscriptRunInput {
  readonly experimentId: string
  readonly experimentVersion: string
  readonly repositoryCommit: string
  readonly taskSetDigest: string
  readonly runnerIdentity: string
  readonly runnerConfigDigest: string
  readonly modelIdentity: string | null
  readonly task: LiveTaskDefinition
  readonly runIndex: number
  readonly transcript: CloudTranscript
  readonly cloudAgentBcId: string | null
  readonly finalStatus?: FinalRunStatus
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null

const stringField = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key]
  return typeof value === "string" ? value : null
}


export const parseCloudTranscript = (raw: unknown): CloudTranscript => {
  const record = asRecord(raw)
  if (record === null || !Array.isArray(record.messages)) {
    throw new Error("Transcript does not contain messages array")
  }
  return { messages: record.messages as ReadonlyArray<TranscriptMessage> }
}

const extractCommand = (toolName: string, toolArgs: Record<string, unknown> | undefined): string | null => {
  if (toolArgs === undefined) return null
  if (toolName === "run_terminal_cmd" || toolName === "Shell") {
    return stringField(toolArgs, "command")
  }
  if (toolName === "read_file" || toolName === "Read") {
    const path = stringField(toolArgs, "path") ?? stringField(toolArgs, "target_file")
    return path === null ? null : `read:${path}`
  }
  if (toolName === "write" || toolName === "Write") {
    const path = stringField(toolArgs, "path")
    return path === null ? null : `write:${path}`
  }
  if (toolName === "search_replace" || toolName === "StrReplace") {
    const path = stringField(toolArgs, "path")
    return path === null ? null : `edit:${path}`
  }
  if (toolName === "grep" || toolName === "Grep") {
    const pattern = stringField(toolArgs, "pattern") ?? "search"
    const path = stringField(toolArgs, "path") ?? "."
    return `rg ${pattern} ${path}`
  }
  if (toolName === "glob_file_search" || toolName === "Glob") {
    const pattern = stringField(toolArgs, "glob_pattern") ?? "*"
    return `glob ${pattern}`
  }
  return null
}

const extractFiles = (
  toolName: string,
  toolArgs: Record<string, unknown> | undefined
): { readonly read: ReadonlyArray<string>; readonly written: ReadonlyArray<string> } => {
  const path = toolArgs === undefined ? null : stringField(toolArgs, "path") ?? stringField(toolArgs, "target_file")
  if (path === null) return { read: [], written: [] }
  if (toolName === "read_file" || toolName === "Read") return { read: [path], written: [] }
  if (toolName === "write" || toolName === "Write" || toolName === "search_replace" || toolName === "StrReplace") {
    return { read: [], written: [path] }
  }
  return { read: [], written: [] }
}

const extractFailure = (toolName: string, result: TranscriptToolResult | undefined): boolean => {
  if (result?.tool_result?.value === undefined) return false
  const value = result.tool_result.value
  if (typeof value.exitCode === "number") return value.exitCode !== 0
  if (typeof value.success === "boolean") return !value.success
  if (toolName === "todo_write") return false
  return false
}

const extractExitStatus = (result: TranscriptToolResult | undefined): number | null => {
  const value = result?.tool_result?.value
  if (value === undefined) return null
  return typeof value.exitCode === "number" ? value.exitCode : null
}

const extractOutputBytes = (result: TranscriptToolResult | undefined): { readonly stdout: number | null; readonly stderr: number | null } => {
  const value = result?.tool_result?.value
  if (value === undefined) return { stdout: null, stderr: null }
  const output = typeof value.output === "string" ? value.output : null
  return { stdout: output === null ? null : Buffer.byteLength(output, "utf8"), stderr: null }
}

const countModelTurns = (messages: ReadonlyArray<TranscriptMessage>): number =>
  messages.filter((message) => message.role === "user").length

const finiteMs = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null

const resolveToolTiming = (
  call: TranscriptToolCall,
  result: TranscriptToolResult | undefined
): { readonly startedAtMs: number; readonly endedAtMs: number; readonly durationMs: number } => {
  const startedAtMs =
    finiteMs(call.started_at_ms) ??
    finiteMs(result?.started_at_ms) ??
    finiteMs(result?.completed_at_ms) ??
    0
  const endedAtMs =
    finiteMs(call.completed_at_ms) ??
    finiteMs(result?.completed_at_ms) ??
    startedAtMs
  const durationMs =
    finiteMs(call.duration_ms) ??
    finiteMs(result?.duration_ms) ??
    Math.max(0, endedAtMs - startedAtMs)
  return { startedAtMs, endedAtMs, durationMs }
}

const mapToolName = (toolName: string): string => {
  switch (toolName) {
    case "run_terminal_cmd":
      return "Shell"
    case "glob_file_search":
      return "Glob"
    case "read_file":
      return "Read"
    case "search_replace":
      return "StrReplace"
    case "grep":
      return "Grep"
    default:
      return toolName
  }
}

export const transcriptToRawAgentRun = (input: TranscriptRunInput): RawAgentRun => {
  const resultsById = new Map<string, TranscriptToolResult>()
  for (const message of input.transcript.messages) {
    if (message.role === "tool") {
      resultsById.set(message.tool_call_id, message)
    }
  }

  const toolCalls: Array<RawToolCall> = []
  let callIndex = 0
  let runStartMs: number | null = null
  let runEndMs: number | null = null

  for (const message of input.transcript.messages) {
    if (message.role !== "assistant" || message.tool_calls === undefined) continue
    for (const call of message.tool_calls) {
      const result = resultsById.get(call.tool_call_id)
      const mappedName = mapToolName(call.tool_name)
      const command = extractCommand(call.tool_name, call.tool_args)
      const category = command === null ? categorizeToolName(mappedName) : categorizeCommand(command) ?? categorizeToolName(mappedName)
      const files = extractFiles(call.tool_name, call.tool_args)
      const output = extractOutputBytes(result)
      const timing = resolveToolTiming(call, result)
      runStartMs = runStartMs === null ? timing.startedAtMs : Math.min(runStartMs, timing.startedAtMs)
      runEndMs = runEndMs === null ? timing.endedAtMs : Math.max(runEndMs, timing.endedAtMs)
      toolCalls.push({
        callIndex,
        toolName: mappedName,
        category,
        startedAtMs: timing.startedAtMs,
        endedAtMs: timing.endedAtMs,
        durationMs: Math.max(0, Math.round(timing.durationMs)),
        exitStatus: extractExitStatus(result),
        command,
        filesRead: files.read,
        filesWritten: files.written,
        stdoutBytes: output.stdout,
        stderrBytes: output.stderr,
        failed: extractFailure(call.tool_name, result),
        retried: false
      })
      callIndex += 1
    }
  }

  const relativeStart = runStartMs ?? 0
  const normalizedCalls = toolCalls.map((call) => ({
    ...call,
    startedAtMs: call.startedAtMs - relativeStart,
    endedAtMs: call.endedAtMs - relativeStart
  }))

  const durationMs =
    runStartMs === null || runEndMs === null ? 0 : Math.max(0, Math.round(runEndMs - runStartMs))
  const startedAt = new Date(runStartMs ?? Date.now()).toISOString()
  const completedAt = new Date(runEndMs ?? Date.now()).toISOString()
  const runIdentity = createRunIdentity({
    experimentId: input.experimentId,
    experimentVersion: input.experimentVersion,
    repositoryCommit: input.repositoryCommit,
    taskSetDigest: input.taskSetDigest,
    runnerIdentity: input.runnerIdentity,
    runnerConfigDigest: input.runnerConfigDigest,
    taskId: input.task.taskId,
    runIndex: input.runIndex
  })

  const unavailable = [...unavailableAgentMetrics()]
  unavailable.push("input_tokens", "output_tokens", "model_request_duration_ms")

  return {
    schemaVersion: "1.0",
    experimentId: input.experimentId,
    experimentVersion: input.experimentVersion,
    repositoryCommit: input.repositoryCommit,
    taskSetDigest: input.taskSetDigest,
    runnerIdentity: input.runnerIdentity,
    runnerConfigDigest: input.runnerConfigDigest,
    taskId: input.task.taskId,
    runIndex: input.runIndex,
    runIdentity,
    taskClass: input.task.taskClass,
    startedAt,
    completedAt,
    durationMs,
    finalStatus: input.finalStatus ?? (normalizedCalls.some((call) => call.failed) ? "TASK_FAILED" : "SUCCESS"),
    modelIdentity: input.modelIdentity,
    modelTurnCount: countModelTurns(input.transcript.messages),
    inputTokens: null,
    outputTokens: null,
    modelRequestDurationMs: null,
    toolCalls: normalizedCalls,
    unavailableMetrics: [...new Set(unavailable)].sort(),
    notes: [
      input.cloudAgentBcId === null ? "No cloud agent bcId recorded for this run." : `cloudAgentBcId=${input.cloudAgentBcId}`,
      "Normalized from native Cursor cloud agent transcript.json."
    ]
  }
}
