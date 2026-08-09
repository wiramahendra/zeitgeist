import { describe, expect, it } from "vitest"
import { slugify } from "./slugify.js"
describe("slugify", () => {
  it("slugifies words", () => {
    expect(slugify("Hello World")).toBe("hello-world")
  })

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("")
  })

  it("collapses consecutive separators into one", () => {
    expect(slugify("hello---world")).toBe("hello-world")
    expect(slugify("a   b")).toBe("a-b")
    expect(slugify("foo--bar__baz")).toBe("foo-bar-baz")
  })
})
