import { describe, expect, it } from "vitest"
import { parseCsv } from "./csv.js"
describe("parseCsv", () => {
  it("parses rows", () => {
    expect(parseCsv("a,b\n c , d ")).toEqual([["a", "b"], ["c", "d"]])
  })
})
