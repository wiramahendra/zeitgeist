import * as Schema from "effect/Schema"

const rfc3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/

export const Timestamp = Schema.String.pipe(
  Schema.pattern(rfc3339),
  Schema.filter((value) => Number.isFinite(Date.parse(value)), {
    message: () => "Expected a valid UTC RFC 3339 timestamp"
  })
)

export const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
export const SchemaVersion = Schema.Literal("1.0")

export const JsonValue: Schema.Schema<JsonValue> = Schema.suspend(() =>
  Schema.Union(
    Schema.String,
    Schema.Number,
    Schema.Boolean,
    Schema.Null,
    Schema.Array(JsonValue),
    Schema.Record({ key: Schema.String, value: JsonValue })
  )
)

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue }

export const StringArray = Schema.Array(NonEmptyString)

export const decodePersisted = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Schema.decodeUnknown(schema, { onExcessProperty: "error" })

export const median = (values: ReadonlyArray<number>): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const right = sorted[middle]
  if (right === undefined) return null
  if (sorted.length % 2 === 1) return right
  const left = sorted[middle - 1]
  return left === undefined ? null : (left + right) / 2
}
