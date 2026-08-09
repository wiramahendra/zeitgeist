import { describe, expect, it } from "vitest"
import { sortTimeline } from "../../src/domain/Timeline.js"

describe("sortTimeline", () => {
  it("orders events by timestamp", () => {
    const events = [
      { timestamp: "2026-01-02T00:00:00.000Z", eventType: "error", subject: "checkout-api" },
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "deploy", subject: "checkout-api" },
      { timestamp: "2026-01-03T00:00:00.000Z", eventType: "alert", subject: "inventory-api" }
    ]
    expect(sortTimeline(events)).toEqual([
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "deploy", subject: "checkout-api" },
      { timestamp: "2026-01-02T00:00:00.000Z", eventType: "error", subject: "checkout-api" },
      { timestamp: "2026-01-03T00:00:00.000Z", eventType: "alert", subject: "inventory-api" }
    ])
  })

  it("orders events by eventType when timestamps match", () => {
    const events = [
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "error", subject: "checkout-api" },
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "alert", subject: "checkout-api" },
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "deploy", subject: "checkout-api" }
    ]
    expect(sortTimeline(events)).toEqual([
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "alert", subject: "checkout-api" },
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "deploy", subject: "checkout-api" },
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "error", subject: "checkout-api" }
    ])
  })

  it("orders events by subject when timestamp and eventType match", () => {
    const events = [
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "error", subject: "inventory-api" },
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "error", subject: "checkout-api" },
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "error", subject: "billing-api" }
    ]
    expect(sortTimeline(events)).toEqual([
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "error", subject: "billing-api" },
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "error", subject: "checkout-api" },
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "error", subject: "inventory-api" }
    ])
  })

  it("does not mutate the input array", () => {
    const events = [
      { timestamp: "2026-01-02T00:00:00.000Z", eventType: "error", subject: "checkout-api" },
      { timestamp: "2026-01-01T00:00:00.000Z", eventType: "deploy", subject: "checkout-api" }
    ]
    const copy = [...events]
    sortTimeline(events)
    expect(events).toEqual(copy)
  })
})
