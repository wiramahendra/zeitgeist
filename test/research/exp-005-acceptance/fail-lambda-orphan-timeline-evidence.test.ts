import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { validateContext } from "../../src/context/ContextValidator.js"
import { readFileSync } from "node:fs"

describe("fail-lambda-orphan-timeline-evidence acceptance", () => {
  it("rejects timeline evidence IDs missing from the evidence array", async () => {
    const evidence = JSON.parse(readFileSync("fixtures/synthetic-example/evidence.json", "utf8")) as ReadonlyArray<{
      readonly id: string
    }>
    const context = JSON.parse(readFileSync("fixtures/synthetic-example/context.json", "utf8"))
    const mutated = {
      ...context,
      timeline: [
        {
          ...context.timeline[0],
          evidenceIds: ["ev-nonexistent-999"]
        }
      ]
    }
    await expect(Effect.runPromise(validateContext(mutated, evidence as never))).rejects.toBeTruthy()
  })
})
