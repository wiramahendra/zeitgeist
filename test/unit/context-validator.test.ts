import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { Effect, Schema } from "effect"
import {
  decodeContext,
  inspectContext,
  validateContext
} from "../../src/context/ContextValidator.js"
import { EvidenceCollection } from "../../src/domain/Evidence.js"

const fixture = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(`../../fixtures/synthetic-example/${name}`, import.meta.url), "utf8")) as unknown

const failureTag = async (effect: Effect.Effect<unknown, unknown>): Promise<string | undefined> => {
  const either = await Effect.runPromise(Effect.either(effect))
  return either._tag === "Left" && typeof either.left === "object" && either.left !== null && "_tag" in either.left
    ? String(either.left._tag)
    : undefined
}

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

describe("validateContext", () => {
  it("rejects timeline evidence IDs missing from the evidence array", async () => {
    const evidence = await Effect.runPromise(Schema.decodeUnknown(EvidenceCollection)(await fixture("evidence.json")))
    const context = await fixture("context.json") as Record<string, unknown>
    const orphanId = "ev-orphan-timeline"
    const mutated = {
      ...context,
      timeline: [
        ...(context.timeline as unknown[]),
        {
          timestamp: "2026-08-01T02:41:00Z",
          eventType: "orphan-event",
          subject: "checkout-api",
          evidenceIds: [orphanId]
        }
      ],
      evidenceReferences: [...(context.evidenceReferences as string[]), orphanId]
    }
    expect(await failureTag(validateContext(mutated, evidence))).toBe("ContextEvidenceReferenceMissing")
  })

  it("accepts valid timeline evidence IDs present in the evidence array", async () => {
    const evidence = await Effect.runPromise(Schema.decodeUnknown(EvidenceCollection)(await fixture("evidence.json")))
    const context = await fixture("context.json")
    await Effect.runPromise(validateContext(context, evidence))
  })
})
