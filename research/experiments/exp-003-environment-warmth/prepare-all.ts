import { writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { canonicalize } from "../../../src/context/Canonicalize.js"
import { buildRunMatrix } from "../../workloads/Exp003Conditions.js"
import { loadTaskSet, prepareWorkspace } from "./prepare-condition.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(__dirname, "../../..")

const main = async (): Promise<void> => {
  const tasks = await loadTaskSet(repositoryRoot)
  const runs = buildRunMatrix(tasks)
  for (const run of runs) {
    await Effect.runPromise(prepareWorkspace(repositoryRoot, tasks.find((t) => t.taskId === run.taskId)!, run.condition, run.workspacePath))
    console.log(`[exp-003] prepared ${run.runId} (${run.condition}) -> ${run.workspacePath}`)
  }
  const matrixPath = join(repositoryRoot, "research/results/exp-003/run-matrix.json")
  await writeFile(matrixPath, canonicalize({ schemaVersion: "1.0", runs }), "utf8")
  console.log(`[exp-003] run matrix: ${matrixPath} (${runs.length} runs)`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
