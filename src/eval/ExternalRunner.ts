import { spawn } from "node:child_process"
import { Effect } from "effect"
import { AgentRunResult } from "../domain/EvaluationResult.js"
import { decodePersisted } from "../domain/Common.js"
import { canonicalize } from "../context/Canonicalize.js"
import { InvalidRunnerOutput, RunnerFailed, RunnerTimedOut } from "../errors/EvaluationErrors.js"
import type { AgentRunner, ExperimentInput, RunnerExecution } from "./AgentRunner.js"

const MAX_RUNNER_OUTPUT_BYTES = 1024 * 1024

export interface ExternalRunnerOptions {
  readonly executable: string
  readonly args?: ReadonlyArray<string>
  readonly identity?: string
  readonly timeoutMs?: number
}

type ProcessOutcome =
  | { readonly type: "completed"; readonly exitCode: number | null; readonly stdout: string; readonly stderr: string; readonly durationMs: number }
  | { readonly type: "timed-out" }
  | { readonly type: "spawn-error"; readonly error: unknown }

const execute = (options: ExternalRunnerOptions, input: ExperimentInput): Promise<ProcessOutcome> =>
  new Promise((resolve) => {
    const started = performance.now()
    const child = spawn(options.executable, [...(options.args ?? [])], {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    })
    let settled = false
    let stdout = ""
    let stderr = ""
    const finish = (outcome: ProcessOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(outcome)
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      finish({ type: "timed-out" })
    }, options.timeoutMs ?? 60_000)
    child.on("error", (error) => finish({ type: "spawn-error", error }))
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk
      if (Buffer.byteLength(stdout) > MAX_RUNNER_OUTPUT_BYTES) child.kill("SIGKILL")
    })
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk
      if (Buffer.byteLength(stderr) > MAX_RUNNER_OUTPUT_BYTES) child.kill("SIGKILL")
    })
    child.on("close", (exitCode) =>
      finish({ type: "completed", exitCode, stdout, stderr, durationMs: Math.max(0, Math.round(performance.now() - started)) })
    )
    child.stdin.on("error", () => undefined)
    child.stdin.end(canonicalize(input))
  })

export const makeExternalRunner = (options: ExternalRunnerOptions): AgentRunner => ({
  identity: options.identity ?? `${options.executable} ${(options.args ?? []).join(" ")}`.trim(),
  run: (input) =>
    Effect.tryPromise({
      try: () => execute(options, input),
      catch: (error) => new RunnerFailed({ executable: options.executable, exitCode: null, stderr: String(error) })
    }).pipe(
      Effect.flatMap((outcome): Effect.Effect<RunnerExecution, RunnerFailed | RunnerTimedOut | InvalidRunnerOutput> => {
        if (outcome.type === "timed-out") {
          return Effect.fail(new RunnerTimedOut({ executable: options.executable, timeoutMs: options.timeoutMs ?? 60_000 }))
        }
        if (outcome.type === "spawn-error") {
          return Effect.fail(new RunnerFailed({ executable: options.executable, exitCode: null, stderr: String(outcome.error) }))
        }
        if (outcome.exitCode !== 0) {
          return Effect.fail(
            new RunnerFailed({ executable: options.executable, exitCode: outcome.exitCode, stderr: outcome.stderr.slice(0, 4096) })
          )
        }
        return Effect.try({
          try: () => JSON.parse(outcome.stdout) as unknown,
          catch: (error) => new InvalidRunnerOutput({ reason: `Runner stdout is not JSON: ${String(error)}` })
        }).pipe(
          Effect.flatMap((raw) =>
            decodePersisted(AgentRunResult)(raw).pipe(
              Effect.mapError(() => new InvalidRunnerOutput({ reason: "Runner output does not match the strict AgentRunResult contract" }))
            )
          ),
          Effect.map((result) => ({ result, exitCode: outcome.exitCode ?? 0, durationMs: outcome.durationMs }))
        )
      })
    )
})
