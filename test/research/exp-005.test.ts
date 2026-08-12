import { describe, expect, it } from "vitest"
import {
  aggregateOutcomeRates,
  buildFailureAttribution,
  decideExp005,
  decideTaskOutcome,
  detectRecurringFailures,
  type TaskScoreResult
} from "../../research/harness/FailureSurface.js"

const makeScore = (overrides: Partial<TaskScoreResult>): TaskScoreResult => ({
  taskId: "fail-alpha-context-stats",
  taskClass: "cross_module_feature",
  outcome: "FAILURE",
  firstPassCorrect: false,
  acceptanceResults: [{ criterionId: "hidden_acceptance", passed: false, evidence: "failed" }],
  hiddenCheckResults: [{ checkId: "hidden_acceptance", passed: false, exitCode: 1, output: "fail" }],
  scopeResults: [{ checkId: "forbidden", passed: true, evidence: "none" }],
  agentClaims: { claimedTestsPassed: true, claimedCommitHash: "abc1234", summaryText: "tests passed yes" },
  repositoryTruth: {
    finalCommitHash: "abc1234",
    acceptanceTestsPassed: false,
    fullTestSuitePassed: false,
    hiddenChecksPassed: false,
    scopeChecksPassed: true,
    regressionDetected: false
  },
  claimDisagreement: true,
  failureAttribution: null,
  wallClockMs: 1000,
  toolCallCount: 5,
  ...overrides
})

describe("failure surface", () => {
  it("classifies full success when all checks pass", () => {
    expect(
      decideTaskOutcome({
        acceptanceResults: [{ criterionId: "a", passed: true, evidence: "ok" }],
        hiddenCheckResults: [{ checkId: "h", passed: true, exitCode: 0, output: "" }],
        scopeResults: [{ checkId: "s", passed: true, evidence: "ok" }],
        fullTestSuitePassed: true,
        regressionDetected: false
      })
    ).toBe("SUCCESS")
  })

  it("marks claim disagreement when agent claims tests passed but they did not", () => {
    const score = { ...makeScore({}), claimDisagreement: true }
    const attribution = buildFailureAttribution(score)
    expect(attribution?.secondaryClasses).toContain("WRONG_ASSUMPTION")
  })

  it("detects recurring verification failures across task classes", () => {
    const scores = [
      makeScore({ taskId: "a", taskClass: "cross_module_feature" }),
      makeScore({ taskId: "b", taskClass: "bug_misleading_symptom" }),
      makeScore({ taskId: "c", taskClass: "refactor_multi_module" })
    ].map((score) => ({ ...score, failureAttribution: buildFailureAttribution(score)! }))
    const patterns = detectRecurringFailures(scores, { minRuns: 3, minTaskClasses: 2 })
    expect(patterns.length).toBeGreaterThan(0)
  })

  it("returns INVALID when run count is below expected", () => {
    const scores = [makeScore({})].map((score) => ({ ...score, failureAttribution: buildFailureAttribution(score)! }))
    expect(decideExp005(scores, [], 11, { minFailureRate: 0.3, minTaskClasses: 3, minExternallyAddressableShare: 0.5 })).toBe(
      "INVALID"
    )
  })

  it("aggregates outcome rates", () => {
    const rates = aggregateOutcomeRates([
      makeScore({ outcome: "SUCCESS" }),
      makeScore({ outcome: "FAILURE" }),
      makeScore({ outcome: "PARTIAL" })
    ])
    expect(rates.total).toBe(3)
    expect(rates.success).toBe(1)
  })
})
