import { execSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { canonicalize, sha256 } from "../../../src/context/Canonicalize.js"
import { readRawResultsJsonl } from "../../harness/AgentRunner.js"
import { computeRunMetrics } from "../../harness/Metrics.js"
import { normalizeAgentRun } from "../../harness/TraceNormalizer.js"
import {
  environmentBootstrapMs,
  type EnvironmentCondition
} from "../../workloads/Exp003Conditions.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(__dirname, "../../..")

type Exp003Decision = "KILL_BRANCH" | "REPLICATE" | "STRONG_SIGNAL" | "BLOCKED"

const parseCondition = (notes: ReadonlyArray<string>): EnvironmentCondition | null => {
  const line = notes.find((note) => note.startsWith("condition="))
  if (line === undefined) return null
  const value = line.slice("condition=".length)
  if (value === "A_COLD" || value === "B_WARM_PACKAGE" || value === "C_WARM_WORKSPACE") return value
  return null
}

const median = (values: ReadonlyArray<number>): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

const generateReport = async (): Promise<void> => {
  const config = JSON.parse(await readFile(join(__dirname, "experiment.json"), "utf8")) as {
    experimentId: string
    experimentVersion: string
    killBranchThreshold: number
    strongSignalThreshold: number
    strongSignalMinRunFraction: number
    modelIdentity: string
    runnerIdentity: string
  }
  const rawPath = join(repositoryRoot, "research/results/exp-003/raw.jsonl")
  const reportPath = join(repositoryRoot, "research/results/exp-003/report.md")
  const summaryPath = join(repositoryRoot, "research/results/exp-003/summary.json")
  const rawContents = await readFile(rawPath, "utf8")
  const runs = await Effect.runPromise(readRawResultsJsonl(rawPath))
  const metrics = runs.map((run) => ({
    condition: parseCondition(run.notes),
    metrics: computeRunMetrics(normalizeAgentRun(run)),
    taskClass: run.taskClass,
    taskId: run.taskId,
    notes: run.notes
  }))

  const byCondition = (condition: EnvironmentCondition) =>
    metrics.filter((entry) => entry.condition === condition)

  const conditionStats = (["A_COLD", "B_WARM_PACKAGE", "C_WARM_WORKSPACE"] as const).map((condition) => {
    const entries = byCondition(condition)
    const walls = entries.map((e) => e.metrics.durationMs)
    const pkg = entries.map((e) => e.metrics.categoryDurationMs.package_manager)
    const bootstrap = entries.map((e) => environmentBootstrapMs(e.metrics.categoryDurationMs))
    const bootstrapShare = entries.map((e) =>
      e.metrics.durationMs === 0 ? 0 : environmentBootstrapMs(e.metrics.categoryDurationMs) / e.metrics.durationMs
    )
    return {
      condition,
      count: entries.length,
      medianWall: median(walls),
      medianPackageMs: median(pkg),
      medianBootstrapMs: median(bootstrap),
      medianBootstrapShare: median(bootstrapShare)
    }
  })

  const cStats = conditionStats.find((s) => s.condition === "C_WARM_WORKSPACE")
  const cEntries = byCondition("C_WARM_WORKSPACE")
  const cStrongRuns = cEntries.filter(
    (e) => e.metrics.durationMs > 0 && environmentBootstrapMs(e.metrics.categoryDurationMs) / e.metrics.durationMs >= config.strongSignalThreshold
  )
  const cClasses = new Set(cStrongRuns.map((e) => e.taskClass))

  const cMedianShare = cStats?.medianBootstrapShare ?? null
  let decision: Exp003Decision = "BLOCKED"
  if (metrics.some((m) => m.condition === null) || metrics.length < 18) {
    decision = "BLOCKED"
  } else if (cMedianShare !== null && cMedianShare < config.killBranchThreshold) {
    decision = "KILL_BRANCH"
  } else if (
    cMedianShare !== null &&
    cMedianShare >= config.strongSignalThreshold &&
    cStrongRuns.length / cEntries.length >= config.strongSignalMinRunFraction &&
    cClasses.size >= 2
  ) {
    decision = "STRONG_SIGNAL"
  } else {
    decision = "REPLICATE"
  }

  const perRunLines = metrics
    .map(
      (e) =>
        `${e.taskId} ${e.condition ?? "?"} ${e.metrics.finalStatus} wall=${e.metrics.durationMs} pkg=${e.metrics.categoryDurationMs.package_manager} bootstrap=${environmentBootstrapMs(e.metrics.categoryDurationMs)} firstEdit=${e.metrics.timeToFirstCodeChangeMs ?? "n/a"}`
    )
    .join("\n")

  const conditionLines = conditionStats
    .map(
      (s) =>
        `${s.condition}: n=${s.count} medianWall=${s.medianWall ?? "n/a"} medianPkg=${s.medianPackageMs ?? "n/a"} medianBootstrap=${s.medianBootstrapMs ?? "n/a"} medianBootstrapShare=${s.medianBootstrapShare ?? "n/a"}`
    )
    .join("\n")

  const branch = execSync("git branch --show-current", { cwd: repositoryRoot, encoding: "utf8" }).trim()
  const head = execSync("git rev-parse HEAD", { cwd: repositoryRoot, encoding: "utf8" }).trim()

  const exp002Survives =
    cMedianShare === null
      ? "unknown"
      : cMedianShare >= 0.1
        ? "yes — package/setup share remains material in C_WARM_WORKSPACE"
        : "no — collapsed below 10% in C_WARM_WORKSPACE"

  const reportBody = `EXP-003 REPORT: ENVIRONMENT WARMTH / SETUP TAX

DECISION: ${decision}

BRANCH: ${branch}
HEAD: ${head}
MODEL: ${config.modelIdentity}
RUNNER: ${config.runnerIdentity}

HYPOTHESIS H0: In C_WARM_WORKSPACE, environment/bootstrap overhead is below 10% of wall-clock.

CONDITION DEFINITIONS
A_COLD: Fresh workspace copy, no node_modules, no workspace-level dependency install before agent start.
B_WARM_PACKAGE: Fresh workspace copy, no node_modules, global pnpm store pre-warmed via seed install of same fixture (experiment prep only, not agent-directed).
C_WARM_WORKSPACE: Workspace copy with pnpm install --ignore-workspace completed before agent start (node_modules present).

FROZEN TASKS (6)
warm-alpha-ratio bug_fix
warm-beta-label feature_addition
warm-gamma-parser refactor
warm-delta-slug test_addition
warm-epsilon-name validation_change
warm-zeta-record schema_or_contract_change

COUNTERBALANCE: Condition order rotated by task index (Latin-style offsets in Exp003Conditions.ts).

MEDIAN BY CONDITION
${conditionLines}

PER-RUN RESULTS
${perRunLines}

EXP-002 PACKAGE_MANAGER SIGNAL IN C_WARM_WORKSPACE
${exp002Survives}

UNAVAILABLE
package/network bytes — not exposed in transcript
model tokens and model latency — not in transcript

THREATS TO VALIDITY
VM-global pnpm store may warm A_COLD relative to truly cold network install
Six tasks, eighteen runs, mini-fixtures only
Bootstrap proxy = package_manager + git category time

ARTIFACTS
research/results/exp-003/raw.jsonl sha256 ${sha256(rawContents)}
research/results/exp-003/summary.json
research/results/exp-003/report.md

NO OPTIMIZATION IMPLEMENTED

RECOMMENDED NEXT EXPERIMENT
If KILL_BRANCH: re-run EXP-001/002 style workload profiling on a warm monorepo checkpoint to find the next bottleneck (likely file_read/search or verification, not setup).
If STRONG_SIGNAL: replicate on full zeitgeist repo workspace at C_WARM_WORKSPACE with 10+ tasks before any setup intervention research.
`

  const summary = {
    schemaVersion: "1.0",
    experimentId: config.experimentId,
    experimentVersion: config.experimentVersion,
    decision,
    conditionStats,
    runCount: metrics.length,
    checksums: { raw: sha256(rawContents), report: sha256(reportBody) }
  }

  await writeFile(reportPath, reportBody, "utf8")
  await writeFile(summaryPath, canonicalize(summary), "utf8")
  console.log(`[exp-003] decision=${decision}`)
  console.log(`[exp-003] report: ${reportPath}`)
}

generateReport().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
