import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NodeContext } from "@effect/platform-node"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { validateDatasetDirectory, assertNoSecretBearingKeys } from "../../src/dataset/DatasetValidator.js"

const source = new URL("../../fixtures/synthetic-example", import.meta.url).pathname
const run = <A>(effect: Effect.Effect<A, unknown, NodeContext.NodeContext>) =>
  Effect.runPromise(effect.pipe(Effect.provide(NodeContext.layer)))

const copyFixture = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "zeitgeist-dataset-"))
  const destination = join(root, "incident")
  await cp(source, destination, { recursive: true })
  return destination
}

describe("dataset validation", () => {
  it("validates the passing synthetic dataset", async () => {
    const datasets = await run(validateDatasetDirectory(source))
    expect(datasets).toHaveLength(1)
  })

  it("rejects duplicate evidence IDs", async () => {
    const directory = await copyFixture()
    const path = join(directory, "evidence.json")
    const evidence = JSON.parse(await readFile(path, "utf8")) as Array<unknown>
    evidence.push(evidence[0])
    await writeFile(path, JSON.stringify(evidence))
    expect(await failureTag(validateDatasetDirectory(directory))).toBe("DatasetMalformed")
  })

  it("rejects duplicate incident IDs across directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeitgeist-multi-"))
    await cp(source, join(root, "one"), { recursive: true })
    await cp(source, join(root, "two"), { recursive: true })
    expect(await failureTag(validateDatasetDirectory(root))).toBe("DatasetMalformed")
  })

  it("rejects obvious secret-bearing field names without claiming generic detection", async () => {
    const either = await Effect.runPromise(Effect.either(assertNoSecretBearingKeys({ nested: { api_key: "redacted" } }, "test")))
    expect(either._tag === "Left" ? either.left._tag : undefined).toBe("DatasetMalformed")
  })

  it("requires all four dataset artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeitgeist-missing-"))
    await mkdir(join(root, "incident"))
    await writeFile(join(root, "incident", "incident.json"), "{}")
    expect(await failureTag(validateDatasetDirectory(join(root, "incident")))).toBe("DatasetNotFound")
  })
})
const failureTag = async (effect: Effect.Effect<unknown, unknown, NodeContext.NodeContext>): Promise<string | undefined> => {
  const either = await run(Effect.either(effect))
  return either._tag === "Left" && typeof either.left === "object" && either.left !== null && "_tag" in either.left
    ? String(either.left._tag)
    : undefined
}
