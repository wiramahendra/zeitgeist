import { describe, expect, it } from "vitest"
import { createLogger } from "./logger.js"
describe("logging", () => {
  it("creates logger", () => {
    expect(createLogger("test").info).toBeTypeOf("function")
  })
})
