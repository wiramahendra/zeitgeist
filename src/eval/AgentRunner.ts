import { Effect } from "effect"
import type { Evidence } from "../domain/Evidence.js"
import type { Incident } from "../domain/Incident.js"
import type { IncidentContext } from "../domain/IncidentContext.js"
import type { AgentRunResult, ExperimentCondition } from "../domain/EvaluationResult.js"
import type { InvalidRunnerOutput, RunnerFailed, RunnerTimedOut } from "../errors/EvaluationErrors.js"

export interface ExperimentInput {
  readonly schemaVersion: "1.0"
  readonly incident: Incident
  readonly evidence: ReadonlyArray<Evidence>
  readonly condition: ExperimentCondition
  readonly context?: IncidentContext
}

export interface RunnerExecution {
  readonly result: AgentRunResult
  readonly exitCode: number
  readonly durationMs: number
}

export interface AgentRunner {
  readonly identity: string
  readonly run: (
    input: ExperimentInput
  ) => Effect.Effect<RunnerExecution, RunnerFailed | RunnerTimedOut | InvalidRunnerOutput>
}

export const makeFakeRunner = (
  identity: string,
  handler: (input: ExperimentInput) => AgentRunResult
): AgentRunner => ({
  identity,
  run: (input) => {
    const started = performance.now()
    return Effect.sync(() => ({
      result: handler(input),
      exitCode: 0,
      durationMs: Math.max(0, Math.round(performance.now() - started))
    }))
  }
})
