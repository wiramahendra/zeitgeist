import { describe, expect, it } from "vitest"
import { formatLabel } from "./label.js"
describe("formatLabel", () => {
  it("prefixes non-empty labels", () => {
    expect(formatLabel("name", "Ada")).toBe("[name]: Ada")
  })
})
