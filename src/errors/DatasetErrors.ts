import { Data } from "effect"

export class DatasetNotFound extends Data.TaggedError("DatasetNotFound")<{
  readonly path: string
}> {}

export class DatasetMalformed extends Data.TaggedError("DatasetMalformed")<{
  readonly path: string
  readonly reason: string
}> {}

export class SchemaValidationFailed extends Data.TaggedError("SchemaValidationFailed")<{
  readonly path: string
  readonly reason: string
}> {}
