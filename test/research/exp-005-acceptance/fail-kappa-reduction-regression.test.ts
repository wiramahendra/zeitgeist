import { describe, expect, it } from "vitest"
import { reduction } from "../../src/eval/Metrics.js"

describe("fail-kappa-reduction-regression acceptance", () => {
  it("returns null for null inputs and zero control", () => {
    expect(reduction(null, 10)).toBeNull()
    expect(reduction(10, null)).toBeNull()
    expect(reduction(0, 5)).toBeNull()
  })

  it("returns positive fractional reduction when treatment improves", () => {
    expect(reduction(100, 50)).toBeCloseTo(0.5)
  })
})
