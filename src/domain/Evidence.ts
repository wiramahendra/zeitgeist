import * as Schema from "effect/Schema"
import { JsonValue, NonEmptyString, Timestamp } from "./Common.js"

export const SourceReference = Schema.Struct({
  uri: NonEmptyString,
  locator: NonEmptyString,
  capturedAt: Timestamp
})

export const Evidence = Schema.Struct({
  id: NonEmptyString,
  source: NonEmptyString,
  type: NonEmptyString,
  timestamp: Timestamp,
  subject: NonEmptyString,
  attributes: Schema.Record({ key: Schema.String, value: JsonValue }),
  sourceReference: SourceReference
})

export const EvidenceCollection = Schema.Array(Evidence)
export type Evidence = typeof Evidence.Type
