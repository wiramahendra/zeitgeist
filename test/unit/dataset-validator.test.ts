import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { assertNoSecretBearingKeys } from "../../src/dataset/DatasetValidator.js"

describe("assertNoSecretBearingKeys", () => {
  const failure = async (effect: Effect.Effect<unknown, unknown>) => {
    const either = await Effect.runPromise(Effect.either(effect))
    return either._tag === "Left" ? either.left : undefined
  }

  it("reports the matched forbidden key name and JSON path in the reason", async () => {
    const error = await failure(assertNoSecretBearingKeys({ nested: { api_key: "redacted" } }, "test"))
    expect(error).toMatchObject({
      _tag: "DatasetMalformed",
      path: "test",
      reason: 'Forbidden secret-bearing field name "api_key" at JSON path $.nested.api_key'
    })
  })
})
