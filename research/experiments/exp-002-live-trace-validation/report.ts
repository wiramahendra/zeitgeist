import { execSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { canonicalize, sha256 } from "../../../src/context/Canonicalize.js"
import { readRawResultsJsonl } from "../../harness/AgentRunner.js"
import type { ExperimentDecision, RunMetrics, ToolCategory } from "../../harness/AgentRun.js"
import {
  computeAggregateMetrics,
  computeRunMetrics,
  rankCategoriesByDuration
} from "../../harness/Metrics.js"
import { normalizeAgentRun } from "../../harness/TraceNormalizer.js"
import type { LiveTaskDefinition } from "../../harness/CloudTranscriptAdapter.js"

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
  readonly signalThreshold: {
    readonly minWallClockShare: number
    readonly minToolActivityShare: number
    readonly minRuns: number
    readonly minTaskClasses: number
  }
}

interface SignalCandidate {
  readonly category: ToolCategory
  readonly wallClockShare: number
  readonly toolActivityShare: number
  readonly runCount: number
  readonly taskClasses: ReadonlyArray<string>
}

const loadJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T

const gitInfo = () => ({
  branch: execSync("git branch --show-current", { cwd: repositoryRoot, encoding: "utf8" }).trim(),
  head: execSync("git rev-parse HEAD", { cwd: repositoryRoot, encoding: "utf8" }).trim()
})

const evaluateSignals = (
  perTaskMetrics: ReadonlyArray<RunMetrics>,
  threshold: ExperimentConfig["signalThreshold"]
): ReadonlyArray<SignalCandidate> => {
  const totalWall = perTaskMetrics.reduce((sum, metric) => sum + metric.durationMs, 0)
  const totalDeterministic = perTaskMetrics.reduce((sum, metric) => sum + metric.deterministicToolDurationMs, 0)
  const totals: Record<ToolCategory, number> = Object.fromEntries(
    perTaskMetrics[0] === undefined
      ? []
      : (Object.keys(perTaskMetrics[0].categoryDurationMs) as Array<ToolCategory>).map((category) => [
          category,
          perTaskMetrics.reduce((sum, metric) => sum + metric.categoryDurationMs[category], 0)
        ])
  ) as Record<ToolCategory, number>

  return rankCategoriesByDuration(totals)
    .map((entry) => {
      const runsWithCategory = perTaskMetrics.filter((metric) => metric.categoryDurationMs[entry.category] > 0)
      const taskClasses = [...new Set(runsWithCategory.map((metric) => metric.taskClass))]
      return {
        category: entry.category,
        wallClockShare: totalWall === 0 ? 0 : entry.durationMs / totalWall,
        toolActivityShare: totalDeterministic === 0 ? 0 : entry.durationMs / totalDeterministic,
        runCount: runsWithCategory.length,
        taskClasses
      }
    })
    .filter(
      (candidate) =>
        (candidate.wallClockShare >= threshold.minWallClockShare ||
          candidate.toolActivityShare >= threshold.minToolActivityShare) &&
        candidate.runCount >= threshold.minRuns &&
        candidate.taskClasses.length >= threshold.minTaskClasses
    )
}

const decide = (
  candidates: ReadonlyArray<SignalCandidate>,
  runCount: number,
  expectedCount: number
): ExperimentDecision => {
  if (runCount < expectedCount) return "BLOCKED"
  if (runCount === 0) return "BLOCKED"
  if (candidates.length === 0) return "NO_SIGNAL"
  const strong = candidates.some(
    (candidate) =>
      candidate.wallClockShare >= 0.2 &&
      candidate.toolActivityShare >= 0.25 &&
      candidate.runCount >= 3 &&
      candidate.taskClasses.length >= 2
  )
  if (strong) return "STRONG_SIGNAL"
  return "REPLICATE"
}

const formatPerTaskList = (metrics: ReadonlyArray<RunMetrics>): string =>
  metrics
    .map((metric) => {
      const top = rankCategoriesByDuration(metric.categoryDurationMs)[0]
      return `- **${metric.taskId}** (${metric.taskClass}, ${metric.finalStatus}): wall-clock ${metric.durationMs} ms, deterministic ${metric.deterministicToolDurationMs} ms, ${metric.toolCallCount} tool calls, top category ${top?.category ?? "none"} (${top?.durationMs ?? 0} ms), duplicate read ratio ${metric.duplicateFileReadRatio ?? "n/a"}, repeated tests ${metric.repeatedTestRunCount}`
    })
    .join("\n")

const formatCategoryList = (aggregate: ReturnType<typeof computeAggregateMetrics>): string =>
  rankCategoriesByDuration(aggregate.categoryDurationTotalsMs)
    .map((entry, index) => {
      const median = aggregate.categoryDurationMediansMs[entry.category]
      return `${index + 1}. **${entry.category}** — ${entry.durationMs} ms total${median === null ? "" : `, ${median} ms median per run`}`
    })
    .join("\n")

const formatCandidates = (candidates: ReadonlyArray<SignalCandidate>): string =>
  candidates.length === 0
    ? "- No category met the preregistered threshold."
    : candidates
        .map(
          (candidate) =>
            `- **${candidate.category}**: wall-clock share ${(candidate.wallClockShare * 100).toFixed(1)}%, tool-activity share ${(candidate.toolActivityShare * 100).toFixed(1)}%, observed in ${candidate.runCount}/5 runs across classes ${candidate.taskClasses.join(", ")}`
        )
        .join("\n")

const generateReport = async (): Promise<void> => {
  const config = await loadJson<ExperimentConfig>(join(__dirname, "experiment.json"))
  const taskSetPath = join(repositoryRoot, config.taskSetPath)
  const taskSetRaw = await readFile(taskSetPath, "utf8")
  const taskSet = JSON.parse(taskSetRaw) as { tasks: ReadonlyArray<LiveTaskDefinition> }
  const taskSetDigest = sha256(taskSetRaw)
  const resultsDir = join(repositoryRoot, config.resultsDir)
  const rawPath = join(resultsDir, "raw.jsonl")
  const summaryPath = join(resultsDir, "summary.json")
  const reportPath = join(resultsDir, "report.md")

  const rawContents = await readFile(rawPath, "utf8")
  const runs = await Effect.runPromise(readRawResultsJsonl(rawPath))
  const perTaskMetrics = runs.map((run) => computeRunMetrics(normalizeAgentRun(run)))
  const expectedTaskIds = taskSet.tasks.map((task) => task.taskId)
  const aggregate = computeAggregateMetrics(perTaskMetrics, expectedTaskIds)
  const candidates = evaluateSignals(perTaskMetrics, config.signalThreshold)
  const decision = decide(candidates, perTaskMetrics.length, expectedTaskIds.length)
  const git = gitInfo()
  const ranked = rankCategoriesByDuration(aggregate.categoryDurationTotalsMs)

  const summaryOutput = {
    schemaVersion: "1.0" as const,
    experimentId: config.experimentId,
    experimentVersion: config.experimentVersion,
    repositoryCommit: runs[0]?.repositoryCommit ?? "",
    taskSetDigest,
    runnerIdentity: config.runnerIdentity,
    runnerConfigDigest: config.runnerConfigDigest,
    modelIdentity: config.modelIdentity,
    decision,
    incomplete: aggregate.incomplete,
    signalCandidates: candidates,
    aggregate,
    checksums: {
      raw: sha256(rawContents),
      summary: "",
      report: ""
    }
  }

  const reportBody = `# EXP-002 Report: Live Coding-Agent Trace Validation

## Executive summary

Live cloud-agent transcripts were ingested for ${aggregate.runCount}/${expectedTaskIds.length} frozen tasks. The agent solved tasks naturally without a prescribed tool sequence. Decision: **${decision}**.

## Experiment identity

- Experiment: ${config.experimentId} v${config.experimentVersion}
- Repository commit: ${runs[0]?.repositoryCommit ?? "unknown"}
- Task set digest: ${taskSetDigest}
- Runner: ${config.runnerIdentity}
- Model identity: ${config.modelIdentity}
- Branch: ${git.branch}
- HEAD: ${git.head}

## Five frozen tasks

${taskSet.tasks.map((task) => `- ${task.taskId} (${task.taskClass}): ${task.title}`).join("\n")}

## Instrumentation changes

Added \`research/harness/CloudTranscriptAdapter.ts\` — minimum adapter from native \`transcript.json\` tool-call messages into existing RawAgentRun / metrics pipeline. No simulated workload runner used.

## Available telemetry

- Native tool sequence, per-tool duration, command/path args (when present), exit status, stdout bytes (terminal commands), file read/write paths, model turn count (user messages), wall-clock span from first to last tool call.

## Unavailable telemetry

- Input tokens, output tokens, model request latency — not exposed in cloud transcript schema; recorded as unavailable.

## Per-run results

${formatPerTaskList(perTaskMetrics)}

## Aggregate tool breakdown

${formatCategoryList(aggregate)}

- Median wall-clock: ${aggregate.medianDurationMs ?? "n/a"} ms
- Median deterministic tool time: ${aggregate.medianDeterministicToolDurationMs ?? "n/a"} ms
- Total tool calls: ${aggregate.totalToolCalls}

## Repeated-work findings

- Runs with duplicate file reads: ${perTaskMetrics.filter((metric) => (metric.duplicateFileReadRatio ?? 0) > 0).length}
- Runs with repeated test commands: ${perTaskMetrics.filter((metric) => metric.repeatedTestRunCount > 0).length}
- Runs with repeated searches: ${perTaskMetrics.filter((metric) => (metric.repeatedSearchRatio ?? 0) > 0).length}

## Failures and retries

- Successes: ${aggregate.successCount}/${aggregate.runCount}
- Failed tool calls observed in: ${perTaskMetrics.filter((metric) => (metric.failedToolCallRate ?? 0) > 0).map((metric) => metric.taskId).join(", ") || "none"}

## Patterns meeting preregistered threshold (>=20% wall-clock OR >=25% tool activity, >=3/5 runs, >=2 task classes)

${formatCandidates(candidates)}

## Top observed categories

1. ${ranked[0]?.category ?? "none"} — ${ranked[0]?.durationMs ?? 0} ms
2. ${ranked[1]?.category ?? "none"} — ${ranked[1]?.durationMs ?? 0} ms
3. ${ranked[2]?.category ?? "none"} — ${ranked[2]?.durationMs ?? 0} ms

## Threats to validity

- Five runs is a small sample.
- Separate agent sessions may differ in environment warmth (e.g. cached dependencies).
- Transcript omits model latency and tokens.
- Task difficulty varies; not all task classes may trigger the same tool profile.

## Decision

**${decision}**

## Artifact paths and checksums

- Raw traces: \`research/results/exp-002/raw.jsonl\` (sha256 ${summaryOutput.checksums.raw})
- Summary: \`research/results/exp-002/summary.json\`
- Report: \`research/results/exp-002/report.md\`

## Explicit confirmation

No optimization, caching, shared memory, CI acceleration, dashboard, MCP server, or product feature was implemented.

## Recommended next experiment

If decision is REPLICATE or STRONG_SIGNAL: run 15–20 live-agent tasks with transcript ingestion and compare category shares across repository sizes; still no intervention.
`

  summaryOutput.checksums.report = sha256(reportBody)
  const summaryCanonical = canonicalize({ ...summaryOutput, checksums: { ...summaryOutput.checksums, summary: "" } })
  summaryOutput.checksums.summary = sha256(summaryCanonical)

  await writeFile(reportPath, reportBody, "utf8")
  await writeFile(summaryPath, canonicalize(summaryOutput), "utf8")

  console.log(`[exp-002] report: ${reportPath}`)
  console.log(`[exp-002] decision=${decision}`)
}

generateReport().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
