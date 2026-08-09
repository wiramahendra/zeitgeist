import { describe, expect, it } from "vitest"
import { slugify } from "./slugify.js"
describe("slugify", () => {
  it("slugifies words", () => {
    expect(slugify("Hello World")).toBe("hello-world")
  })

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("")
  })

  it("collapses consecutive separators", () => {
    expect(slugify("hello---world")).toBe("hello-world")
    expect(slugify("hello   world")).toBe("hello-world")
  })
})
