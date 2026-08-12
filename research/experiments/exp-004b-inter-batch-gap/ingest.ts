import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { canonicalize, sha256 } from "../../../src/context/Canonicalize.js"
import {
  parseCloudTranscript,
  transcriptToRawAgentRun,
  type LiveTaskDefinition
} from "../../harness/CloudTranscriptAdapter.js"
import { buildGapAttributionRunRecord, buildTelemetryCapabilityAudit } from "../../harness/GapAttribution.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(__dirname, "../../..")

interface ExperimentConfig {
  readonly experimentId: string
  readonly experimentVersion: string
  readonly taskSetPath: string
  readonly resultsDir: string
  readonly sourceTranscriptDir: string
  readonly sourceRunManifest: string
  readonly runnerIdentity: string
  readonly runnerConfigDigest: string
  readonly modelIdentity: string
  readonly environmentCondition: string
  readonly newLiveRunsPerformed: number
}

interface SourceRunManifestEntry {
  readonly taskId: string
  readonly taskClass: string
  readonly runIndex: number
  readonly cloudAgentBcId: string | null
  readonly transcriptPath: string
}

interface SourceRunManifest {
  readonly frozenRepositoryCommit: string
  readonly environmentCondition: string
  readonly runs: ReadonlyArray<SourceRunManifestEntry>
}

interface TaskSetFile {
  readonly tasks: ReadonlyArray<LiveTaskDefinition & { readonly taskClass: string }>
}

export interface GapAttributionRawRecord {
  readonly schemaVersion: "1.0"
  readonly experimentId: string
  readonly experimentVersion: string
  readonly repositoryCommit: string
  readonly taskSetDigest: string
  readonly runnerIdentity: string
  readonly runnerConfigDigest: string
  readonly modelIdentity: string
  readonly environmentCondition: string
  readonly taskId: string
  readonly taskClass: string
  readonly runIndex: number
  readonly cloudAgentBcId: string | null
  readonly transcriptPath: string
  readonly transcriptSha256: string
  readonly eventsSha256: string | null
  readonly finalStatus: string
  readonly newLiveRun: boolean
  readonly gapAttribution: ReturnType<typeof buildGapAttributionRunRecord>["gapAttribution"]
  readonly exp004InterBatchGapMs: number
}

const loadJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T

const ingest = async (): Promise<void> => {
  const config = await loadJson<ExperimentConfig>(join(__dirname, "experiment.json"))
  const sourceManifest = await loadJson<SourceRunManifest>(join(repositoryRoot, config.sourceRunManifest))
  const taskSetPath = join(repositoryRoot, config.taskSetPath)
  const taskSetRaw = await readFile(taskSetPath, "utf8")
  const taskSet = JSON.parse(taskSetRaw) as TaskSetFile
  const taskSetDigest = sha256(taskSetRaw)
  const repositoryCommit = sourceManifest.frozenRepositoryCommit
  const resultsDir = join(repositoryRoot, config.resultsDir)
  await mkdir(resultsDir, { recursive: true })
  const rawPath = join(resultsDir, "raw.jsonl")
  const lines: Array<string> = []
  const checksumLines: Array<string> = []

  for (const entry of sourceManifest.runs) {
    const taskDef = taskSet.tasks.find((item) => item.taskId === entry.taskId)
    if (taskDef === undefined) throw new Error(`Unknown taskId: ${entry.taskId}`)
    const transcriptFileName =
      entry.cloudAgentBcId === null ? `${entry.taskId}.json` : `${entry.cloudAgentBcId}.json`
    const transcriptPath = join(repositoryRoot, config.sourceTranscriptDir, transcriptFileName)
    const transcriptRaw = await readFile(transcriptPath, "utf8")
    const transcript = parseCloudTranscript(JSON.parse(transcriptRaw) as unknown)
    const task: LiveTaskDefinition = {
      taskId: entry.taskId,
      taskClass: entry.taskClass,
      title: taskDef.title,
      description: taskDef.description,
      workspacePath: taskDef.workspacePath
    }
    const rawRun = transcriptToRawAgentRun({
      experimentId: "EXP-004",
      experimentVersion: "1.0.0",
      repositoryCommit,
      taskSetDigest,
      runnerIdentity: "cloud-transcript-adapter/v1",
      runnerConfigDigest: "a4c8e2f1b9d63e0a7f5c2b8d1e4a6c9f3b5d7e2a1c4b8d0e3f6a9c2b5d8e2f1",
      modelIdentity: config.modelIdentity,
      task,
      runIndex: entry.runIndex,
      transcript,
      cloudAgentBcId: entry.cloudAgentBcId,
      finalStatus: "SUCCESS"
    })
    const record = buildGapAttributionRunRecord(rawRun, transcript, entry.cloudAgentBcId)
    const transcriptSha256 = sha256(transcriptRaw)
    checksumLines.push(`${transcriptSha256}  transcripts/${transcriptFileName}`)
    const rawRecord: GapAttributionRawRecord = {
      schemaVersion: "1.0",
      experimentId: config.experimentId,
      experimentVersion: config.experimentVersion,
      repositoryCommit,
      taskSetDigest,
      runnerIdentity: config.runnerIdentity,
      runnerConfigDigest: config.runnerConfigDigest,
      modelIdentity: config.modelIdentity,
      environmentCondition: config.environmentCondition,
      taskId: entry.taskId,
      taskClass: entry.taskClass,
      runIndex: entry.runIndex,
      cloudAgentBcId: entry.cloudAgentBcId,
      transcriptPath: join(config.sourceTranscriptDir, transcriptFileName),
      transcriptSha256,
      eventsSha256: null,
      finalStatus: rawRun.finalStatus,
      newLiveRun: false,
      gapAttribution: record.gapAttribution,
      exp004InterBatchGapMs: record.exp004InterBatchGapMs
    }
    lines.push(canonicalize(rawRecord))
    console.log(
      `[exp-004b] ${entry.taskId} gaps=${record.gapAttribution.gapCount} gapMs=${record.gapAttribution.interBatchGapMs} attributableShare=${record.gapAttribution.attributableShare.toFixed(3)}`
    )
  }

  await writeFile(rawPath, `${lines.join("\n")}\n`, "utf8")
  await writeFile(join(resultsDir, "transcript-checksums.sha256"), `${checksumLines.join("\n")}\n`, "utf8")
  await writeFile(
    join(resultsDir, "event-checksums.sha256"),
    "# Cloud run events unavailable or empty for all EXP-004 source agents; no event files checksummed.\n",
    "utf8"
  )

  const manifest = {
    schemaVersion: "1.0",
    experimentId: config.experimentId,
    frozenRepositoryCommit: repositoryCommit,
    environmentCondition: config.environmentCondition,
    sourceExperiment: "EXP-004",
    newLiveRunsPerformed: config.newLiveRunsPerformed,
    telemetryAudit: buildTelemetryCapabilityAudit(false),
    runs: sourceManifest.runs.map((entry) => ({
      taskId: entry.taskId,
      taskClass: entry.taskClass,
      runIndex: entry.runIndex,
      cloudAgentBcId: entry.cloudAgentBcId,
      transcriptPath: join(config.sourceTranscriptDir, `${entry.cloudAgentBcId}.json`),
      newLiveRun: false
    }))
  }
  await writeFile(join(resultsDir, "run-manifest.json"), `${canonicalize(manifest)}\n`, "utf8")
  console.log(`[exp-004b] raw: ${rawPath}`)
}

ingest().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
