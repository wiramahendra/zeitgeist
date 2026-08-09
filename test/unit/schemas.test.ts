import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { Effect, Schema } from "effect"
import { Incident } from "../../src/domain/Incident.js"
import { decodePersisted } from "../../src/domain/Common.js"
import { EvidenceCollection } from "../../src/domain/Evidence.js"
import { decodeContext, inspectContext, validateContext } from "../../src/context/ContextValidator.js"
import { contextByteSize, validateContextBudget } from "../../src/context/ContextBudget.js"

const fixture = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(`../../fixtures/synthetic-example/${name}`, import.meta.url), "utf8")) as unknown

const failureTag = async (effect: Effect.Effect<unknown, unknown>): Promise<string | undefined> => {
  const either = await Effect.runPromise(Effect.either(effect))
  return either._tag === "Left" && typeof either.left === "object" && either.left !== null && "_tag" in either.left
    ? String(either.left._tag)
    : undefined
}

describe("persisted schemas", () => {
  it("accepts the strict synthetic incident", async () => {
    const decoded = await Effect.runPromise(Schema.decodeUnknown(Incident)(await fixture("incident.json")))
    expect(decoded.id).toBe("synthetic-checkout-timeout")
  })

  it("rejects unknown persisted fields", async () => {
    const raw = { ...(await fixture("incident.json") as object), surprise: true }
    expect(await failureTag(decodePersisted(Incident)(raw))).toBe("ParseError")
  })

  it("rejects invalid and non-UTC timestamps", async () => {
    const raw = { ...(await fixture("incident.json") as Record<string, unknown>), startedAt: "2026-08-01 02:40:00" }
    expect(await failureTag(decodePersisted(Incident)(raw))).toBe("ParseError")
  })

  it("rejects unknown schema versions", async () => {
    const raw = { ...(await fixture("incident.json") as Record<string, unknown>), schemaVersion: "2.0" }
    expect(await failureTag(decodePersisted(Incident)(raw))).toBe("ParseError")
  })

  it("rejects missing context evidence references", async () => {
    const evidence = await Effect.runPromise(Schema.decodeUnknown(EvidenceCollection)(await fixture("evidence.json")))
    const context = await fixture("context.json") as Record<string, unknown>
    const broken = { ...context, evidenceReferences: ["ev-does-not-exist"] }
    expect(await failureTag(validateContext(broken, evidence))).toBe("ContextEvidenceReferenceMissing")
  })

  it("rejects explicitly named hypotheses and root cause fields", async () => {
    const context = await fixture("context.json") as Record<string, unknown>
    expect(await failureTag(decodeContext({ ...context, hypothesis: "deployment caused errors" }))).toBe("ContextContainsHypothesis")
    expect(await failureTag(decodeContext({ ...context, root_cause: "timeout" }))).toBe("ContextContainsHypothesis")
  })

  it("enforces the configured context byte budget", async () => {
    const context = await fixture("context.json")
    expect(await failureTag(validateContextBudget(context, 10))).toBe("ContextBudgetExceeded")
  })

  it("reports canonical byte size in inspect output", async () => {
    const context = await Effect.runPromise(decodeContext(await fixture("context.json")))
    const output = inspectContext(context)
    expect(output).toContain(`Canonical bytes: ${contextByteSize(context)}`)
  })
})
