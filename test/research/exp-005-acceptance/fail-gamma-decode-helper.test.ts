import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { decodePersisted } from "../../src/domain/Common.js"
import { ExpectedOutcome } from "../../src/domain/ExpectedOutcome.js"

describe("fail-gamma-decode-helper acceptance", () => {
  it("exports a shared decodePersistedFile helper used by dataset and context modules", () => {
    const commonSource = readFileSync("src/domain/Common.ts", "utf8")
    expect(commonSource).toMatch(/decodePersistedFile/)
    const loaderSource = readFileSync("src/dataset/DatasetLoader.ts", "utf8")
    const validatorSource = readFileSync("src/context/ContextValidator.ts", "utf8")
    expect(loaderSource).toMatch(/decodePersistedFile/)
    expect(validatorSource).not.toMatch(/decodePersisted\(schema\)\(raw\)\.pipe\(\s*Effect\.mapError/)
  })

  it("preserves strict persisted decode behavior", async () => {
    const { Effect, Schema } = await import("effect")
    const { decodePersistedFile } = await import("../../src/domain/Common.js")
    const raw = JSON.parse(readFileSync("fixtures/synthetic-example/expected.json", "utf8"))
    const decoded = await Effect.runPromise(decodePersistedFile(ExpectedOutcome, raw, "expected.json"))
    expect(decoded.acceptableDiagnoses.length).toBeGreaterThan(0)
  })
})
