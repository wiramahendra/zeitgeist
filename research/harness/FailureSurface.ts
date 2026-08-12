export const FAILURE_TAXONOMY = [
  "CONTEXT_DISCOVERY_FAILURE",
  "WRONG_ASSUMPTION",
  "INCOMPLETE_CHANGE",
  "CROSS_MODULE_MISS",
  "CONTRACT_VIOLATION",
  "VERIFICATION_FAILURE",
  "REGRESSION_INTRODUCED",
  "SCOPE_VIOLATION",
  "DEPENDENCY_MISUNDERSTANDING",
  "STATE_CONTINUITY_FAILURE",
  "TOOL_FAILURE",
  "OTHER"
] as const

export type FailureClass = (typeof FAILURE_TAXONOMY)[number]

export const TASK_OUTCOMES = ["SUCCESS", "PARTIAL", "FAILURE"] as const
export type TaskOutcome = (typeof TASK_OUTCOMES)[number]

export const EXP005_DECISIONS = ["STRONG_SIGNAL", "WEAK_SIGNAL", "NO_SIGNAL", "INVALID"] as const
export type Exp005Decision = (typeof EXP005_DECISIONS)[number]

export interface AcceptanceCriterionResult {
  readonly criterionId: string
  readonly passed: boolean
  readonly evidence: string
}

export interface HiddenCheckResult {
  readonly checkId: string
  readonly passed: boolean
  readonly exitCode: number | null
  readonly output: string
}

export interface ScopeCheckResult {
  readonly checkId: string
  readonly passed: boolean
  readonly evidence: string
}

export interface AgentClaimRecord {
  readonly claimedTestsPassed: boolean | null
  readonly claimedCommitHash: string | null
  readonly summaryText: string | null
}

export interface RepositoryTruthRecord {
  readonly finalCommitHash: string | null
  readonly acceptanceTestsPassed: boolean
  readonly fullTestSuitePassed: boolean
  readonly hiddenChecksPassed: boolean
  readonly scopeChecksPassed: boolean
  readonly regressionDetected: boolean
}

export interface FailureAttribution {
  readonly primaryClass: FailureClass
  readonly secondaryClasses: ReadonlyArray<FailureClass>
  readonly evidence: ReadonlyArray<string>
  readonly humanRepairEstimate: "none" | "small" | "medium" | "large"
  readonly externallyAddressable: boolean
}

export interface TaskScoreResult {
  readonly taskId: string
  readonly taskClass: string
  readonly outcome: TaskOutcome
  readonly firstPassCorrect: boolean
  readonly acceptanceResults: ReadonlyArray<AcceptanceCriterionResult>
  readonly hiddenCheckResults: ReadonlyArray<HiddenCheckResult>
  readonly scopeResults: ReadonlyArray<ScopeCheckResult>
  readonly agentClaims: AgentClaimRecord
  readonly repositoryTruth: RepositoryTruthRecord
  readonly claimDisagreement: boolean
  readonly failureAttribution: FailureAttribution | null
  readonly wallClockMs: number | null
  readonly toolCallCount: number | null
}

export interface GroundTruthTaskSpec {
  readonly taskId: string
  readonly taskClass: string
  readonly acceptanceCriteria: ReadonlyArray<{ readonly id: string; readonly description: string }>
  readonly hiddenCheckCommand: ReadonlyArray<string>
  readonly fullVerificationCommand: ReadonlyArray<string>
  readonly expectedComponents: ReadonlyArray<string>
  readonly forbiddenPathPatterns: ReadonlyArray<string>
  readonly scopeBoundaries: ReadonlyArray<string>
  readonly repositoryInvariants: ReadonlyArray<string>
}

export interface RecurringFailurePattern {
  readonly failureClass: FailureClass
  readonly runCount: number
  readonly taskClasses: ReadonlyArray<string>
  readonly rate: number
  readonly medianHumanRepair: "none" | "small" | "medium" | "large"
  readonly externallyAddressableCount: number
}

export const inferFailureClass = (score: TaskScoreResult): FailureClass => {
  if (score.outcome === "SUCCESS") return "OTHER"
  if (!score.repositoryTruth.fullTestSuitePassed && score.repositoryTruth.regressionDetected) return "REGRESSION_INTRODUCED"
  if (!score.repositoryTruth.hiddenChecksPassed) {
    if (score.scopeResults.some((item) => !item.passed)) return "SCOPE_VIOLATION"
    if (score.acceptanceResults.some((item) => item.criterionId.includes("cross") && !item.passed)) return "CROSS_MODULE_MISS"
    if (score.acceptanceResults.some((item) => item.criterionId.includes("contract") && !item.passed)) return "CONTRACT_VIOLATION"
    return "VERIFICATION_FAILURE"
  }
  if (score.outcome === "PARTIAL") return "INCOMPLETE_CHANGE"
  if (score.claimDisagreement) return "WRONG_ASSUMPTION"
  return "OTHER"
}

export const estimateHumanRepair = (score: TaskScoreResult): "none" | "small" | "medium" | "large" => {
  if (score.outcome === "SUCCESS") return "none"
  const failedAcceptance = score.acceptanceResults.filter((item) => !item.passed).length
  const failedHidden = score.hiddenCheckResults.filter((item) => !item.passed).length
  const failedScope = score.scopeResults.filter((item) => !item.passed).length
  const totalMisses = failedAcceptance + failedHidden + failedScope
  if (score.outcome === "FAILURE" && score.repositoryTruth.regressionDetected) return "large"
  if (totalMisses >= 3) return "large"
  if (totalMisses === 2) return "medium"
  if (totalMisses === 1) return "small"
  return "medium"
}

export const isExternallyAddressable = (failureClass: FailureClass): boolean =>
  failureClass === "CONTEXT_DISCOVERY_FAILURE" ||
  failureClass === "VERIFICATION_FAILURE" ||
  failureClass === "STATE_CONTINUITY_FAILURE" ||
  failureClass === "SCOPE_VIOLATION" ||
  failureClass === "CROSS_MODULE_MISS"

export const buildFailureAttribution = (score: TaskScoreResult): FailureAttribution | null => {
  if (score.outcome === "SUCCESS") return null
  const primaryClass = inferFailureClass(score)
  const secondaryClasses: Array<FailureClass> = []
  if (score.claimDisagreement) secondaryClasses.push("WRONG_ASSUMPTION")
  if (score.repositoryTruth.regressionDetected) secondaryClasses.push("REGRESSION_INTRODUCED")
  return {
    primaryClass,
    secondaryClasses,
    evidence: [
      ...score.acceptanceResults.filter((item) => !item.passed).map((item) => `${item.criterionId}: ${item.evidence}`),
      ...score.hiddenCheckResults.filter((item) => !item.passed).map((item) => `${item.checkId}: exit=${item.exitCode}`),
      ...score.scopeResults.filter((item) => !item.passed).map((item) => `${item.checkId}: ${item.evidence}`)
    ],
    humanRepairEstimate: estimateHumanRepair(score),
    externallyAddressable: isExternallyAddressable(primaryClass)
  }
}

export const decideTaskOutcome = (input: {
  readonly acceptanceResults: ReadonlyArray<AcceptanceCriterionResult>
  readonly hiddenCheckResults: ReadonlyArray<HiddenCheckResult>
  readonly scopeResults: ReadonlyArray<ScopeCheckResult>
  readonly fullTestSuitePassed: boolean
  readonly regressionDetected: boolean
}): TaskOutcome => {
  const acceptancePass = input.acceptanceResults.every((item) => item.passed)
  const hiddenPass = input.hiddenCheckResults.every((item) => item.passed)
  const scopePass = input.scopeResults.every((item) => item.passed)
  if (acceptancePass && hiddenPass && scopePass && input.fullTestSuitePassed && !input.regressionDetected) return "SUCCESS"
  if (input.regressionDetected || (!acceptancePass && !hiddenPass)) return "FAILURE"
  return "PARTIAL"
}

export const detectRecurringFailures = (
  scores: ReadonlyArray<TaskScoreResult>,
  options: { readonly minRuns: number; readonly minTaskClasses: number }
): ReadonlyArray<RecurringFailurePattern> => {
  const failing = scores.filter((score) => score.outcome !== "SUCCESS" && score.failureAttribution !== null)
  const byClass = new Map<FailureClass, Array<TaskScoreResult>>()
  for (const score of failing) {
    const failureClass = score.failureAttribution!.primaryClass
    const bucket = byClass.get(failureClass) ?? []
    bucket.push(score)
    byClass.set(failureClass, bucket)
  }
  return [...byClass.entries()]
    .flatMap(([failureClass, records]) => {
      const taskClasses = [...new Set(records.map((record) => record.taskClass))]
      if (records.length < options.minRuns || taskClasses.length < options.minTaskClasses) return []
      return [
        {
          failureClass,
          runCount: records.length,
          taskClasses,
          rate: records.length / scores.length,
          medianHumanRepair: records[0]?.failureAttribution?.humanRepairEstimate ?? "medium",
          externallyAddressableCount: records.filter((record) => record.failureAttribution?.externallyAddressable).length
        }
      ]
    })
    .sort((left, right) => right.runCount - left.runCount)
}

export const decideExp005 = (
  scores: ReadonlyArray<TaskScoreResult>,
  patterns: ReadonlyArray<RecurringFailurePattern>,
  expectedRunCount: number,
  thresholds: { readonly minFailureRate: number; readonly minTaskClasses: number; readonly minExternallyAddressableShare: number }
): Exp005Decision => {
  if (scores.length < expectedRunCount) return "INVALID"
  if (scores.some((score) => score.outcome !== "SUCCESS" && score.failureAttribution === null)) return "INVALID"
  const strong = patterns.filter((pattern) => {
    if (pattern.taskClasses.length < thresholds.minTaskClasses) return false
    if (pattern.rate < thresholds.minFailureRate) return false
    const addressableShare = pattern.externallyAddressableCount / pattern.runCount
    return addressableShare >= thresholds.minExternallyAddressableShare
  })
  if (strong.length > 0) return "STRONG_SIGNAL"
  if (patterns.length > 0) return "WEAK_SIGNAL"
  const successRate = scores.filter((score) => score.outcome === "SUCCESS").length / scores.length
  if (successRate >= 0.8) return "NO_SIGNAL"
  return "WEAK_SIGNAL"
}

export const aggregateOutcomeRates = (scores: ReadonlyArray<TaskScoreResult>) => {
  const total = scores.length
  const count = (outcome: TaskOutcome) => scores.filter((score) => score.outcome === outcome).length
  return {
    total,
    success: count("SUCCESS"),
    partial: count("PARTIAL"),
    failure: count("FAILURE"),
    successRate: total === 0 ? 0 : count("SUCCESS") / total,
    partialRate: total === 0 ? 0 : count("PARTIAL") / total,
    failureRate: total === 0 ? 0 : count("FAILURE") / total,
    claimDisagreementRate: total === 0 ? 0 : scores.filter((score) => score.claimDisagreement).length / total
  }
}

export const countFailureClasses = (scores: ReadonlyArray<TaskScoreResult>): Record<FailureClass, number> =>
  Object.fromEntries(
    FAILURE_TAXONOMY.map((failureClass) => [
      failureClass,
      scores.filter((score) => score.failureAttribution?.primaryClass === failureClass).length
    ])
  ) as Record<FailureClass, number>
