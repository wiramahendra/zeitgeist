import type { AgentRunResult, ScoreBreakdown } from "../domain/EvaluationResult.js"
import type { ExpectedOutcome } from "../domain/ExpectedOutcome.js"

const containsAll = (actual: ReadonlyArray<string> | undefined, expected: ReadonlyArray<string>): boolean => {
  if (expected.length === 0) return true
  if (actual === undefined) return false
  const normalized = new Set(actual.map((item) => item.toLowerCase()))
  return expected.every((item) => normalized.has(item.toLowerCase()))
}

export const scoreAgentResult = (result: AgentRunResult, expected: ExpectedOutcome): ScoreBreakdown => {
  const rootCauseCategoryMatch = result.rootCauseCategory?.toLowerCase() === expected.rootCauseCategory.toLowerCase()
  const affectedComponentsMatch = containsAll(result.affectedComponents, expected.affectedComponents)
  const triggerEntitiesMatch = containsAll(result.triggerEntities, expected.triggerEntities)
  const requiredEvidenceMatch = containsAll(result.citedEvidenceIds, expected.requiredEvidence)
  const remediationMatch = expected.acceptableRemediations.length === 0
    ? null
    : result.remediationIds !== undefined && result.remediationIds.some((item) =>
        expected.acceptableRemediations.some((acceptable) => acceptable.toLowerCase() === item.toLowerCase())
      )
  const diagnosis = result.finalDiagnosis.toLowerCase()
  const matchedDiagnosis = expected.acceptableDiagnoses.find((candidate) =>
    candidate.deterministicTerms.every((term) => diagnosis.includes(term.toLowerCase()))
  )
  const structuredComplete =
    rootCauseCategoryMatch &&
    affectedComponentsMatch &&
    triggerEntitiesMatch &&
    requiredEvidenceMatch &&
    remediationMatch !== false
  const status = structuredComplete && matchedDiagnosis !== undefined
    ? "CORRECT"
    : matchedDiagnosis !== undefined || diagnosis.trim().length > 0
      ? "NEEDS_HUMAN_ADJUDICATION"
      : "INCORRECT"
  return {
    status,
    rootCauseCategoryMatch,
    affectedComponentsMatch,
    triggerEntitiesMatch,
    requiredEvidenceMatch,
    remediationMatch,
    matchedDiagnosisId: matchedDiagnosis?.id ?? null
  }
}
