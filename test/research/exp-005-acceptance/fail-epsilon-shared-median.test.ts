import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { median } from "../../src/domain/Common.js"

describe("fail-epsilon-shared-median acceptance", () => {
  it("uses exported median from domain Common", () => {
    const metricsSource = readFileSync("src/eval/Metrics.ts", "utf8")
    expect(metricsSource).toMatch(/from \"\.\.\/domain\/Common\.js\"/)
    expect(metricsSource).not.toMatch(/const median = \(/)
  })

  it("computes even-length medians correctly", () => {
    expect(median([1, 3])).toBe(2)
    expect(median([1, 2, 9])).toBe(2)
  })
})
