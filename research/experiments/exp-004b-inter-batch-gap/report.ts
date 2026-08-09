import { execSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { canonicalize, sha256 } from "../../../src/context/Canonicalize.js"
import {
  aggregateGapCategoryMs,
  buildTelemetryCapabilityAudit,
  decideExp004b,
  detectDominantGapCause,
  GAP_ATTRIBUTION_CATEGORIES,
  type Exp004bDecision,
  type GapAttributionRunRecord
} from "../../harness/GapAttribution.js"
import type { GapAttributionRawRecord } from "./ingest.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(__dirname, "../../..")

interface ExperimentConfig {
  readonly experimentId: string
  readonly experimentVersion: string
  readonly taskSetPath: string
  readonly resultsDir: string
  readonly modelIdentity: string
  readonly environmentCondition: string
  readonly parentExperimentId: string
  readonly taskCount: number
  readonly newLiveRunsPerformed: number
  readonly attributionThreshold: {
    readonly minAttributableShare: number
    readonly minDominantShare: number
    readonly minTaskClasses: number
  }
}

const median = (values: ReadonlyArray<number>): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

const toRunRecords = (rawRecords: ReadonlyArray<GapAttributionRawRecord>): ReadonlyArray<GapAttributionRunRecord> =>
  rawRecords.map((record) => ({
    taskId: record.taskId,
    taskClass: record.taskClass,
    finalStatus: record.finalStatus as GapAttributionRunRecord["finalStatus"],
    cloudAgentBcId: record.cloudAgentBcId,
    interBatchGapMs: record.gapAttribution.interBatchGapMs,
    gapAttribution: record.gapAttribution,
    exp004InterBatchGapMs: record.exp004InterBatchGapMs
  }))

const generateReport = async (): Promise<void> => {
  const config = JSON.parse(await readFile(join(__dirname, "experiment.json"), "utf8")) as ExperimentConfig
  const taskSet = JSON.parse(await readFile(join(repositoryRoot, config.taskSetPath), "utf8")) as {
    tasks: ReadonlyArray<{ taskId: string; taskClass: string; title: string }>
  }
  const resultsDir = join(repositoryRoot, config.resultsDir)
  const rawPath = join(resultsDir, "raw.jsonl")
  const reportPath = join(resultsDir, "report.md")
  const summaryPath = join(resultsDir, "summary.json")
  const rawContents = await readFile(rawPath, "utf8")
  const rawRecords = rawContents
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as GapAttributionRawRecord)
  const records = toRunRecords(rawRecords)
  const telemetryAudit = buildTelemetryCapabilityAudit(false)
  const decision: Exp004bDecision = decideExp004b(records, config.attributionThreshold)
  const dominant = detectDominantGapCause(records, {
    minShare: config.attributionThreshold.minDominantShare,
    minTaskClasses: config.attributionThreshold.minTaskClasses
  })

  const totalGapMs = records.reduce((total, record) => total + record.gapAttribution.interBatchGapMs, 0)
  const categoryTotals = aggregateGapCategoryMs(records)
  const totalAttributableMs = totalGapMs - categoryTotals.UNATTRIBUTED
  const attributableShare = totalGapMs === 0 ? 0 : totalAttributableMs / totalGapMs

  const perCategoryLines = GAP_ATTRIBUTION_CATEGORIES.map((category) => {
    const ms = categoryTotals[category]
    const share = totalGapMs === 0 ? 0 : ms / totalGapMs
    return `${category}: total=${ms}ms share=${share.toFixed(4)} medianRunShare=${median(records.map((record) => record.gapAttribution.categoryShare[category])) ?? "n/a"}`
  }).join("\n")

  const perRunLines = records
    .map((record) => {
      const gap = record.gapAttribution
      return `${record.taskId} ${record.taskClass} gapMs=${gap.interBatchGapMs} gapCount=${gap.gapCount} attributableShare=${gap.attributableShare.toFixed(3)} UNATTRIBUTED=${gap.categoryMs.UNATTRIBUTED} toolResultProcessing=${gap.categoryMs.tool_result_context_processing} exp004Gap=${record.exp004InterBatchGapMs}`
    })
    .join("\n")

  const taskClassTotals = [...new Set(records.map((record) => record.taskClass))].map((taskClass) => {
    const classRecords = records.filter((record) => record.taskClass === taskClass)
    const classGap = classRecords.reduce((total, record) => total + record.gapAttribution.interBatchGapMs, 0)
    const classUnattributed = classRecords.reduce(
      (total, record) => total + record.gapAttribution.categoryMs.UNATTRIBUTED,
      0
    )
    return `${taskClass}: runs=${classRecords.length} gapMs=${classGap} unattributedMs=${classUnattributed} unattributedShare=${classGap === 0 ? "n/a" : (classUnattributed / classGap).toFixed(3)}`
  }).join("\n")

  const telemetryLines = telemetryAudit.transcriptMessageFields
    .map(
      (field) =>
        `${field.field}: available=${field.available} causal=${field.supportsCausalAttribution} — ${field.notes}`
    )
    .join("\n")

  const branch = execSync("git branch --show-current", { cwd: repositoryRoot, encoding: "utf8" }).trim()
  const head = execSync("git rev-parse HEAD", { cwd: repositoryRoot, encoding: "utf8" }).trim()

  const reportBody = `EXP-004b REPORT: INTER-BATCH GAP ATTRIBUTION

DECISION: ${decision}

BRANCH: ${branch}
HEAD: ${head}
PARENT EXPERIMENT: ${config.parentExperimentId}
FROZEN REPOSITORY COMMIT: ${rawRecords[0]?.repositoryCommit ?? "unknown"}
MODEL: ${config.modelIdentity}
RUNNER: gap-attribution/v1 (reuses EXP-004 transcripts)
ENVIRONMENT: ${config.environmentCondition}

EXPERIMENT IDENTITY
Experiment: ${config.experimentId} v${config.experimentVersion}
New live runs performed: ${config.newLiveRunsPerformed} (telemetry audit showed identical schema across all 10 EXP-004 transcripts; re-analysis only)
Source transcripts: research/results/exp-004/transcripts/*.json
Cloud run events: empty for sampled EXP-004 bcIds (bc-67372411, bc-e4cf0f9e)

TELEMETRY CAPABILITY AUDIT
${telemetryLines}
Cloud events API per-run events: unavailable for gap decomposition (count=0 on fetched EXP-004 agents)
Directly attributable gap categories supported by schema: tool_result_context_processing (only when tool result completed_at_ms exceeds batch end; observed 0ms in all 10 runs), other_observable_runtime (none observed)
Cannot attribute without inferring: model_provider_latency, agent_model_processing, harness_scheduling

RUNS PERFORMED
${taskSet.tasks.map((task) => `${task.taskId} ${task.taskClass}`).join("\n")}
Successes: ${records.filter((record) => record.finalStatus === "SUCCESS").length}/${records.length}

TOTAL GAP TIME
Total inter-batch gap (all runs): ${totalGapMs}ms
EXP-004 aggregate inter-batch gap reference: 191054ms (62.3% of EXP-004 wall-clock)
Median inter-batch gap per run: ${median(records.map((record) => record.gapAttribution.interBatchGapMs)) ?? "n/a"}ms

ATTRIBUTED VS UNATTRIBUTED
Total directly attributable gap time: ${totalAttributableMs}ms (${(attributableShare * 100).toFixed(1)}%)
Total UNATTRIBUTED gap time: ${categoryTotals.UNATTRIBUTED}ms (${totalGapMs === 0 ? "n/a" : ((categoryTotals.UNATTRIBUTED / totalGapMs) * 100).toFixed(1)}%)
Attribution threshold for valid experiment: >=${(config.attributionThreshold.minAttributableShare * 100).toFixed(0)}% directly attributable

PER-CATEGORY ATTRIBUTION (aggregate)
${perCategoryLines}

PER-RUN ATTRIBUTION
${perRunLines}

VARIANCE BY TASK CLASS
${taskClassTotals}

DOMINANT RECURRING CAUSE
${dominant === null ? "None proven — no attributable category reached >=50% median share across >=3 task classes." : `${dominant.category}: medianShare=${dominant.medianShare.toFixed(3)} runs=${dominant.runCount} classes=${dominant.taskClasses.join(",")}`}

THREATS TO VALIDITY
Re-analysis of EXP-004 transcripts only; no new instrumentation timestamps added between EXP-004 and EXP-004b
Transcript wall-clock span excludes pre-first-tool and post-last-tool session time
Assistant thinking/text exists between batches but lacks timestamps; presence of text must not be treated as evidence of deliberation duration
Cloud run events may exist for other agents but were empty for audited EXP-004 bcIds
Parallel tool batches collapse to batch boundaries; intra-gap sub-phases are unobservable

ARTIFACTS / CHECKSUMS
research/results/exp-004b/raw.jsonl sha256 ${sha256(rawContents)}
research/results/exp-004b/summary.json
research/results/exp-004b/report.md
research/results/exp-004b/run-manifest.json
research/results/exp-004b/transcript-checksums.sha256
research/results/exp-004b/event-checksums.sha256

NO OPTIMIZATION IMPLEMENTED

RECOMMENDED NEXT EXPERIMENT
EXP-005 (instrumentation): add native per-turn timestamps to cloud transcript export — model request start/end, assistant message emission, and harness scheduling markers — then re-run inter-batch gap attribution on 5–10 live C_WARM_WORKSPACE sessions. Without those timestamps, gap cause decomposition cannot exceed INVALID.
`

  const summary = {
    schemaVersion: "1.0",
    experimentId: config.experimentId,
    experimentVersion: config.experimentVersion,
    decision,
    parentExperimentId: config.parentExperimentId,
    newLiveRunsPerformed: config.newLiveRunsPerformed,
    runCount: records.length,
    aggregate: {
      totalInterBatchGapMs: totalGapMs,
      totalAttributableMs,
      totalUnattributedMs: categoryTotals.UNATTRIBUTED,
      attributableShare,
      categoryMs: categoryTotals
    },
    dominantCause: dominant,
    telemetryAudit,
    checksums: { raw: sha256(rawContents), report: sha256(reportBody) }
  }

  await writeFile(reportPath, reportBody, "utf8")
  await writeFile(summaryPath, canonicalize(summary), "utf8")
  console.log(`[exp-004b] decision=${decision}`)
  console.log(`[exp-004b] attributableShare=${attributableShare.toFixed(3)}`)
  console.log(`[exp-004b] report: ${reportPath}`)
}

generateReport().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
