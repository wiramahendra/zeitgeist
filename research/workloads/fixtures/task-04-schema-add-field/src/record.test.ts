import { describe, expect, it } from "vitest"
import { validateRecord } from "./record.js"
describe("validateRecord", () => {
  it("accepts optional source", () => {
    expect(validateRecord({ id: "a", quantity: 1, source: "x" })).toBe(true)
  })
})
