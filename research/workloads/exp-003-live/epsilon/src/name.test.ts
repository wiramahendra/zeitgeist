import { describe, expect, it } from "vitest"
import { validateName } from "./name.js"
describe("validateName", () => {
  it("rejects whitespace-only strings", () => {
    expect(validateName("   ")).toBe(false)
  })
})
