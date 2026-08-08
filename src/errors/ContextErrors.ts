import { Data } from "effect"

export class ContextEvidenceReferenceMissing extends Data.TaggedError("ContextEvidenceReferenceMissing")<{
  readonly evidenceId: string
}> {}

export class ContextContainsHypothesis extends Data.TaggedError("ContextContainsHypothesis")<{
  readonly path: string
}> {}

export class ContextBudgetExceeded extends Data.TaggedError("ContextBudgetExceeded")<{
  readonly actualBytes: number
  readonly maximumBytes: number
}> {}
