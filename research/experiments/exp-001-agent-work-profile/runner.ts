import { execSync } from "node:child_process"
import { mkdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { sha256 } from "../../../src/context/Canonicalize.js"
import { appendRawResult } from "../../harness/AgentRunner.js"
import { computeRunMetrics } from "../../harness/Metrics.js"
import { normalizeAgentRun } from "../../harness/TraceNormalizer.js"
import { isTaskSet, type TaskSet } from "../../workloads/Task.js"
import { makeInstrumentedWorkloadRunner, RUNNER_CONFIG } from "../../workloads/InstrumentedWorkloadRunner.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(__dirname, "../../..")

interface ExperimentConfig {
  readonly experimentId: string
  readonly experimentVersion: string
  readonly taskSetPath: string
  readonly resultsDir: string
  readonly modelIdentity: string
  readonly smokeTaskCount: number
}

const loadJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T

const getRepositoryCommit = (): string =>
  execSync("git rev-parse HEAD", { cwd: repositoryRoot, encoding: "utf8" }).trim()

const runExperiment = async (): Promise<void> => {
  const config = await loadJson<ExperimentConfig>(join(__dirname, "experiment.json"))
  const taskSetPath = join(repositoryRoot, config.taskSetPath)
  const taskSetRaw = await readFile(taskSetPath, "utf8")
  const taskSet = JSON.parse(taskSetRaw) as TaskSet
  if (!isTaskSet(taskSet)) {
    throw new Error("Invalid task set")
  }
  const taskSetDigest = sha256(taskSetRaw)
  const repositoryCommit = getRepositoryCommit()
  const resultsDir = join(repositoryRoot, config.resultsDir)
  await mkdir(resultsDir, { recursive: true })
  const rawPath = join(resultsDir, "raw.jsonl")

  const runner = makeInstrumentedWorkloadRunner(config.modelIdentity)
  const tasks = taskSet.tasks.slice(0, config.smokeTaskCount)

  for (const [runIndex, task] of tasks.entries()) {
    const result = await Effect.runPromise(
      runner.runTask({
        repositoryRoot,
        experimentId: config.experimentId,
        experimentVersion: config.experimentVersion,
        repositoryCommit,
        taskSetDigest,
        runner: {
          identity: RUNNER_CONFIG.identity,
          configDigest: RUNNER_CONFIG.configDigest,
          modelIdentity: config.modelIdentity
        },
        taskId: task.taskId,
        taskClass: task.taskClass,
        runIndex
      })
    )
    await Effect.runPromise(appendRawResult(rawPath, result))
    const metrics = computeRunMetrics(normalizeAgentRun(result))
    console.log(
      `[exp-001] ${task.taskId} status=${result.finalStatus} durationMs=${result.durationMs} toolCalls=${metrics.toolCallCount} deterministicToolMs=${metrics.deterministicToolDurationMs}`
    )
  }

  console.log(`[exp-001] raw results: ${rawPath}`)
  console.log(`[exp-001] taskSetDigest=${taskSetDigest}`)
  console.log(`[exp-001] repositoryCommit=${repositoryCommit}`)
}

runExperiment().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
