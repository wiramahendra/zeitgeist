import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import {
  decodeContext,
  inspectContext,
  statsContext
} from "../../src/context/ContextValidator.js"

const fixture = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(`../../fixtures/synthetic-example/${name}`, import.meta.url), "utf8")) as unknown

describe("inspectContext", () => {
  it("reports deduplicated timeline evidence id count", async () => {
    const context = await Effect.runPromise(decodeContext(await fixture("context.json")))
    expect(inspectContext(context)).toContain("Timeline unique evidence IDs: 2")
  })

  it("deduplicates repeated evidence ids across timeline events", async () => {
    const raw = await fixture("context.json") as Record<string, unknown>
    const context = await Effect.runPromise(
      decodeContext({
        ...raw,
        timeline: [
          {
            timestamp: "2026-08-01T02:39:12Z",
            eventType: "deployment-started",
            subject: "checkout-api-v184",
            evidenceIds: ["ev-deploy-001", "ev-error-001"]
          },
          {
            timestamp: "2026-08-01T02:40:05Z",
            eventType: "error-observed",
            subject: "checkout-api",
            evidenceIds: ["ev-error-001"]
          }
        ]
      })
    )
    expect(inspectContext(context)).toContain("Timeline unique evidence IDs: 2")
  })
})

describe("statsContext", () => {
  it("reports labeled counts for synthetic fixture", async () => {
    const context = await Effect.runPromise(decodeContext(await fixture("context.json")))
    expect(statsContext(context)).toBe(
      "Facts: 1\nTimeline events: 2\nErrors: 1\nDependencies: 1\nTimeline unique evidence IDs: 2\n"
    )
  })

  it("deduplicates timeline evidence ids in the unique count", async () => {
    const raw = await fixture("context.json") as Record<string, unknown>
    const context = await Effect.runPromise(
      decodeContext({
        ...raw,
        timeline: [
          {
            timestamp: "2026-08-01T02:39:12Z",
            eventType: "deployment-started",
            subject: "checkout-api-v184",
            evidenceIds: ["ev-deploy-001", "ev-error-001"]
          },
          {
            timestamp: "2026-08-01T02:40:05Z",
            eventType: "error-observed",
            subject: "checkout-api",
            evidenceIds: ["ev-error-001"]
          }
        ]
      })
    )
    expect(statsContext(context)).toContain("Timeline unique evidence IDs: 2")
  })
})
