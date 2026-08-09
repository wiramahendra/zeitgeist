import { FileSystem } from "@effect/platform"
import { Effect } from "effect"
import { EvidenceCollection, type Evidence } from "../domain/Evidence.js"
import { ExpectedOutcome, type ExpectedOutcome as ExpectedOutcomeType } from "../domain/ExpectedOutcome.js"
import { Incident, type Incident as IncidentType } from "../domain/Incident.js"
import { decodePersistedFile } from "../domain/Common.js"
import type { IncidentContext } from "../domain/IncidentContext.js"
import { DatasetMalformed, DatasetNotFound } from "../errors/DatasetErrors.js"
import { decodeContext } from "../context/ContextValidator.js"

export interface IncidentDataset {
  readonly directory: string
  readonly incident: IncidentType
  readonly evidence: ReadonlyArray<Evidence>
  readonly context: IncidentContext
  readonly expected: ExpectedOutcomeType
  readonly rawContext: unknown
}

const readJson = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const exists = yield* fs.exists(path).pipe(Effect.mapError(() => new DatasetNotFound({ path })))
    if (!exists) return yield* Effect.fail(new DatasetNotFound({ path }))
    const contents = yield* fs.readFileString(path).pipe(
      Effect.mapError((error) => new DatasetMalformed({ path, reason: String(error) }))
    )
    return yield* Effect.try({
      try: () => JSON.parse(contents) as unknown,
      catch: (error) => new DatasetMalformed({ path, reason: String(error) })
    })
  })

export const loadIncidentDataset = (directory: string) =>
  Effect.gen(function* () {
    const incidentPath = `${directory}/incident.json`
    const evidencePath = `${directory}/evidence.json`
    const contextPath = `${directory}/context.json`
    const expectedPath = `${directory}/expected.json`
    const [incidentRaw, evidenceRaw, contextRaw, expectedRaw] = yield* Effect.all(
      [readJson(incidentPath), readJson(evidencePath), readJson(contextPath), readJson(expectedPath)],
      { concurrency: 4 }
    )
    const [incident, evidence, context, expected] = yield* Effect.all([
      decodePersistedFile(Incident, incidentRaw, incidentPath),
      decodePersistedFile(EvidenceCollection, evidenceRaw, evidencePath),
      decodeContext(contextRaw, contextPath),
      decodePersistedFile(ExpectedOutcome, expectedRaw, expectedPath)
    ])
    return { directory, incident, evidence, context, expected, rawContext: contextRaw } satisfies IncidentDataset
  })
