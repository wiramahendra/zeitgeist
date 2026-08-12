import type { NormalizedAgentRun, NormalizedToolCall, RawAgentRun, RawToolCall, ToolCategory } from "./AgentRun.js"

const SEARCH_PATTERNS = [/rg\b/, /\bgrep\b/, /\bfind\b/, /Glob\b/, /Grep\b/]
const TEST_PATTERNS = [/vitest\b/, /\bpnpm test\b/, /\bnpm test\b/, /\bpytest\b/, /\bjest\b/]
const TYPECHECK_PATTERNS = [/tsc\b/, /\bpnpm typecheck\b/, /\bnpm run typecheck\b/]
const BUILD_PATTERNS = [/\bpnpm build\b/, /\bnpm run build\b/, /\btsc -p\b/]
const PACKAGE_PATTERNS = [/\bpnpm install\b/, /\bnpm install\b/, /\bpnpm add\b/, /\bnpm ci\b/]
const GIT_PATTERNS = [/\bgit\b/]
const REPO_DISCOVERY_PATTERNS = [/\bls\b/, /\btree\b/, /Glob\b/, /Task\b/, /explore\b/]

const matchesAny = (value: string, patterns: ReadonlyArray<RegExp>): boolean =>
  patterns.some((pattern) => pattern.test(value))

export const categorizeToolName = (toolName: string): ToolCategory => {
  const normalized = toolName.toLowerCase()
  if (normalized.includes("read")) return "file_read"
  if (normalized.includes("write") || normalized.includes("edit") || normalized.includes("applypatch")) return "file_write"
  if (normalized.includes("grep") || normalized.includes("glob") || normalized.includes("search")) return "search"
  if (normalized.includes("shell")) return "shell_other"
  if (normalized.includes("task")) return "repository_discovery"
  return "unknown"
}

export const categorizeCommand = (command: string): ToolCategory | null => {
  if (command.startsWith("read:")) return "file_read"
  if (matchesAny(command, GIT_PATTERNS)) return "git"
  if (matchesAny(command, PACKAGE_PATTERNS)) return "package_manager"
  if (matchesAny(command, TEST_PATTERNS)) return "test"
  if (matchesAny(command, TYPECHECK_PATTERNS)) return "typecheck"
  if (matchesAny(command, BUILD_PATTERNS)) return "build"
  if (matchesAny(command, SEARCH_PATTERNS)) return "search"
  if (matchesAny(command, REPO_DISCOVERY_PATTERNS)) return "repository_discovery"
  return null
}

export const normalizeToolName = (toolCall: RawToolCall): string => {
  if (toolCall.command?.startsWith("read:")) return "Read"
  return toolCall.toolName.trim() || "unknown"
}

export const normalizeToolCall = (toolCall: RawToolCall): NormalizedToolCall => ({
  ...toolCall,
  normalizedToolName: normalizeToolName(toolCall)
})

const hasOverlappingToolCalls = (toolCalls: ReadonlyArray<RawToolCall>): boolean => {
  const sorted = [...toolCalls].sort((left, right) => left.startedAtMs - right.startedAtMs)
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const current = sorted[index]
    if (previous !== undefined && current !== undefined && current.startedAtMs < previous.endedAtMs) {
      return true
    }
  }
  return false
}

export const normalizeAgentRun = (run: RawAgentRun): NormalizedAgentRun => {
  const overlapping = hasOverlappingToolCalls(run.toolCalls)
  return {
    ...run,
    toolCalls: run.toolCalls.map(normalizeToolCall),
    timingSemantics: overlapping ? "overlapping_unsupported" : "sequential_non_overlapping"
  }
}

export const collectRepeatedValues = <T>(values: ReadonlyArray<T>): { readonly total: number; readonly unique: number; readonly repeated: number } => {
  const counts = new Map<T, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  let repeated = 0
  for (const count of counts.values()) {
    if (count > 1) repeated += count - 1
  }
  return { total: values.length, unique: counts.size, repeated }
}

export const classifyFailure = (run: RawAgentRun): "RUNNER_FAILED" | "TASK_FAILED" | "PROVIDER_FAILED" | "TIMEOUT" | "INSTRUMENTATION_INVALID" | "SUCCESS" => {
  if (run.finalStatus !== "SUCCESS") return run.finalStatus
  return "SUCCESS"
}

export const repeatedFileReads = (toolCalls: ReadonlyArray<RawToolCall>): ReturnType<typeof collectRepeatedValues<string>> => {
  const paths = toolCalls.flatMap((call) => call.filesRead)
  return collectRepeatedValues(paths)
}

export const repeatedCommands = (toolCalls: ReadonlyArray<RawToolCall>): ReturnType<typeof collectRepeatedValues<string>> => {
  const commands = toolCalls.map((call) => call.command ?? call.toolName)
  return collectRepeatedValues(commands)
}

export const repeatedSearches = (toolCalls: ReadonlyArray<RawToolCall>): ReturnType<typeof collectRepeatedValues<string>> =>
  collectRepeatedValues(
    toolCalls
      .filter((call) => call.category === "search")
      .map((call) => call.command ?? call.toolName)
  )

export const repeatedTests = (toolCalls: ReadonlyArray<RawToolCall>): number =>
  collectRepeatedValues(
    toolCalls
      .filter((call) => call.category === "test")
      .map((call) => call.command ?? call.toolName)
  ).repeated
