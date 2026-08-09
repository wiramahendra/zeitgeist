import { describe, expect, it } from "vitest"
import { computeRatio } from "./ratio.js"
describe("computeRatio", () => {
  it("returns null for zero denominator", () => {
    expect(computeRatio(1, 0)).toBeNull()
  })
  it("divides normally", () => {
    expect(computeRatio(4, 2)).toBe(2)
  })
})
