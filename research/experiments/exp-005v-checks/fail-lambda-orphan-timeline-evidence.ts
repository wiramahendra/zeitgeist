import { readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { Effect } from "effect"

const main = async (): Promise<void> => {
  const root = process.cwd()
  const { validateContext } = await import(pathToFileURL(join(root, "src/context/ContextValidator.js")).href)

  const context = JSON.parse(readFileSync(join(root, "fixtures/synthetic-example/context.json"), "utf8"))
  const evidence = JSON.parse(readFileSync(join(root, "fixtures/synthetic-example/evidence.json"), "utf8"))
  const mutated = structuredClone(context) as typeof context
  mutated.timeline[0].evidenceIds = ["ev-nonexistent-999"]
  try {
    await Effect.runPromise(validateContext(mutated, evidence))
    throw new Error("validateContext should reject orphan evidence IDs")
  } catch (error) {
    if (error instanceof Error && error.message === "validateContext should reject orphan evidence IDs") throw error
  }
  console.log("PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
