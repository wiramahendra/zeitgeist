import { Data } from "effect"

export class RunnerFailed extends Data.TaggedError("RunnerFailed")<{
  readonly executable: string
  readonly exitCode: number | null
  readonly stderr: string
}> {}

export class RunnerTimedOut extends Data.TaggedError("RunnerTimedOut")<{
  readonly executable: string
  readonly timeoutMs: number
}> {}

export class InvalidRunnerOutput extends Data.TaggedError("InvalidRunnerOutput")<{
  readonly reason: string
}> {}

export class ScoringFailed extends Data.TaggedError("ScoringFailed")<{
  readonly reason: string
}> {}

export class ArtifactWriteFailed extends Data.TaggedError("ArtifactWriteFailed")<{
  readonly path: string
  readonly reason: string
}> {}
