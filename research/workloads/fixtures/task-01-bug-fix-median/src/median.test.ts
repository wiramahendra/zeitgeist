import { describe, expect, it } from "vitest"
import { median } from "./median.js"
describe("median", () => {
  it("averages central values for even length", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
})
