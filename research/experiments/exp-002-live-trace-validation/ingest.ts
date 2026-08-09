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
}

interface RunManifestEntry {
  readonly taskId: string
  readonly runIndex: number
  readonly cloudAgentBcId: string | null
  readonly transcriptPath: string
  readonly finalStatus?: "SUCCESS" | "TASK_FAILED" | "RUNNER_FAILED" | "PROVIDER_FAILED" | "TIMEOUT" | "INSTRUMENTATION_INVALID"
}

interface RunManifest {
  readonly schemaVersion: "1.0"
  readonly experimentId: string
  readonly runs: ReadonlyArray<RunManifestEntry>
}

interface TaskSetFile {
  readonly tasks: ReadonlyArray<LiveTaskDefinition>
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
  const repositoryCommit = getRepositoryCommit()
  const resultsDir = join(repositoryRoot, config.resultsDir)
  await mkdir(resultsDir, { recursive: true })
  const rawPath = join(resultsDir, "raw.jsonl")

  for (const entry of manifest.runs) {
    const task = taskSet.tasks.find((item) => item.taskId === entry.taskId)
    if (task === undefined) {
      throw new Error(`Unknown taskId in manifest: ${entry.taskId}`)
    }
    const transcriptRaw = await readFile(entry.transcriptPath, "utf8")
    const transcript = parseCloudTranscript(JSON.parse(transcriptRaw) as unknown)
    const run = transcriptToRawAgentRun({
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
    await Effect.runPromise(appendRawResult(rawPath, run))
    console.log(
      `[exp-002] ingested ${entry.taskId} toolCalls=${run.toolCalls.length} durationMs=${run.durationMs} status=${run.finalStatus}`
    )
  }

  console.log(`[exp-002] raw results: ${rawPath}`)
}

const manifestPath = process.argv[2]
if (manifestPath === undefined) {
  console.error("Usage: pnpm research:exp-002:ingest <run-manifest.json>")
  process.exitCode = 1
} else {
  ingest(manifestPath).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
