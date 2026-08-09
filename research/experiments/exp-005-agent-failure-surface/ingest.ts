import { mkdir, readFile, writeFile } from "node:fs/promises"
import { cp } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { canonicalize, sha256 } from "../../../src/context/Canonicalize.js"
import {
  parseCloudTranscript,
  transcriptToRawAgentRun,
  type LiveTaskDefinition
} from "../../harness/CloudTranscriptAdapter.js"
import { loadGroundTruth, scoreTaskRun } from "./score.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(__dirname, "../../..")

interface ManifestEntry {
  readonly taskId: string
  readonly taskClass: string
  readonly runIndex: number
  readonly cloudAgentBcId: string | null
  readonly transcriptPath: string
  readonly seedBranch: string
  readonly finalCommitHash?: string
  readonly workspacePath?: string
}

interface RunManifest {
  readonly schemaVersion: "1.0"
  readonly experimentId: string
  readonly frozenRepositoryCommit: string
  readonly environmentCondition: string
  readonly runs: ReadonlyArray<ManifestEntry>
}

interface ExperimentConfig {
  readonly experimentId: string
  readonly experimentVersion: string
  readonly taskSetPath: string
  readonly groundTruthDir: string
  readonly resultsDir: string
  readonly runnerIdentity: string
  readonly runnerConfigDigest: string
  readonly modelIdentity: string
  readonly environmentCondition: string
}

const ingest = async (manifestPath: string): Promise<void> => {
  const config = JSON.parse(await readFile(join(__dirname, "experiment.json"), "utf8")) as ExperimentConfig
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as RunManifest
  const taskSet = JSON.parse(await readFile(join(repositoryRoot, config.taskSetPath), "utf8")) as {
    tasks: ReadonlyArray<LiveTaskDefinition & { taskClass: string; seedBranch: string }>
  }
  const taskSetDigest = sha256(await readFile(join(repositoryRoot, config.taskSetPath), "utf8"))
  const resultsDir = join(repositoryRoot, config.resultsDir)
  await mkdir(resultsDir, { recursive: true })
  await mkdir(join(resultsDir, "transcripts"), { recursive: true })
  const rawPath = join(resultsDir, "raw.jsonl")
  const groundTruthDir = join(repositoryRoot, config.groundTruthDir)
  const byTask: Record<string, unknown> = {}
  let recordsWritten = 0

  for (const entry of manifest.runs) {
    const taskDef = taskSet.tasks.find((task) => task.taskId === entry.taskId)
    if (taskDef === undefined) throw new Error(`Unknown task ${entry.taskId}`)
    const transcriptPath = entry.transcriptPath.startsWith("/")
      ? entry.transcriptPath
      : join(repositoryRoot, entry.transcriptPath)
    const transcriptRaw = await readFile(transcriptPath, "utf8")
    const transcript = parseCloudTranscript(JSON.parse(transcriptRaw) as unknown)
    const transcriptFile = entry.cloudAgentBcId === null ? `${entry.taskId}.json` : `${entry.cloudAgentBcId}.json`
    const archivedTranscriptPath = join(resultsDir, "transcripts", transcriptFile)
    if (resolve(transcriptPath) !== resolve(archivedTranscriptPath)) {
      await cp(transcriptPath, archivedTranscriptPath)
    }
    const base = transcriptToRawAgentRun({
      experimentId: config.experimentId,
      experimentVersion: config.experimentVersion,
      repositoryCommit: manifest.frozenRepositoryCommit,
      taskSetDigest,
      runnerIdentity: "cloud-transcript-adapter/v1",
      runnerConfigDigest: config.runnerConfigDigest,
      modelIdentity: config.modelIdentity,
      task: taskDef,
      runIndex: entry.runIndex,
      transcript,
      cloudAgentBcId: entry.cloudAgentBcId
    })
    const groundTruth = await loadGroundTruth(groundTruthDir, entry.taskId)
    const workspacePath = entry.workspacePath ?? repositoryRoot
    const score = await scoreTaskRun({
      groundTruth,
      rawRun: base,
      workspacePath,
      finalCommitHash: entry.finalCommitHash ?? null
    })
    const record = {
      schemaVersion: "1.0",
      experimentId: config.experimentId,
      experimentVersion: config.experimentVersion,
      repositoryCommit: manifest.frozenRepositoryCommit,
      taskSetDigest,
      runnerIdentity: config.runnerIdentity,
      runnerConfigDigest: config.runnerConfigDigest,
      taskId: entry.taskId,
      taskClass: entry.taskClass,
      runIndex: entry.runIndex,
      cloudAgentBcId: entry.cloudAgentBcId,
      seedBranch: entry.seedBranch,
      finalCommitHash: entry.finalCommitHash ?? score.repositoryTruth.finalCommitHash,
      transcriptPath: join("research/results/exp-005/transcripts", transcriptFile),
      score,
      rawRun: base
    }
    const line = `${canonicalize(record)}\n`
    await writeFile(rawPath, line, { flag: recordsWritten === 0 ? "w" : "a" })
    recordsWritten += 1
    byTask[entry.taskId] = record
    console.log(`[exp-005] ${entry.taskId} outcome=${score.outcome} claimDisagree=${score.claimDisagreement}`)
  }

  await writeFile(join(resultsDir, "by-task.json"), `${canonicalize(byTask)}\n`, "utf8")
  console.log(`[exp-005] raw: ${rawPath}`)
}

const manifestPath = process.argv[2]
if (manifestPath === undefined) {
  console.error("Usage: pnpm research:exp-005:ingest <run-manifest.json>")
  process.exitCode = 1
} else {
  ingest(manifestPath).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
