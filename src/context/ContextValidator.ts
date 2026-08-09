import { Effect } from "effect"
import type { Evidence } from "../domain/Evidence.js"
import { IncidentContext, type IncidentContext as IncidentContextType } from "../domain/IncidentContext.js"
import { decodePersisted } from "../domain/Common.js"
import { ContextContainsHypothesis, ContextEvidenceReferenceMissing } from "../errors/ContextErrors.js"
import { SchemaValidationFailed } from "../errors/DatasetErrors.js"
import { contextByteSize, validateContextBudget } from "./ContextBudget.js"

const forbiddenInferenceKeys = new Set(["hypothesis", "hypotheses", "rootcause", "rootcauses"])

const findForbiddenInferencePath = (value: unknown, path = "$", seen = new Set<unknown>()): string | undefined => {
  if (value === null || typeof value !== "object" || seen.has(value)) return undefined
  seen.add(value)
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenInferencePath(value[index], `${path}[${index}]`, seen)
      if (found !== undefined) return found
    }
    return undefined
  }
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z]/gi, "").toLowerCase()
    if (forbiddenInferenceKeys.has(normalized)) return `${path}.${key}`
    const found = findForbiddenInferencePath(child, `${path}.${key}`, seen)
    if (found !== undefined) return found
  }
  return undefined
}

export const decodeContext = (raw: unknown, path = "context.json") => {
  return Effect.gen(function* () {
    const forbiddenPath = findForbiddenInferencePath(raw)
    if (forbiddenPath !== undefined) yield* Effect.fail(new ContextContainsHypothesis({ path: forbiddenPath }))
    return yield* decodePersisted(IncidentContext)(raw).pipe(
      Effect.mapError(() => new SchemaValidationFailed({ path, reason: "Input does not match the strict IncidentContext contract" }))
    )
  })
}

export const referencedEvidenceIds = (context: IncidentContextType): ReadonlySet<string> => {
  const ids = new Set(context.evidenceReferences)
  for (const item of [...context.facts, ...context.recentChanges, ...context.errors, ...context.timeline, ...context.dependencies]) {
    for (const id of item.evidenceIds) ids.add(id)
  }
  return ids
}

export const validateContext = (
  raw: unknown,
  evidence: ReadonlyArray<Evidence>,
  maximumBytes?: number
): Effect.Effect<IncidentContextType, ContextContainsHypothesis | ContextEvidenceReferenceMissing | SchemaValidationFailed | import("../errors/ContextErrors.js").ContextBudgetExceeded> =>
  Effect.gen(function* () {
    const context = yield* decodeContext(raw)
    const knownIds = new Set(evidence.map((item) => item.id))
    for (const id of referencedEvidenceIds(context)) {
      if (!knownIds.has(id)) yield* Effect.fail(new ContextEvidenceReferenceMissing({ evidenceId: id }))
    }
    const declared = new Set(context.evidenceReferences)
    for (const collection of [context.facts, context.recentChanges, context.errors, context.timeline, context.dependencies]) {
      for (const item of collection) {
        for (const id of item.evidenceIds) {
          if (!declared.has(id)) yield* Effect.fail(new ContextEvidenceReferenceMissing({ evidenceId: id }))
        }
      }
    }
    yield* validateContextBudget(context, maximumBytes)
    return context
  })

const timelineEvidenceIdCount = (context: IncidentContextType): number => {
  const timelineEvidenceIds = new Set<string>()
  for (const event of context.timeline) {
    for (const id of event.evidenceIds) timelineEvidenceIds.add(id)
  }
  return timelineEvidenceIds.size
}

export const statsContext = (context: IncidentContextType): string => {
  const lines = [
    `Facts: ${context.facts.length}`,
    `Timeline events: ${context.timeline.length}`,
    `Errors: ${context.errors.length}`,
    `Dependencies: ${context.dependencies.length}`,
    `Timeline unique evidence IDs: ${timelineEvidenceIdCount(context)}`
  ]
  return `${lines.join("\n")}\n`
}

export const inspectContext = (context: IncidentContextType): string => {
  const lines = [
    `Incident: ${context.incident.id}`,
    `Service: ${context.incident.affectedService}`,
    `Environment: ${context.incident.environment}`,
    `Started: ${context.incident.startedAt}`,
    `Facts: ${context.facts.length}`,
    `Timeline events: ${context.timeline.length}`,
    `Timeline unique evidence IDs: ${timelineEvidenceIdCount(context)}`,
    `Recent changes: ${context.recentChanges.length}`,
    `Errors: ${context.errors.length}`,
    `Dependencies: ${context.dependencies.length}`,
    `Evidence references: ${context.evidenceReferences.length}`,
    `Canonical bytes: ${contextByteSize(context)}`
  ]
  return `${lines.join("\n")}\n`
}
