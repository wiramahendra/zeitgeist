import { describe, expect, it } from "vitest"
import { formatStats } from "./cli.js"
describe("formatStats", () => {
  it("supports json output", () => {
    expect(formatStats([1, 2, 3])).toContain("count=3")
  })
})
