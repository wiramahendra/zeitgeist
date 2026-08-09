import { describe, expect, it } from "vitest"
import { parseDocument } from "./document.js"
describe("parseDocument", () => {
  it("parses lines", () => {
    expect(parseDocument("a,b")).toEqual([["a", "b"]])
  })
})
