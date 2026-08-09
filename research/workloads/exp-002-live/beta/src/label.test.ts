import { describe, expect, it } from "vitest"
import { formatLabel } from "./label.js"
describe("formatLabel", () => {
  it("prefixes non-empty labels", () => {
    expect(formatLabel("name", "Ada")).toBe("[name]: Ada")
  })
  it("returns bare value for empty label", () => {
    expect(formatLabel("", "Ada")).toBe("Ada")
  })
})
