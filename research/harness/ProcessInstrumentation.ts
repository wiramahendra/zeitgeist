import { spawn } from "node:child_process"
import { readFile, stat } from "node:fs/promises"
import { Effect, Duration } from "effect"
import type { RawToolCall, ToolCategory } from "./AgentRun.js"
import { categorizeCommand, categorizeToolName } from "./TraceNormalizer.js"

export interface InstrumentedCommandInput {
  readonly callIndex: number
  readonly toolName: string
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly cwd: string
  readonly timeoutMs?: number
  readonly retried?: boolean
}

export interface InstrumentedCommandResult {
  readonly toolCall: RawToolCall
}

export class ProcessExecutionFailed {
  readonly _tag = "ProcessExecutionFailed"
  constructor(readonly details: { readonly command: string; readonly reason: string }) {}
}

export class ProcessTimedOut {
  readonly _tag = "ProcessTimedOut"
  constructor(readonly details: { readonly command: string; readonly timeoutMs: number }) {}
}

const measureBytes = (value: string | Buffer | undefined): number | null =>
  value === undefined ? null : Buffer.byteLength(value)

export const readFileInstrumented = (
  callIndex: number,
  path: string,
  runStartedAtMs: number
): Effect.Effect<InstrumentedCommandResult, ProcessExecutionFailed> =>
  Effect.gen(function* () {
    const startedAtMs = performance.now() - runStartedAtMs
    const result = yield* Effect.tryPromise({
      try: async () => {
        const started = performance.now()
        const contents = await readFile(path, "utf8")
        const ended = performance.now()
        const fileStat = await stat(path).catch(() => null)
        return {
          contents,
          endedAtMs: startedAtMs + (ended - started),
          durationMs: Math.max(0, Math.round(ended - started)),
          bytes: Buffer.byteLength(contents, "utf8"),
          mtimeMs: fileStat?.mtimeMs ?? null
        }
      },
      catch: (error) => new ProcessExecutionFailed({ command: `read:${path}`, reason: String(error) })
    })
    return {
      toolCall: {
        callIndex,
        toolName: "Read",
        category: "file_read" satisfies ToolCategory,
        startedAtMs,
        endedAtMs: result.endedAtMs,
        durationMs: result.durationMs,
        exitStatus: 0,
        command: `read:${path}`,
        filesRead: [path],
        filesWritten: [],
        stdoutBytes: result.bytes,
        stderrBytes: 0,
        failed: false,
        retried: false
      }
    }
  })

export const runInstrumentedCommand = (
  input: InstrumentedCommandInput,
  runStartedAtMs: number
): Effect.Effect<InstrumentedCommandResult, ProcessExecutionFailed | ProcessTimedOut> =>
  Effect.gen(function* () {
    const startedAtMs = performance.now() - runStartedAtMs
    const fullCommand = [input.command, ...input.args].join(" ")
    const category = categorizeCommand(fullCommand) ?? categorizeToolName(input.toolName)

    const execution = yield* Effect.tryPromise({
      try: () =>
        new Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number }>((resolve, reject) => {
          const started = performance.now()
          const child = spawn(input.command, [...input.args], {
            cwd: input.cwd,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
              ...process.env,
              PATH: `/exec-daemon:${process.env.PATH ?? ""}`
            }
          })
          let stdout = ""
          let stderr = ""
          let timedOut = false
          const timeout =
            input.timeoutMs === undefined
              ? undefined
              : setTimeout(() => {
                  timedOut = true
                  child.kill("SIGTERM")
                }, input.timeoutMs)
          child.stdout?.on("data", (chunk: Buffer | string) => {
            stdout += chunk.toString()
          })
          child.stderr?.on("data", (chunk: Buffer | string) => {
            stderr += chunk.toString()
          })
          child.on("error", (error) => {
            if (timeout !== undefined) clearTimeout(timeout)
            reject(error)
          })
          child.on("close", (code) => {
            if (timeout !== undefined) clearTimeout(timeout)
            const ended = performance.now()
            if (timedOut) {
              reject(new Error(`Timed out after ${input.timeoutMs}ms`))
              return
            }
            resolve({
              exitCode: code ?? 1,
              stdout,
              stderr,
              durationMs: Math.max(0, Math.round(ended - started))
            })
          })
        }),
      catch: (error) =>
        String(error).includes("Timed out")
          ? new ProcessTimedOut({ command: fullCommand, timeoutMs: input.timeoutMs ?? 0 })
          : new ProcessExecutionFailed({ command: fullCommand, reason: String(error) })
    })

    const endedAtMs = startedAtMs + execution.durationMs
    const failed = execution.exitCode !== 0

    return {
      toolCall: {
        callIndex: input.callIndex,
        toolName: input.toolName,
        category,
        startedAtMs,
        endedAtMs,
        durationMs: execution.durationMs,
        exitStatus: execution.exitCode,
        command: fullCommand,
        filesRead: [],
        filesWritten: [],
        stdoutBytes: measureBytes(execution.stdout),
        stderrBytes: measureBytes(execution.stderr),
        failed,
        retried: input.retried ?? false
      }
    }
  })

export const defaultCommandTimeout = Duration.seconds(120)
