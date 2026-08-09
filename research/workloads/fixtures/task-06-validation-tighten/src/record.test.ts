import { describe, expect, it } from "vitest"
import { validateRecord } from "./record.js"
describe("validateRecord", () => {
  it("rejects negative quantity", () => {
    expect(validateRecord({ id: "a", quantity: -1 })).toBe(false)
  })
})
