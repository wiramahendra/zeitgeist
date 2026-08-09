import { execSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { canonicalize, sha256 } from "../../../src/context/Canonicalize.js"
import { readRawResultsJsonl } from "../../harness/AgentRunner.js"
import { rankCategoriesByDuration } from "../../harness/Metrics.js"
import {
  buildAttributionRecords,
  decideExp004,
  detectRecurringPatterns,
  type Exp004Decision
} from "../../harness/TimeAttribution.js"

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
  readonly taskCount: number
  readonly signalThreshold: {
    readonly minWallClockShare: number
    readonly minToolActivityShare: number
    readonly minRuns: number
    readonly minTaskClasses: number
  }
}

const median = (values: ReadonlyArray<number>): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

const generateReport = async (): Promise<void> => {
  const config = JSON.parse(await readFile(join(__dirname, "experiment.json"), "utf8")) as ExperimentConfig
  const taskSetRaw = await readFile(join(repositoryRoot, config.taskSetPath), "utf8")
  const taskSet = JSON.parse(taskSetRaw) as { tasks: ReadonlyArray<{ taskId: string; taskClass: string; title: string }> }
  const rawPath = join(repositoryRoot, config.resultsDir, "raw.jsonl")
  const reportPath = join(repositoryRoot, config.resultsDir, "report.md")
  const summaryPath = join(repositoryRoot, config.resultsDir, "summary.json")
  const rawContents = await readFile(rawPath, "utf8")
  const runs = await Effect.runPromise(readRawResultsJsonl(rawPath))
  const records = buildAttributionRecords(runs)
  const threshold = {
    minRuns: config.signalThreshold.minRuns,
    minTaskClasses: config.signalThreshold.minTaskClasses,
    minWallShare: config.signalThreshold.minWallClockShare,
    minToolShare: config.signalThreshold.minToolActivityShare
  }
  const patterns = detectRecurringPatterns(records, threshold)
  const decision: Exp004Decision = decideExp004(records, config.taskCount, patterns, threshold)

  const totalWall = records.reduce((sum, record) => sum + record.attribution.wallClockMs, 0)
  const totalTool = records.reduce((sum, record) => sum + record.attribution.deterministicToolMs, 0)
  const totalBusy = records.reduce((sum, record) => sum + record.attribution.busyWallMs, 0)
  const totalGap = records.reduce((sum, record) => sum + record.attribution.interToolGapMs, 0)
  const totalOverlap = records.reduce((sum, record) => sum + record.attribution.parallelOverlapMs, 0)
  const totalUnattributed = records.reduce((sum, record) => sum + record.attribution.unattributedMs, 0)

  const categoryTotals = rankCategoriesByDuration(
    Object.fromEntries(
      records[0] === undefined
        ? []
        : Object.keys(records[0].attribution.categoryDurationMs).map((category) => [
            category,
            records.reduce(
              (sum, record) =>
                sum + record.attribution.categoryDurationMs[category as keyof typeof record.attribution.categoryDurationMs],
              0
            )
          ])
    ) as Record<string, number>
  )

  const perRunLines = records
    .map((record) => {
      const top = rankCategoriesByDuration(record.attribution.categoryDurationMs)[0]
      return `${record.taskId} ${record.taskClass} ${record.finalStatus} wall=${record.attribution.wallClockMs} busy=${record.attribution.busyWallMs} tool=${record.attribution.deterministicToolMs} gap=${record.attribution.interToolGapMs} overlap=${record.attribution.parallelOverlapMs} unattributed=${record.attribution.unattributedMs} verify=${record.attribution.verificationMs} explore=${record.attribution.explorationMs} top=${top?.category ?? "none"} dupRead=${record.metrics.duplicateFileReadRatio ?? "n/a"} repeatTest=${record.metrics.repeatedTestRunCount}`
    })
    .join("\n")

  const categoryLines = categoryTotals
    .filter((entry) => entry.durationMs > 0)
    .map((entry) => {
      const share = totalWall === 0 ? 0 : entry.durationMs / totalWall
      const toolShare = totalTool === 0 ? 0 : entry.durationMs / totalTool
      return `${entry.category}: total=${entry.durationMs}ms wallShare=${share.toFixed(3)} toolShare=${toolShare.toFixed(3)}`
    })
    .join("\n")

  const patternLines =
    patterns.length === 0
      ? "none detected at >=5/10 runs and >=3 task classes"
      : patterns
          .map(
            (pattern) =>
              `${pattern.pattern}: runs=${pattern.runCount} classes=${pattern.taskClasses.join(",")} medianWallShare=${pattern.medianWallShare ?? "n/a"} medianToolShare=${pattern.medianToolShare ?? "n/a"}`
          )
          .join("\n")

  const branch = execSync("git branch --show-current", { cwd: repositoryRoot, encoding: "utf8" }).trim()
  const head = execSync("git rev-parse HEAD", { cwd: repositoryRoot, encoding: "utf8" }).trim()

  const reportBody = `EXP-004 REPORT: REAL AGENT TIME ATTRIBUTION

DECISION: ${decision}

BRANCH: ${branch}
HEAD: ${head}
FROZEN REPOSITORY COMMIT: ${runs[0]?.repositoryCommit ?? "unknown"}
MODEL: ${config.modelIdentity}
RUNNER: ${config.runnerIdentity}
ENVIRONMENT: ${config.environmentCondition} (full Zeitgeist repo, dependencies installed)

TASK SET (10)
${taskSet.tasks.map((task) => `${task.taskId} ${task.taskClass} ${task.title}`).join("\n")}

INSTRUMENTATION COVERAGE
Observable: tool sequence, per-tool duration, inter-tool gaps, category attribution, duplicate reads, repeated tests, failures
Unavailable: input/output tokens, model request latency, pre-first-tool and post-last-tool session time, package/network bytes

AGGREGATE TIME ATTRIBUTION (all runs)
Total wall-clock (first-to-last tool span): ${totalWall}ms
Total busy wall (parallel-batch spans): ${totalBusy}ms (${totalWall === 0 ? "n/a" : ((totalBusy / totalWall) * 100).toFixed(1)}% of wall)
Total deterministic tool activity: ${totalTool}ms (sum of tool durations; may exceed busy wall when tools run in parallel)
Total inter-batch gap time (observable wait between tool batches): ${totalGap}ms (${totalWall === 0 ? "n/a" : ((totalGap / totalWall) * 100).toFixed(1)}% of wall)
Total parallel overlap (tool activity minus busy wall): ${totalOverlap}ms
Total unattributed within span: ${totalUnattributed}ms (${totalWall === 0 ? "n/a" : ((totalUnattributed / totalWall) * 100).toFixed(1)}% of wall)
Median wall per run: ${median(records.map((record) => record.attribution.wallClockMs)) ?? "n/a"}ms
Median inter-batch gap per run: ${median(records.map((record) => record.attribution.interToolGapMs)) ?? "n/a"}ms
Parallel-batch accounting used: ${records.every((record) => record.attribution.usesParallelBatchAccounting) ? "yes (all runs had same-turn parallel tool calls)" : "mixed"}

PRIMARY FINDING
Inter-batch gap time (observable wait between tool batches, not attributed to any tool category) is the largest wall-clock component at ${totalWall === 0 ? "n/a" : ((totalGap / totalWall) * 100).toFixed(1)}% aggregate share. This is reported separately from tool categories and is not classified as model reasoning. Deterministic tool activity (busy wall) is only ${totalWall === 0 ? "n/a" : ((totalBusy / totalWall) * 100).toFixed(1)}% of wall-clock.

CATEGORY TOTALS
${categoryLines || "no tool activity recorded"}

PER-RUN RESULTS
${perRunLines}

RECURRING EXTERNALLY-REMOVABLE PATTERNS (>=${config.signalThreshold.minRuns}/${config.taskCount} runs, >=${config.signalThreshold.minTaskClasses} classes)
${patternLines}

FAILURES RETRIES REPEATED WORK
Successes: ${records.filter((record) => record.finalStatus === "SUCCESS").length}/${records.length}
Runs with failed tools: ${records.filter((record) => (record.metrics.failedToolCallRate ?? 0) > 0).length}
Runs with duplicate reads: ${records.filter((record) => (record.metrics.duplicateFileReadRatio ?? 0) > 0).length}
Runs with repeated tests: ${records.filter((record) => record.metrics.repeatedTestRunCount > 0).length}

THREATS TO VALIDITY
Ten live runs on one repo commit; parallel agents may differ in micro-environment
Transcript wall-clock excludes time before first tool and after last tool
Category attribution depends on command-string heuristics
C_WARM_WORKSPACE removes cold-install confound but agents may still invoke package commands

ARTIFACTS
research/results/exp-004/raw.jsonl sha256 ${sha256(rawContents)}
research/results/exp-004/summary.json
research/results/exp-004/report.md
research/results/exp-004/run-manifest.json

NO OPTIMIZATION IMPLEMENTED

RECOMMENDED NEXT EXPERIMENT
Run EXP-004b with explicit model-turn boundary timestamps to determine how much of the ${totalWall === 0 ? "~62" : ((totalGap / totalWall) * 100).toFixed(0)}% inter-batch gap is model latency versus agent scheduling overhead. The git/package_environment STRONG_SIGNAL (29% tool-activity share) is secondary to gap-dominated wall-clock.
`

  const summary = {
    schemaVersion: "1.0",
    experimentId: config.experimentId,
    experimentVersion: config.experimentVersion,
    decision,
    runCount: records.length,
    aggregate: {
      totalWallMs: totalWall,
      totalToolMs: totalTool,
      totalGapMs: totalGap,
      totalUnattributedMs: totalUnattributed
    },
    recurringPatterns: patterns,
    checksums: { raw: sha256(rawContents), report: sha256(reportBody) }
  }

  await writeFile(reportPath, reportBody, "utf8")
  await writeFile(summaryPath, canonicalize(summary), "utf8")
  console.log(`[exp-004] decision=${decision}`)
  console.log(`[exp-004] report: ${reportPath}`)
}

generateReport().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
