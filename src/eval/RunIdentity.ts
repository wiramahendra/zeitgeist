import { canonicalDigest } from "../context/Canonicalize.js"
import type { ExperimentCondition } from "../domain/EvaluationResult.js"

export interface RunIdentityInput {
  readonly incidentId: string
  readonly condition: ExperimentCondition
  readonly repetitionIndex: number
  readonly runnerIdentity: string
  readonly promptConfigDigest: string
  readonly contextDigest: string | null
}

export const createRunIdentity = (input: RunIdentityInput): string => canonicalDigest(input)
