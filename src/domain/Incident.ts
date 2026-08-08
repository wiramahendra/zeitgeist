import * as Schema from "effect/Schema"
import { NonEmptyString, SchemaVersion, Timestamp } from "./Common.js"

export const Incident = Schema.Struct({
  schemaVersion: SchemaVersion,
  id: NonEmptyString,
  startedAt: Timestamp,
  signal: NonEmptyString,
  affectedService: NonEmptyString,
  environment: NonEmptyString,
  synthetic: Schema.optional(Schema.Literal("SYNTHETIC_TEST_ONLY"))
})

export type Incident = typeof Incident.Type
