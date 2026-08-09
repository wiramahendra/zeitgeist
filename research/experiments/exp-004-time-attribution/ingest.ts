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

const __dirname = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(__dirname, "../../..")

interface ExperimentConfig {
  readonly experimentId: string
  readonly experimentVersion: string
  readonly taskSetPath: string
  readonly resultsDir: string
  readonly runnerIdentity: string
  readonly runnerConfigDigest: string
  readonly modelIdentity: string
  readonly environmentCondition: string
}

interface RunManifestEntry {
  readonly taskId: string
  readonly taskClass: string
  readonly runIndex: number
  readonly cloudAgentBcId: string | null
  readonly transcriptPath: string
  readonly finalStatus?: "SUCCESS" | "TASK_FAILED" | "RUNNER_FAILED" | "PROVIDER_FAILED" | "TIMEOUT" | "INSTRUMENTATION_INVALID"
}

interface RunManifest {
  readonly schemaVersion: "1.0"
  readonly experimentId: string
  readonly frozenRepositoryCommit: string
  readonly environmentCondition: string
  readonly runs: ReadonlyArray<RunManifestEntry>
}

interface TaskSetFile {
  readonly tasks: ReadonlyArray<LiveTaskDefinition & { readonly taskClass: string }>
}

const loadJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T

const getRepositoryCommit = (): string =>
  execSync("git rev-parse HEAD", { cwd: repositoryRoot, encoding: "utf8" }).trim()

const ingest = async (manifestPath: string): Promise<void> => {
  const config = await loadJson<ExperimentConfig>(join(__dirname, "experiment.json"))
  const manifest = await loadJson<RunManifest>(manifestPath)
  const taskSetPath = join(repositoryRoot, config.taskSetPath)
  const taskSetRaw = await readFile(taskSetPath, "utf8")
  const taskSet = JSON.parse(taskSetRaw) as TaskSetFile
  const taskSetDigest = sha256(taskSetRaw)
  const repositoryCommit = manifest.frozenRepositoryCommit || getRepositoryCommit()
  const resultsDir = join(repositoryRoot, config.resultsDir)
  await mkdir(resultsDir, { recursive: true })
  const rawPath = join(resultsDir, "raw.jsonl")

  for (const entry of manifest.runs) {
    const taskDef = taskSet.tasks.find((item) => item.taskId === entry.taskId)
    if (taskDef === undefined) throw new Error(`Unknown taskId: ${entry.taskId}`)
    const task: LiveTaskDefinition = {
      taskId: entry.taskId,
      taskClass: entry.taskClass,
      title: taskDef.title,
      description: taskDef.description,
      workspacePath: taskDef.workspacePath
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
      notes: [
        ...base.notes,
        `condition=${config.environmentCondition}`,
        `runId=${entry.taskId}`,
        `repositoryScope=zeitgeist-monorepo-root`
      ]
    }
    await Effect.runPromise(appendRawResult(rawPath, run))
    console.log(
      `[exp-004] ingested ${entry.taskId} tools=${run.toolCalls.length} wall=${run.durationMs}ms status=${run.finalStatus}`
    )
  }
  console.log(`[exp-004] raw: ${rawPath}`)
}

const manifestPath = process.argv[2]
if (manifestPath === undefined) {
  console.error("Usage: pnpm research:exp-004:ingest <run-manifest.json>")
  process.exitCode = 1
} else {
  ingest(manifestPath).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
