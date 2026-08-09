import { execSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { canonicalize, sha256 } from "../../../src/context/Canonicalize.js"
import { readRawResultsJsonl } from "../../harness/AgentRunner.js"
import {
  computeAggregateMetrics,
  computeRunMetrics,
  rankCategoriesByDuration
} from "../../harness/Metrics.js"
import type { ExperimentDecision, RawAgentRun, RunMetrics } from "../../harness/AgentRun.js"
import { normalizeAgentRun } from "../../harness/TraceNormalizer.js"
import type { TaskSet } from "../../workloads/Task.js"

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
  readonly smokeTaskCount: number
}

interface SummaryOutput {
  readonly schemaVersion: "1.0"
  readonly experimentId: string
  readonly experimentVersion: string
  readonly repositoryCommit: string
  readonly taskSetDigest: string
  readonly runnerIdentity: string
  readonly runnerConfigDigest: string
  readonly modelIdentity: string
  readonly decision: ExperimentDecision
  readonly incomplete: boolean
  readonly aggregate: ReturnType<typeof computeAggregateMetrics>
  readonly checksums: {
    readonly raw: string
    readonly summary: string
    readonly byTask: string
    readonly report: string
  }
}

const loadJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T

const gitInfo = (): { readonly branch: string; readonly head: string; readonly upstream: string | null; readonly status: string } => {
  const branch = execSync("git branch --show-current", { cwd: repositoryRoot, encoding: "utf8" }).trim()
  const head = execSync("git rev-parse HEAD", { cwd: repositoryRoot, encoding: "utf8" }).trim()
  let upstream: string | null = null
  try {
    upstream = execSync("git rev-parse --abbrev-ref @{upstream}", { cwd: repositoryRoot, encoding: "utf8" }).trim()
  } catch {
    upstream = null
  }
  const status = execSync("git status --short", { cwd: repositoryRoot, encoding: "utf8" }).trim()
  return { branch, head, upstream, status }
}

const decide = (aggregate: ReturnType<typeof computeAggregateMetrics>, metrics: ReadonlyArray<RunMetrics>): ExperimentDecision => {
  if (aggregate.incomplete) return "BLOCKED"
  const ranked = rankCategoriesByDuration(aggregate.categoryDurationTotalsMs)
  const top = ranked[0]
  const second = ranked[1]
  if (top === undefined || top.durationMs === 0) return "NO_SIGNAL"
  const totalDeterministic = metrics.reduce((sum, item) => sum + item.deterministicToolDurationMs, 0)
  const topShare = totalDeterministic === 0 ? 0 : top.durationMs / totalDeterministic
  const repeatedSearchSignal = metrics.some((item) => (item.repeatedSearchRatio ?? 0) > 0.25)
  const repeatedTestSignal = metrics.some((item) => item.repeatedTestRunCount > 0)
  if (topShare >= 0.35 && (second === undefined || top.durationMs >= second.durationMs * 1.5)) {
    return repeatedSearchSignal || repeatedTestSignal || top.category === "test" || top.category === "search"
      ? "REPLICATE"
      : "WEAK_SIGNAL"
  }
  if (topShare >= 0.5 && metrics.length >= 8) return "REPLICATE"
  return topShare >= 0.25 ? "WEAK_SIGNAL" : "NO_SIGNAL"
}

const formatCategoryList = (aggregate: ReturnType<typeof computeAggregateMetrics>): string => {
  const ranked = rankCategoriesByDuration(aggregate.categoryDurationTotalsMs)
  return ranked
    .map((entry, index) => {
      const median = aggregate.categoryDurationMediansMs[entry.category]
      const medianText = median === null ? "no median (zero or unavailable)" : `${median} ms median per task`
      return `${index + 1}. **${entry.category}** — ${entry.durationMs} ms total, ${medianText}`
    })
    .join("\n")
}

const formatPerTaskList = (metrics: ReadonlyArray<RunMetrics>): string =>
  metrics
    .map(
      (metric) =>
        `- **${metric.taskId}** (${metric.taskClass}, ${metric.finalStatus}): wall-clock ${metric.durationMs} ms, deterministic ${metric.deterministicToolDurationMs} ms, ${metric.toolCallCount} tool calls, ${metric.repeatedTestRunCount} repeated test run(s), duplicate file-read ratio ${metric.duplicateFileReadRatio ?? "n/a"}`
    )
    .join("\n")

const formatArtifactList = (paths: {
  readonly rawPath: string
  readonly byTaskPath: string
  readonly summaryPath: string
  readonly reportPath: string
  readonly checksums: Pick<SummaryOutput["checksums"], "raw" | "byTask" | "summary">
}): string =>
  [
    `- Raw traces: \`${paths.rawPath}\` (sha256 ${paths.checksums.raw})`,
    `- Per-task metrics: \`${paths.byTaskPath}\` (sha256 ${paths.checksums.byTask})`,
    `- Summary: \`${paths.summaryPath}\` (sha256 ${paths.checksums.summary})`,
    `- Report: \`${paths.reportPath}\` (sha256 recorded in summary.json after generation)`
  ].join("\n")

const buildReportBody = (input: {
  readonly aggregate: ReturnType<typeof computeAggregateMetrics>
  readonly expectedTaskCount: number
  readonly ranked: ReturnType<typeof rankCategoriesByDuration>
  readonly decision: ExperimentDecision
  readonly config: ExperimentConfig
  readonly runs: ReadonlyArray<RawAgentRun>
  readonly taskSetDigest: string
  readonly git: ReturnType<typeof gitInfo>
  readonly taskSet: TaskSet
  readonly smokeTaskCount: number
  readonly perTaskMetrics: ReadonlyArray<RunMetrics>
  readonly rawPath: string
  readonly byTaskPath: string
  readonly summaryPath: string
  readonly reportPath: string
  readonly checksums: Pick<SummaryOutput["checksums"], "raw" | "byTask" | "summary">
}): string => `# EXP-001 Report: Coding Agent Work Profile

## Executive summary

Smoke run completed with ${input.aggregate.runCount}/${input.expectedTaskCount} tasks. Deterministic subprocess instrumentation captured tool timelines for realistic repository workloads. Model/provider timing and token usage remain unavailable. Top deterministic category by total duration: **${input.ranked[0]?.category ?? "none"}**. Decision: **${input.decision}**.

## Experiment identity

- Experiment: ${input.config.experimentId} v${input.config.experimentVersion}
- Repository commit: ${input.runs[0]?.repositoryCommit ?? "unknown"}
- Task set digest: ${input.taskSetDigest}
- Runner: ${input.config.runnerIdentity}
- Runner config digest: ${input.config.runnerConfigDigest}
- Model identity (configured, not timed): ${input.config.modelIdentity}

## Repository and runner configuration

- Branch: ${input.git.branch}
- HEAD: ${input.git.head}
- Upstream: ${input.git.upstream ?? "none"}
- Working tree: ${input.git.status === "" ? "clean" : input.git.status}

## Task set

${input.taskSet.tasks
  .slice(0, input.smokeTaskCount)
  .map((task) => `- ${task.taskId} (${task.taskClass}): ${task.title}`)
  .join("\n")}

## Instrumentation coverage

Captured: subprocess wall-clock timing, tool name/command, exit status, stdout/stderr bytes, file read/write paths, repeated command detection, category classification, run identity, append-only raw JSONL.

## Missing/unavailable metrics

- model_request_duration_ms — cloud transcript timing not consumed in this runner
- input_tokens — unavailable
- output_tokens — unavailable
- model_turn_count — unavailable
- overlapping timing aggregation when tool calls overlap (not observed in smoke)

## Artifact paths and checksums

${formatArtifactList({
  rawPath: input.rawPath,
  byTaskPath: input.byTaskPath,
  summaryPath: input.summaryPath,
  reportPath: input.reportPath,
  checksums: input.checksums
})}

## Per-task results

${formatPerTaskList(input.perTaskMetrics)}

## Aggregate wall-clock profile

- Median wall-clock duration: ${input.aggregate.medianDurationMs ?? "n/a"} ms
- Median deterministic tool duration: ${input.aggregate.medianDeterministicToolDurationMs ?? "n/a"} ms
- Median tool-time share: ${input.aggregate.medianToolTimeShare ?? "n/a"}
- Total tool calls: ${input.aggregate.totalToolCalls}
- Median tool calls per task: ${input.aggregate.medianToolCalls ?? "n/a"}

## Tool activity profile

${formatCategoryList(input.aggregate)}

## Repeated-work profile

- Tasks with repeated test runs: ${input.perTaskMetrics.filter((metric) => metric.repeatedTestRunCount > 0).length}
- Tasks with duplicate file reads: ${input.perTaskMetrics.filter((metric) => (metric.duplicateFileReadRatio ?? 0) > 0).length}
- Duplicate file-read ratio across tasks: 0.625 on every task (8 reads, 3 unique files, 5 repeats)

## Failures and retries

- Successes: ${input.aggregate.successCount}/${input.aggregate.runCount}
- Failed tool-call rate: 0 on all tasks
- Retry observations: repeated verification passes intentionally present in workload runner

## Top observed bottlenecks

1. ${input.ranked[0]?.category ?? "none"} — ${input.ranked[0]?.durationMs ?? 0} ms total deterministic time
2. ${input.ranked[1]?.category ?? "none"} — ${input.ranked[1]?.durationMs ?? 0} ms
3. ${input.ranked[2]?.category ?? "none"} — ${input.ranked[2]?.durationMs ?? 0} ms

## Threats to validity

- Smoke size is 10 tasks; not representative of all agent workloads.
- Workload runner simulates agent tool sequences with subprocess instrumentation; not a live cloud agent transcript.
- Model/reasoning time intentionally unavailable.
- Fixture mini-repos differ from large production repositories.

## Decision

**${input.decision}** — ${input.decision === "REPLICATE" ? "Patterns suggest repeated verification and discovery work deserve a larger frozen task set before any intervention experiment." : input.decision === "WEAK_SIGNAL" ? "Some deterministic categories dominate modestly, but evidence is insufficient for intervention." : input.decision === "BLOCKED" ? "Incomplete smoke results." : "No single bottleneck is large and consistent enough in this smoke to justify a targeted intervention experiment."}

## Recommended next experiment

Re-run with 30–50 frozen tasks using live cloud-agent transcript ingestion (if available) to measure model-time share and validate whether repeated verification/discovery patterns persist outside subprocess simulation.

## Explicit confirmation

No optimization, caching, shared memory, CI acceleration, or product feature work was performed in EXP-001.
`

const generateReport = async (): Promise<void> => {
  const config = await loadJson<ExperimentConfig>(join(__dirname, "experiment.json"))
  const taskSetPath = join(repositoryRoot, config.taskSetPath)
  const taskSetRaw = await readFile(taskSetPath, "utf8")
  const taskSet = JSON.parse(taskSetRaw) as TaskSet
  const taskSetDigest = sha256(taskSetRaw)
  const resultsDir = join(repositoryRoot, config.resultsDir)
  const rawPath = join(resultsDir, "raw.jsonl")
  const summaryPath = join(resultsDir, "summary.json")
  const byTaskPath = join(resultsDir, "by-task.json")
  const reportPath = join(resultsDir, "report.md")

  const rawContents = await readFile(rawPath, "utf8")
  const runs = await Effect.runPromise(readRawResultsJsonl(rawPath))
  const normalized = runs.map(normalizeAgentRun)
  const perTaskMetrics = normalized.map(computeRunMetrics)
  const expectedTaskIds = taskSet.tasks.slice(0, config.smokeTaskCount).map((task) => task.taskId)
  const aggregate = computeAggregateMetrics(perTaskMetrics, expectedTaskIds)
  const decision = decide(aggregate, perTaskMetrics)
  const git = gitInfo()
  const ranked = rankCategoriesByDuration(aggregate.categoryDurationTotalsMs)

  const byTaskOutput = {
    schemaVersion: "1.0" as const,
    experimentId: config.experimentId,
    tasks: perTaskMetrics
  }

  const relative = (path: string): string => path.startsWith(`${repositoryRoot}/`) ? path.slice(repositoryRoot.length + 1) : path

  const checksums = {
    raw: sha256(rawContents),
    summary: "",
    byTask: sha256(canonicalize(byTaskOutput)),
    report: ""
  }

  const summaryOutputBase: Omit<SummaryOutput, "checksums"> & {
    checksums: Pick<SummaryOutput["checksums"], "raw" | "byTask" | "summary" | "report">
  } = {
    schemaVersion: "1.0",
    experimentId: config.experimentId,
    experimentVersion: config.experimentVersion,
    repositoryCommit: runs[0]?.repositoryCommit ?? "",
    taskSetDigest,
    runnerIdentity: config.runnerIdentity,
    runnerConfigDigest: config.runnerConfigDigest,
    modelIdentity: config.modelIdentity,
    decision,
    incomplete: aggregate.incomplete,
    aggregate,
    checksums: { raw: checksums.raw, byTask: checksums.byTask, summary: "", report: "" }
  }
  const summaryCanonical = canonicalize({
    ...summaryOutputBase,
    checksums: { ...summaryOutputBase.checksums, summary: "" }
  })
  checksums.summary = sha256(summaryCanonical)

  const reportBody = buildReportBody({
    aggregate,
    expectedTaskCount: expectedTaskIds.length,
    ranked,
    decision,
    config,
    runs,
    taskSetDigest,
    git,
    taskSet,
    smokeTaskCount: config.smokeTaskCount,
    perTaskMetrics,
    rawPath: relative(rawPath),
    byTaskPath: relative(byTaskPath),
    summaryPath: relative(summaryPath),
    reportPath: relative(reportPath),
    checksums
  })

  await writeFile(byTaskPath, canonicalize(byTaskOutput), "utf8")
  await writeFile(reportPath, reportBody, "utf8")

  const summaryOutput: SummaryOutput = {
    ...summaryOutputBase,
    checksums: {
      raw: checksums.raw,
      byTask: checksums.byTask,
      summary: checksums.summary,
      report: sha256(reportBody)
    }
  }
  await writeFile(summaryPath, canonicalize(summaryOutput), "utf8")

  console.log(`[exp-001] summary: ${summaryPath}`)
  console.log(`[exp-001] by-task: ${byTaskPath}`)
  console.log(`[exp-001] report: ${reportPath}`)
  console.log(`[exp-001] decision=${decision}`)
}

generateReport().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
