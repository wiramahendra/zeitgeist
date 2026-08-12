import { execSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import {
  buildFailureAttribution,
  decideTaskOutcome,
  type AcceptanceCriterionResult,
  type AgentClaimRecord,
  type GroundTruthTaskSpec,
  type HiddenCheckResult,
  type ScopeCheckResult,
  type TaskScoreResult
} from "../../harness/FailureSurface.js"
import { computeRunMetrics } from "../../harness/Metrics.js"
import { normalizeAgentRun } from "../../harness/TraceNormalizer.js"
import type { RawAgentRun } from "../../harness/AgentRun.js"

const runCommand = (command: ReadonlyArray<string>, cwd: string): { readonly exitCode: number; readonly output: string } => {
  try {
    const output = execSync(command.join(" "), { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    return { exitCode: 0, output }
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string }
    return {
      exitCode: err.status ?? 1,
      output: `${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim()
    }
  }
}

const parseClaims = (notes: ReadonlyArray<string>): AgentClaimRecord => {
  const joined = notes.join("\n")
  const commitMatch = joined.match(/commit(?: hash)?[:=\s]+([0-9a-f]{7,40})/i)
  const testsMatch = joined.match(/tests passed[:=\s]+(yes|no|true|false)/i)
  const claimedTestsPassed =
    testsMatch === null
      ? null
      : testsMatch[1]?.toLowerCase() === "yes" || testsMatch[1]?.toLowerCase() === "true"
  return {
    claimedTestsPassed,
    claimedCommitHash: commitMatch?.[1] ?? null,
    summaryText: joined.slice(0, 500) || null
  }
}

const gitDiffPaths = (cwd: string): ReadonlyArray<string> => {
  try {
    const diff = execSync("git diff --name-only HEAD~1..HEAD 2>/dev/null || git diff --name-only", {
      cwd,
      encoding: "utf8"
    })
    return diff
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "")
  } catch {
    return []
  }
}

const withOptionalCommit = (workspacePath: string, commitHash: string | null | undefined, fn: () => Promise<TaskScoreResult>): Promise<TaskScoreResult> => {
  if (commitHash === null || commitHash === undefined || commitHash.trim() === "") return fn()
  const previous = execSync("git rev-parse HEAD", { cwd: workspacePath, encoding: "utf8" }).trim()
  execSync(`git checkout --quiet ${commitHash}`, { cwd: workspacePath })
  return fn().finally(() => {
    execSync(`git checkout --quiet ${previous}`, { cwd: workspacePath })
  })
}

export const scoreTaskRun = async (input: {
  readonly groundTruth: GroundTruthTaskSpec
  readonly rawRun: RawAgentRun
  readonly workspacePath: string
  readonly finalCommitHash?: string | null
}): Promise<TaskScoreResult> =>
  withOptionalCommit(input.workspacePath, input.finalCommitHash, async () => {
  const hidden = runCommand(input.groundTruth.hiddenCheckCommand, input.workspacePath)
  const full = runCommand(input.groundTruth.fullVerificationCommand, input.workspacePath)
  const hiddenCheckResults: HiddenCheckResult[] = [
    {
      checkId: "hidden_acceptance",
      passed: hidden.exitCode === 0,
      exitCode: hidden.exitCode,
      output: hidden.output.slice(0, 2000)
    }
  ]
  const acceptanceResults: AcceptanceCriterionResult[] = input.groundTruth.acceptanceCriteria.map((criterion) => ({
    criterionId: criterion.id,
    passed: hidden.exitCode === 0,
    evidence: hidden.exitCode === 0 ? "hidden acceptance passed" : hidden.output.slice(0, 500)
  }))
  const changedPaths = gitDiffPaths(input.workspacePath)
  const scopeResults: ScopeCheckResult[] = input.groundTruth.forbiddenPathPatterns.map((pattern) => {
    const regex = new RegExp(pattern)
    const violations = changedPaths.filter((path) => regex.test(path))
    return {
      checkId: `forbidden:${pattern}`,
      passed: violations.length === 0,
      evidence: violations.length === 0 ? "none" : violations.join(",")
    }
  })
  const agentClaims = parseClaims(input.rawRun.notes)
  const metrics = computeRunMetrics(normalizeAgentRun(input.rawRun))
  const fullTestSuitePassed = full.exitCode === 0
  const regressionDetected = full.exitCode !== 0 && hidden.exitCode === 0
  const outcome = decideTaskOutcome({
    acceptanceResults,
    hiddenCheckResults,
    scopeResults,
    fullTestSuitePassed,
    regressionDetected
  })
  const repositoryTruth = {
    finalCommitHash: agentClaims.claimedCommitHash,
    acceptanceTestsPassed: hidden.exitCode === 0,
    fullTestSuitePassed,
    hiddenChecksPassed: hiddenCheckResults.every((item) => item.passed),
    scopeChecksPassed: scopeResults.every((item) => item.passed),
    regressionDetected
  }
  const claimDisagreement =
    (agentClaims.claimedTestsPassed !== null && agentClaims.claimedTestsPassed !== fullTestSuitePassed) ||
    (agentClaims.claimedTestsPassed !== null && agentClaims.claimedTestsPassed !== repositoryTruth.acceptanceTestsPassed)
  const base: TaskScoreResult = {
    taskId: input.groundTruth.taskId,
    taskClass: input.groundTruth.taskClass,
    outcome,
    firstPassCorrect: outcome === "SUCCESS",
    acceptanceResults,
    hiddenCheckResults,
    scopeResults,
    agentClaims,
    repositoryTruth,
    claimDisagreement,
    failureAttribution: null,
    wallClockMs: input.rawRun.durationMs,
    toolCallCount: metrics.toolCallCount
  }
  return { ...base, failureAttribution: buildFailureAttribution(base) }
  })

export const loadGroundTruth = async (groundTruthDir: string, taskId: string): Promise<GroundTruthTaskSpec> => {
  const path = join(groundTruthDir, `${taskId}.json`)
  return JSON.parse(await readFile(path, "utf8")) as GroundTruthTaskSpec
}
