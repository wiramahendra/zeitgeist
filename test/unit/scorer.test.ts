import { describe, expect, it } from "vitest"
import type { AgentRunResult } from "../../src/domain/EvaluationResult.js"
import type { ExpectedOutcome } from "../../src/domain/ExpectedOutcome.js"
import { scoreAgentResult } from "../../src/eval/Scorer.js"

const expected: ExpectedOutcome = {
  schemaVersion: "1.0",
  rootCauseCategory: "upstream-timeout",
  affectedComponents: ["checkout-api"],
  triggerEntities: ["inventory-api"],
  acceptableDiagnoses: [
    {
      id: "diagnosis-inventory-timeout",
      text: "checkout-api failed while waiting for inventory-api",
      deterministicTerms: ["checkout-api", "inventory-api", "timeout"]
    }
  ],
  requiredEvidence: ["ev-error-001"],
  acceptableRemediations: ["rollback-checkout-v184"]
}

describe("scoreAgentResult", () => {
  it("scores a fully matching structured result as CORRECT", () => {
    const result: AgentRunResult = {
      finalDiagnosis: "checkout-api experienced an inventory-api timeout",
      rootCauseCategory: "upstream-timeout",
      affectedComponents: ["checkout-api"],
      triggerEntities: ["inventory-api"],
      citedEvidenceIds: ["ev-error-001"],
      remediationIds: ["rollback-checkout-v184"]
    }

    const score = scoreAgentResult(result, expected)

    expect(score.status).toBe("CORRECT")
    expect(score.matchedDiagnosisId).toBe("diagnosis-inventory-timeout")
    expect(score.rootCauseCategoryMatch).toBe(true)
    expect(score.affectedComponentsMatch).toBe(true)
    expect(score.triggerEntitiesMatch).toBe(true)
    expect(score.requiredEvidenceMatch).toBe(true)
    expect(score.remediationMatch).toBe(true)
  })

  it("scores an empty diagnosis with no structured match as INCORRECT", () => {
    const result = { finalDiagnosis: "" } as AgentRunResult

    const score = scoreAgentResult(result, expected)

    expect(score.status).toBe("INCORRECT")
    expect(score.matchedDiagnosisId).toBeNull()
  })

  it("requires human adjudication when diagnosis text is plausible but non-deterministic", () => {
    const result: AgentRunResult = {
      finalDiagnosis: "An upstream became slow"
    }

    const score = scoreAgentResult(result, expected)

    expect(score.status).toBe("NEEDS_HUMAN_ADJUDICATION")
    expect(score.matchedDiagnosisId).toBeNull()
    expect(score.rootCauseCategoryMatch).toBe(false)
  })

  it("requires human adjudication when diagnosis matches but structured fields are incomplete", () => {
    const result: AgentRunResult = {
      finalDiagnosis: "checkout-api timeout waiting on inventory-api",
      rootCauseCategory: "upstream-timeout"
    }

    const score = scoreAgentResult(result, expected)

    expect(score.status).toBe("NEEDS_HUMAN_ADJUDICATION")
    expect(score.matchedDiagnosisId).toBe("diagnosis-inventory-timeout")
    expect(score.affectedComponentsMatch).toBe(false)
  })
})
