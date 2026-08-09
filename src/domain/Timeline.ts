import * as Schema from "effect/Schema"
import { NonEmptyString, StringArray, Timestamp } from "./Common.js"

export const TimelineEvent = Schema.Struct({
  timestamp: Timestamp,
  eventType: NonEmptyString,
  subject: NonEmptyString,
  evidenceIds: StringArray.pipe(Schema.minItems(1))
})

export type TimelineEvent = typeof TimelineEvent.Type

export const timelineCompare = <
  T extends { readonly timestamp: string; readonly eventType: string; readonly subject: string }
>(
  left: T,
  right: T
): number =>
  left.timestamp.localeCompare(right.timestamp) ||
  left.subject.localeCompare(right.subject) ||
  left.eventType.localeCompare(right.eventType)

export const sortTimeline = <
  T extends { readonly timestamp: string; readonly eventType: string; readonly subject: string }
>(
  events: ReadonlyArray<T>
): ReadonlyArray<T> => [...events].sort(timelineCompare)
