import { describe, expect, it } from "vitest"
import { add } from "./adder"
describe("add", () => {
  it("sums numbers", () => {
    expect(add(2, 3)).toBe(5)
  })
})
