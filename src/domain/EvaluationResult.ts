import * as Schema from "effect/Schema"
import { NonEmptyString, SchemaVersion, StringArray, Timestamp } from "./Common.js"

export const ExperimentCondition = Schema.Literal("CONTROL", "MANUAL_CONTEXT")
export type ExperimentCondition = typeof ExperimentCondition.Type

export const MetricCount = Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.nonNegative()))

export const AgentRunResult = Schema.Struct({
  finalDiagnosis: NonEmptyString,
  rootCauseCategory: Schema.optional(NonEmptyString),
  affectedComponents: Schema.optional(StringArray),
  triggerEntities: Schema.optional(StringArray),
  citedEvidenceIds: Schema.optional(StringArray),
  remediationIds: Schema.optional(StringArray),
  correctHypothesisAtMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  toolCallCount: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  inputTokens: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  outputTokens: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  humanInterventionCount: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  falseHighConfidenceHypotheses: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative()))
})
export type AgentRunResult = typeof AgentRunResult.Type

export const ScoreStatus = Schema.Literal("CORRECT", "INCORRECT", "NEEDS_HUMAN_ADJUDICATION")
export type ScoreStatus = typeof ScoreStatus.Type

export const ScoreBreakdown = Schema.Struct({
  status: ScoreStatus,
  rootCauseCategoryMatch: Schema.Boolean,
  affectedComponentsMatch: Schema.Boolean,
  triggerEntitiesMatch: Schema.Boolean,
  requiredEvidenceMatch: Schema.Boolean,
  remediationMatch: Schema.NullOr(Schema.Boolean),
  matchedDiagnosisId: Schema.NullOr(Schema.String)
})
export type ScoreBreakdown = typeof ScoreBreakdown.Type

export const EvaluationResult = Schema.Struct({
  schemaVersion: SchemaVersion,
  runIdentity: NonEmptyString,
  incidentId: NonEmptyString,
  researchClassification: Schema.Literal("REAL_SANITIZED_HISTORICAL", "SYNTHETIC_TEST_ONLY"),
  condition: ExperimentCondition,
  repetitionIndex: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  runnerIdentity: NonEmptyString,
  promptConfigDigest: NonEmptyString,
  contextDigest: Schema.NullOr(NonEmptyString),
  startedAt: Timestamp,
  completedAt: Timestamp,
  durationMs: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  runnerExitCode: Schema.Number.pipe(Schema.int()),
  agentResult: AgentRunResult,
  score: ScoreBreakdown
})

export const EvaluationResultCollection = Schema.Array(EvaluationResult)
export type EvaluationResult = typeof EvaluationResult.Type
