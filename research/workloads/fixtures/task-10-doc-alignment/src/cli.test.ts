import { describe, expect, it } from "vitest"
import { formatStats } from "./cli.js"
describe("formatStats", () => {
  it("formats output", () => {
    expect(formatStats([1, 2])).toContain("count=2")
  })
})
