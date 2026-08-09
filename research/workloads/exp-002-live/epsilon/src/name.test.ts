import { describe, expect, it } from "vitest"
import { validateName } from "./name.js"
describe("validateName", () => {
  it("rejects whitespace-only strings", () => {
    expect(validateName("   ")).toBe(false)
  })
  it("accepts normal names", () => {
    expect(validateName("alpha")).toBe(true)
  })
})
