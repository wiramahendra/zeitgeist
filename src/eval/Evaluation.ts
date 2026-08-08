import { Effect } from "effect"
import type { IncidentDataset } from "../dataset/DatasetLoader.js"
import type { EvaluationResult, ExperimentCondition } from "../domain/EvaluationResult.js"
import { canonicalDigest } from "../context/Canonicalize.js"
import type { AgentRunner, ExperimentInput } from "./AgentRunner.js"
import { createRunIdentity } from "./RunIdentity.js"
import { scoreAgentResult } from "./Scorer.js"
import { appendResult } from "./ResultStore.js"

export interface EvaluationConfig {
  readonly repetitionCount: number
  readonly promptConfig: unknown
}

export const makeExperimentInput = (dataset: IncidentDataset, condition: ExperimentCondition): ExperimentInput => {
  const common = {
    schemaVersion: "1.0" as const,
    incident: dataset.incident,
    evidence: dataset.evidence,
    condition
  }
  return condition === "CONTROL" ? common : { ...common, context: dataset.context }
}

export const runSingleEvaluation = (
  dataset: IncidentDataset,
  condition: ExperimentCondition,
  repetitionIndex: number,
  runner: AgentRunner,
  promptConfig: unknown
) =>
  Effect.gen(function* () {
    const input = makeExperimentInput(dataset, condition)
    if (condition === "CONTROL" && "context" in input) {
      return yield* Effect.dieMessage("Invariant violation: context leaked into CONTROL input")
    }
    const promptConfigDigest = canonicalDigest(promptConfig)
    const contextDigest = condition === "MANUAL_CONTEXT" ? canonicalDigest(dataset.context) : null
    const runIdentity = createRunIdentity({
      incidentId: dataset.incident.id,
      condition,
      repetitionIndex,
      runnerIdentity: runner.identity,
      promptConfigDigest,
      contextDigest
    })
    const startedAt = new Date().toISOString()
    const execution = yield* runner.run(input)
    const completedAt = new Date().toISOString()
    return {
      schemaVersion: "1.0",
      runIdentity,
      incidentId: dataset.incident.id,
      researchClassification: dataset.incident.synthetic ?? "REAL_SANITIZED_HISTORICAL",
      condition,
      repetitionIndex,
      runnerIdentity: runner.identity,
      promptConfigDigest,
      contextDigest,
      startedAt,
      completedAt,
      durationMs: execution.durationMs,
      runnerExitCode: execution.exitCode,
      agentResult: execution.result,
      score: scoreAgentResult(execution.result, dataset.expected)
    } satisfies EvaluationResult
  })

export const runEvaluation = (
  datasets: ReadonlyArray<IncidentDataset>,
  runner: AgentRunner,
  outputPath: string,
  config: EvaluationConfig = { repetitionCount: 1, promptConfig: { version: "gate0a-default" } }
) =>
  Effect.gen(function* () {
    let written = 0
    for (const dataset of datasets) {
      for (let repetitionIndex = 0; repetitionIndex < config.repetitionCount; repetitionIndex += 1) {
        for (const condition of ["CONTROL", "MANUAL_CONTEXT"] as const) {
          const result = yield* runSingleEvaluation(dataset, condition, repetitionIndex, runner, config.promptConfig)
          yield* appendResult(outputPath, result)
          written += 1
        }
      }
    }
    return written
  })
