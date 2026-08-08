import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { parseResultsJsonl } from "../../src/eval/ResultStore.js"

describe("result store", () => {
  const failure = async (effect: Effect.Effect<unknown, unknown>) => {
    const either = await Effect.runPromise(Effect.either(effect))
    return either._tag === "Left" ? either.left : undefined
  }
  it("rejects malformed JSONL rather than recovering silently", async () => {
    expect(await failure(parseResultsJsonl("{broken\n"))).toMatchObject({ _tag: "DatasetMalformed" })
  })

  it("rejects duplicate run identities", async () => {
    const result = {
      schemaVersion: "1.0", runIdentity: "same", incidentId: "i", researchClassification: "REAL_SANITIZED_HISTORICAL",
      condition: "CONTROL", repetitionIndex: 0, runnerIdentity: "r", promptConfigDigest: "p", contextDigest: null,
      startedAt: "2026-08-01T00:00:00Z", completedAt: "2026-08-01T00:00:01Z", durationMs: 1000, runnerExitCode: 0,
      agentResult: { finalDiagnosis: "diagnosis" },
      score: { status: "NEEDS_HUMAN_ADJUDICATION", rootCauseCategoryMatch: false, affectedComponentsMatch: false, triggerEntitiesMatch: false, requiredEvidenceMatch: false, remediationMatch: null, matchedDiagnosisId: null }
    }
    const line = JSON.stringify(result)
    expect(await failure(parseResultsJsonl(`${line}\n${line}\n`))).toMatchObject({ _tag: "DatasetMalformed" })
  })
})
