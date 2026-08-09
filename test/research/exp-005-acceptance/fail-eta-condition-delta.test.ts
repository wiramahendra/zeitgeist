import { describe, expect, it } from "vitest"
import { summarizeConditionDelta } from "../../src/eval/Report.js"
import type { ConditionMetrics } from "../../src/eval/Metrics.js"

const metrics = (runCount: number, correctCount: number): ConditionMetrics => ({
  runCount,
  correctCount,
  needsHumanAdjudicationCount: 0,
  diagnosticAccuracy: 1,
  medianDurationMs: 100,
  medianTimeToCorrectHypothesisMs: 100,
  medianToolCalls: 1,
  medianTotalTokens: 1,
  medianHumanInterventions: 0,
  medianFalseHighConfidenceHypotheses: 0,
  missingMetrics: []
})

describe("fail-eta-condition-delta acceptance", () => {
  it("returns markdown comparing control and manualContext counts", () => {
    const fragment = summarizeConditionDelta(metrics(5, 4), metrics(5, 5))
    expect(fragment).toMatch(/control/i)
    expect(fragment).toMatch(/manual/i)
    expect(fragment).toMatch(/5/)
  })
})
