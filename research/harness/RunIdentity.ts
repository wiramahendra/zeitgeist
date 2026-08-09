import { canonicalDigest } from "../../src/context/Canonicalize.js"

export interface RunIdentityInput {
  readonly experimentId: string
  readonly experimentVersion: string
  readonly repositoryCommit: string
  readonly taskSetDigest: string
  readonly runnerIdentity: string
  readonly runnerConfigDigest: string
  readonly taskId: string
  readonly runIndex: number
}

export const createRunIdentity = (input: RunIdentityInput): string => canonicalDigest(input)
