import { describe, expect, it } from "vitest"
import { reduction } from "../../src/eval/Metrics.js"

describe("reduction", () => {
  it("returns null when control is null", () => {
    expect(reduction(null, 50)).toBeNull()
  })

  it("returns null when treatment is null", () => {
    expect(reduction(100, null)).toBeNull()
  })

  it("returns null when control is zero", () => {
    expect(reduction(0, 50)).toBeNull()
  })

  it("computes positive reduction as (control - treatment) / control", () => {
    expect(reduction(100, 60)).toBe(0.4)
  })
})
