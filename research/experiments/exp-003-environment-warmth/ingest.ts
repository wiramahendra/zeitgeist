import { execSync } from "node:child_process"
import { mkdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { sha256 } from "../../../src/context/Canonicalize.js"
import { appendRawResult } from "../../harness/AgentRunner.js"
import {
  parseCloudTranscript,
  transcriptToRawAgentRun,
  type LiveTaskDefinition
} from "../../harness/CloudTranscriptAdapter.js"
import type { EnvironmentCondition } from "../../workloads/Exp003Conditions.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(__dirname, "../../..")

interface ManifestEntry {
  readonly runId: string
  readonly taskId: string
  readonly taskClass: string
  readonly condition: EnvironmentCondition
  readonly runIndex: number
  readonly cloudAgentBcId: string | null
  readonly transcriptPath: string
  readonly finalStatus?: "SUCCESS" | "TASK_FAILED" | "RUNNER_FAILED" | "PROVIDER_FAILED" | "TIMEOUT" | "INSTRUMENTATION_INVALID"
}

interface RunManifest {
  readonly schemaVersion: "1.0"
  readonly experimentId: string
  readonly runs: ReadonlyArray<ManifestEntry>
}

const getRepositoryCommit = (): string =>
  execSync("git rev-parse HEAD", { cwd: repositoryRoot, encoding: "utf8" }).trim()

const ingest = async (manifestPath: string): Promise<void> => {
  const config = JSON.parse(await readFile(join(__dirname, "experiment.json"), "utf8")) as {
    experimentId: string
    experimentVersion: string
    taskSetPath: string
    resultsDir: string
    runnerIdentity: string
    runnerConfigDigest: string
    modelIdentity: string
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as RunManifest
  const taskSetRaw = await readFile(join(repositoryRoot, config.taskSetPath), "utf8")
  const taskSet = JSON.parse(taskSetRaw) as { tasks: ReadonlyArray<{ taskId: string; taskClass: string; title: string; description: string; fixturePath: string }> }
  const taskSetDigest = sha256(taskSetRaw)
  const repositoryCommit = getRepositoryCommit()
  const resultsDir = join(repositoryRoot, config.resultsDir)
  await mkdir(resultsDir, { recursive: true })
  const rawPath = join(resultsDir, "raw.jsonl")

  for (const entry of manifest.runs) {
    const taskDef = taskSet.tasks.find((t) => t.taskId === entry.taskId)
    if (taskDef === undefined) throw new Error(`Unknown task ${entry.taskId}`)
    const task: LiveTaskDefinition = {
      taskId: entry.taskId,
      taskClass: entry.taskClass,
      title: taskDef.title,
      description: taskDef.description,
      workspacePath: `research/workloads/exp-003-runs/${entry.runId}`
    }
    const transcript = parseCloudTranscript(JSON.parse(await readFile(entry.transcriptPath, "utf8")) as unknown)
    const base = transcriptToRawAgentRun({
      experimentId: config.experimentId,
      experimentVersion: config.experimentVersion,
      repositoryCommit,
      taskSetDigest,
      runnerIdentity: config.runnerIdentity,
      runnerConfigDigest: config.runnerConfigDigest,
      modelIdentity: config.modelIdentity,
      task,
      runIndex: entry.runIndex,
      transcript,
      cloudAgentBcId: entry.cloudAgentBcId,
      ...(entry.finalStatus === undefined ? {} : { finalStatus: entry.finalStatus })
    })
    const run = {
      ...base,
      notes: [...base.notes, `condition=${entry.condition}`, `runId=${entry.runId}`]
    }
    await Effect.runPromise(appendRawResult(rawPath, run))
    console.log(`[exp-003] ingested ${entry.runId} condition=${entry.condition} tools=${run.toolCalls.length} wall=${run.durationMs}ms`)
  }
  console.log(`[exp-003] raw: ${rawPath}`)
}

const manifestPath = process.argv[2]
if (manifestPath === undefined) {
  console.error("Usage: pnpm research:exp-003:ingest <manifest.json>")
  process.exitCode = 1
} else {
  ingest(manifestPath).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
