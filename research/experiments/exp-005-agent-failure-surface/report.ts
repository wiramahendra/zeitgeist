import { execSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { canonicalize, sha256 } from "../../../src/context/Canonicalize.js"
import {
  aggregateOutcomeRates,
  countFailureClasses,
  decideExp005,
  detectRecurringFailures,
  type Exp005Decision
} from "../../harness/FailureSurface.js"
import type { TaskScoreResult } from "../../harness/FailureSurface.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(__dirname, "../../..")

interface ExperimentConfig {
  readonly experimentId: string
  readonly experimentVersion: string
  readonly taskSetPath: string
  readonly resultsDir: string
  readonly taskCount: number
  readonly signalThreshold: {
    readonly minFailureRate: number
    readonly minTaskClasses: number
    readonly minExternallyAddressableShare: number
    readonly minRecurringRuns: number
  }
}

interface RawRecord {
  readonly taskId: string
  readonly taskClass: string
  readonly score: TaskScoreResult
}

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
  const records = rawContents
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as RawRecord)
  const scores = records.map((record) => record.score)
  const patterns = detectRecurringFailures(scores, {
    minRuns: config.signalThreshold.minRecurringRuns,
    minTaskClasses: 2
  })
  const decision: Exp005Decision = decideExp005(scores, patterns, config.taskCount, config.signalThreshold)
  const rates = aggregateOutcomeRates(scores)
  const failureCounts = countFailureClasses(scores)

  const branch = execSync("git branch --show-current", { cwd: repositoryRoot, encoding: "utf8" }).trim()
  const head = execSync("git rev-parse HEAD", { cwd: repositoryRoot, encoding: "utf8" }).trim()

  const perTaskLines = scores
    .map(
      (score) =>
        `${score.taskId} ${score.taskClass} ${score.outcome} claimDisagree=${score.claimDisagreement} repair=${score.failureAttribution?.humanRepairEstimate ?? "none"} primary=${score.failureAttribution?.primaryClass ?? "n/a"} tools=${score.toolCallCount ?? "n/a"} wall=${score.wallClockMs ?? "n/a"}`
    )
    .join("\n")

  const failureLines = Object.entries(failureCounts)
    .filter(([, count]) => count > 0)
    .map(([failureClass, count]) => `${failureClass}: ${count}`)
    .join("\n")

  const patternLines =
    patterns.length === 0
      ? "none at >=3 runs and >=2 task classes"
      : patterns
          .map(
            (pattern) =>
              `${pattern.failureClass}: runs=${pattern.runCount} rate=${pattern.rate.toFixed(2)} classes=${pattern.taskClasses.join(",")} extAddressable=${pattern.externallyAddressableCount}`
          )
          .join("\n")

  const reportBody = `EXP-005 REPORT: AGENT FAILURE SURFACE

DECISION: ${decision}

BRANCH: ${branch}
HEAD: ${head}
MODEL: composer-2.5-fast
ENVIRONMENT: C_WARM_WORKSPACE

EXPERIMENT IDENTITY
Experiment: EXP-005 v1.0.0
Frozen task set: research/workloads/task-set-exp005-v1.json
Ground truth: research/experiments/exp-005-agent-failure-surface/ground-truth/
Scorer: failure-surface-scorer/v1

TASK MATRIX
${taskSet.tasks.map((task) => `${task.taskId} ${task.taskClass} ${task.title}`).join("\n")}

GROUND-TRUTH METHODOLOGY
Acceptance criteria frozen per task in ground-truth JSON.
Hidden checks: test/research/exp-005-acceptance/<taskId>.test.ts (not referenced in agent prompts).
Full verification: pnpm test && pnpm typecheck on agent final commit.
Repository state scored via git checkout of agent-reported commit hash.

OUTCOME RATES
Success: ${rates.success}/${rates.total} (${(rates.successRate * 100).toFixed(1)}%)
Partial: ${rates.partial}/${rates.total} (${(rates.partialRate * 100).toFixed(1)}%)
Failure: ${rates.failure}/${rates.total} (${(rates.failureRate * 100).toFixed(1)}%)
Claim disagreement rate: ${(rates.claimDisagreementRate * 100).toFixed(1)}%

PER-TASK OUTCOMES
${perTaskLines}

FAILURE TAXONOMY COUNTS
${failureLines || "none (all success)"}

RECURRING FAILURE PATTERNS (>=${config.signalThreshold.minRecurringRuns} runs)
${patternLines}

EXTERNALLY-ADDRESSABLE VS MODEL-NATIVE
Externally-addressable classes: CONTEXT_DISCOVERY_FAILURE, VERIFICATION_FAILURE, STATE_CONTINUITY_FAILURE, SCOPE_VIOLATION, CROSS_MODULE_MISS
Model-native examples: WRONG_ASSUMPTION, INCOMPLETE_CHANGE when acceptance logic passes but design is wrong

THREATS TO VALIDITY
Eleven realistic multi-module tasks on one monorepo; branch-per-task seeds reduce cross-task interference.
Scoring depends on agent-reported commit hashes when worktrees unavailable.
Hidden acceptance tests exist in repository; discovery is part of agent behavior.
Parallel agents may share push contention on shared infrastructure.

ARTIFACTS
research/results/exp-005/raw.jsonl sha256 ${sha256(rawContents)}
research/results/exp-005/by-task.json
research/results/exp-005/summary.json
research/results/exp-005/report.md
research/results/exp-005/run-manifest.json
research/results/exp-005/transcript-checksums.sha256

NO PRODUCT IMPLEMENTED

RECOMMENDED NEXT EXPERIMENT
EXP-006: pick the highest-frequency externally-addressable failure class from this run (if STRONG_SIGNAL or WEAK_SIGNAL) and attempt to falsify it with a controlled replication — not a product fix.
`

  const summary = {
    schemaVersion: "1.0",
    experimentId: config.experimentId,
    decision,
    runCount: scores.length,
    rates,
    failureCounts,
    recurringPatterns: patterns,
    checksums: { raw: sha256(rawContents), report: sha256(reportBody) }
  }

  await writeFile(reportPath, reportBody, "utf8")
  await writeFile(summaryPath, canonicalize(summary), "utf8")
  console.log(`[exp-005] decision=${decision}`)
  console.log(`[exp-005] report: ${reportPath}`)
}

generateReport().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
