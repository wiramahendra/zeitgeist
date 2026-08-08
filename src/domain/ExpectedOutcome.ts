import * as Schema from "effect/Schema"
import { NonEmptyString, SchemaVersion, StringArray } from "./Common.js"

export const AcceptableDiagnosis = Schema.Struct({
  id: NonEmptyString,
  text: NonEmptyString,
  deterministicTerms: StringArray
})

export const ExpectedOutcome = Schema.Struct({
  schemaVersion: SchemaVersion,
  rootCauseCategory: NonEmptyString,
  affectedComponents: StringArray,
  triggerEntities: StringArray,
  acceptableDiagnoses: Schema.Array(AcceptableDiagnosis).pipe(Schema.minItems(1)),
  requiredEvidence: StringArray,
  acceptableRemediations: StringArray
})

export type ExpectedOutcome = typeof ExpectedOutcome.Type
