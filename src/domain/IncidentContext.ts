import * as Schema from "effect/Schema"
import { Incident } from "./Incident.js"
import { JsonValue, NonEmptyString, SchemaVersion, StringArray } from "./Common.js"
import { TimelineEvent } from "./Timeline.js"

export const FactualContextItem = Schema.Struct({
  id: NonEmptyString,
  kind: NonEmptyString,
  subject: NonEmptyString,
  summary: NonEmptyString,
  attributes: Schema.Record({ key: Schema.String, value: JsonValue }),
  evidenceIds: StringArray.pipe(Schema.minItems(1))
})

export const DependencyRelationship = Schema.Struct({
  id: NonEmptyString,
  from: NonEmptyString,
  to: NonEmptyString,
  relationship: NonEmptyString,
  evidenceIds: StringArray.pipe(Schema.minItems(1))
})

export const IncidentContext = Schema.Struct({
  schemaVersion: SchemaVersion,
  incident: Incident,
  facts: Schema.Array(FactualContextItem),
  timeline: Schema.Array(TimelineEvent),
  recentChanges: Schema.Array(FactualContextItem),
  errors: Schema.Array(FactualContextItem),
  dependencies: Schema.Array(DependencyRelationship),
  evidenceReferences: StringArray
})

export type IncidentContext = typeof IncidentContext.Type
