import { describe, expect, it } from "vitest"
import { formatUtcHour } from "./timezone.js"
describe("formatUtcHour", () => {
  it("uses UTC hours", () => {
    expect(formatUtcHour(new Date("2026-01-01T15:00:00.000Z"))).toBe("15")
  })
})
