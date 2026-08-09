import { describe, expect, it } from "vitest"
import { sortTimeline, timelineCompare } from "../../src/domain/Timeline.js"

describe("timelineCompare", () => {
  it("orders by timestamp first", () => {
    const earlier = { timestamp: "2026-01-01T00:00:00.000Z", eventType: "alert", subject: "checkout" }
    const later = { timestamp: "2026-01-01T00:00:01.000Z", eventType: "alert", subject: "checkout" }
    expect(timelineCompare(earlier, later)).toBeLessThan(0)
    expect(timelineCompare(later, earlier)).toBeGreaterThan(0)
  })

  it("orders by eventType when timestamps match", () => {
    const alpha = { timestamp: "2026-01-01T00:00:00.000Z", eventType: "alert", subject: "checkout" }
    const beta = { timestamp: "2026-01-01T00:00:00.000Z", eventType: "deploy", subject: "checkout" }
    expect(timelineCompare(alpha, beta)).toBeLessThan(0)
    expect(timelineCompare(beta, alpha)).toBeGreaterThan(0)
  })

  it("orders by subject when timestamp and eventType match", () => {
    const alpha = { timestamp: "2026-01-01T00:00:00.000Z", eventType: "error", subject: "checkout-api" }
    const beta = { timestamp: "2026-01-01T00:00:00.000Z", eventType: "error", subject: "inventory-api" }
    expect(timelineCompare(alpha, beta)).toBeLessThan(0)
    expect(timelineCompare(beta, alpha)).toBeGreaterThan(0)
  })

  it("returns zero for equivalent keys", () => {
    const left = { timestamp: "2026-01-01T00:00:00.000Z", eventType: "alert", subject: "checkout" }
    const right = { timestamp: "2026-01-01T00:00:00.000Z", eventType: "alert", subject: "checkout" }
    expect(timelineCompare(left, right)).toBe(0)
  })
})

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
