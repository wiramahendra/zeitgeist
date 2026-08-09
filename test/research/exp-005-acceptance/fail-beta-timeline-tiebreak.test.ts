import { describe, expect, it } from "vitest"
import { sortTimeline, timelineCompare } from "../../src/domain/Timeline.js"

describe("fail-beta-timeline-tiebreak acceptance", () => {
  it("sorts equal timestamps by eventType then subject", () => {
    const events = sortTimeline([
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "deploy", subject: "checkout-api", evidenceIds: ["a"] },
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "alert", subject: "inventory-api", evidenceIds: ["b"] },
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "alert", subject: "checkout-api", evidenceIds: ["c"] }
    ])
    expect(events.map((event) => `${event.eventType}:${event.subject}`)).toEqual([
      "alert:checkout-api",
      "alert:inventory-api",
      "deploy:checkout-api"
    ])
  })

  it("uses eventType before subject in timelineCompare tie-break", () => {
    expect(
      timelineCompare(
        { timestamp: "t", eventType: "a", subject: "z" },
        { timestamp: "t", eventType: "b", subject: "a" }
      )
    ).toBeLessThan(0)
  })
})
