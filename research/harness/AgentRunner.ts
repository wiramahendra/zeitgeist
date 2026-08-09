import { open, readFile } from "node:fs/promises"
import { Effect } from "effect"
import { canonicalize } from "../../src/context/Canonicalize.js"
import type { RawAgentRun } from "./AgentRun.js"

export class ResultStoreMalformed {
  readonly _tag = "ResultStoreMalformed"
  constructor(readonly details: { readonly path: string; readonly reason: string }) {}
}

export class DuplicateRunIdentity {
  readonly _tag = "DuplicateRunIdentity"
  constructor(readonly details: { readonly path: string; readonly runIdentity: string }) {}
}

const isRawAgentRun = (value: unknown): value is RawAgentRun => {
  if (value === null || typeof value !== "object") return false
  const candidate = value as Partial<RawAgentRun>
  return (
    candidate.schemaVersion === "1.0" &&
    typeof candidate.runIdentity === "string" &&
    typeof candidate.experimentId === "string" &&
    typeof candidate.taskId === "string" &&
    Array.isArray(candidate.toolCalls)
  )
}

export const parseRawResultsJsonl = (contents: string, path: string): Effect.Effect<Array<RawAgentRun>, ResultStoreMalformed | DuplicateRunIdentity> =>
  Effect.gen(function* () {
    const results: Array<RawAgentRun> = []
    const identities = new Set<string>()
    const lines = contents.split("\n")
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (line === undefined || line.trim() === "") continue
      const parsed = yield* Effect.try({
        try: () => JSON.parse(line) as unknown,
        catch: (error) =>
          new ResultStoreMalformed({ path, reason: `Malformed JSONL line ${index + 1}: ${String(error)}` })
      })
      if (!isRawAgentRun(parsed)) {
        return yield* Effect.fail(
          new ResultStoreMalformed({ path, reason: `Line ${index + 1} does not match RawAgentRun contract` })
        )
      }
      if (identities.has(parsed.runIdentity)) {
        return yield* Effect.fail(
          new DuplicateRunIdentity({ path, runIdentity: parsed.runIdentity })
        )
      }
      identities.add(parsed.runIdentity)
      results.push(parsed)
    }
    return results
  })

export const readRawResultsJsonl = (path: string): Effect.Effect<Array<RawAgentRun>, ResultStoreMalformed | DuplicateRunIdentity> =>
  Effect.tryPromise({
    try: async () => readFile(path, "utf8"),
    catch: (error) => new ResultStoreMalformed({ path, reason: String(error) })
  }).pipe(Effect.flatMap((contents) => parseRawResultsJsonl(contents, path)))

export const appendRawResult = (path: string, result: RawAgentRun): Effect.Effect<void, ResultStoreMalformed | DuplicateRunIdentity> =>
  Effect.gen(function* () {
    if (!isRawAgentRun(result)) {
      return yield* Effect.fail(new ResultStoreMalformed({ path, reason: "Result does not match RawAgentRun contract" }))
    }
    const existing = yield* Effect.tryPromise({
      try: async () => readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return ""
        throw error
      }),
      catch: (error) => new ResultStoreMalformed({ path, reason: String(error) })
    })
    const parsed = yield* parseRawResultsJsonl(existing, path)
    if (parsed.some((item) => item.runIdentity === result.runIdentity)) {
      return yield* Effect.fail(new DuplicateRunIdentity({ path, runIdentity: result.runIdentity }))
    }
    yield* Effect.tryPromise({
      try: async () => {
        const handle = await open(path, "a", 0o600)
        try {
          await handle.write(canonicalize(result))
          await handle.sync()
        } finally {
          await handle.close()
        }
      },
      catch: (error) => new ResultStoreMalformed({ path, reason: String(error) })
    })
  })

export interface AgentRunnerConfig {
  readonly identity: string
  readonly configDigest: string
  readonly modelIdentity: string | null
}

export interface TaskExecutionContext {
  readonly repositoryRoot: string
  readonly experimentId: string
  readonly experimentVersion: string
  readonly repositoryCommit: string
  readonly taskSetDigest: string
  readonly runner: AgentRunnerConfig
  readonly taskId: string
  readonly taskClass: string
  readonly runIndex: number
}

export interface AgentRunner {
  readonly identity: string
  readonly runTask: (context: TaskExecutionContext) => Effect.Effect<RawAgentRun, ResultStoreMalformed>
}

export const unavailableAgentMetrics = (): ReadonlyArray<string> => [
  "model_request_duration_ms",
  "input_tokens",
  "output_tokens",
  "model_turn_count"
]
