import { FileSystem } from "@effect/platform"
import { Effect } from "effect"
import { DatasetMalformed } from "../errors/DatasetErrors.js"
import { validateContext } from "../context/ContextValidator.js"
import { loadIncidentDataset, type IncidentDataset } from "./DatasetLoader.js"

const secretKey = /(?:^|[_-])(api[_-]?key|password|passwd|secret|token|authorization|cookie|private[_-]?key|client[_-]?secret)(?:$|[_-])/i

type SecretKeyMatch = { readonly keyName: string; readonly jsonPath: string }

const findSecretKey = (value: unknown, path = "$", seen = new Set<unknown>()): SecretKeyMatch | undefined => {
  if (value === null || typeof value !== "object" || seen.has(value)) return undefined
  seen.add(value)
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findSecretKey(value[index], `${path}[${index}]`, seen)
      if (found !== undefined) return found
    }
    return undefined
  }
  for (const [key, child] of Object.entries(value)) {
    if (secretKey.test(key)) return { keyName: key, jsonPath: `${path}.${key}` }
    const found = findSecretKey(child, `${path}.${key}`, seen)
    if (found !== undefined) return found
  }
  return undefined
}

export const assertNoSecretBearingKeys = (value: unknown, path: string): Effect.Effect<void, DatasetMalformed> => {
  const found = findSecretKey(value)
  return found === undefined
    ? Effect.void
    : Effect.fail(
        new DatasetMalformed({
          path,
          reason: `Forbidden secret-bearing field name "${found.keyName}" at JSON path ${found.jsonPath}`
        })
      )
}

export const validateIncidentDataset = (directory: string) =>
  Effect.gen(function* () {
    const dataset = yield* loadIncidentDataset(directory)
    yield* assertNoSecretBearingKeys(dataset, directory)
    const evidenceIds = new Set<string>()
    for (const item of dataset.evidence) {
      if (evidenceIds.has(item.id)) {
        return yield* Effect.fail(new DatasetMalformed({ path: directory, reason: `Duplicate evidence ID: ${item.id}` }))
      }
      evidenceIds.add(item.id)
    }
    const contextItemIds = new Set<string>()
    for (const item of [...dataset.context.facts, ...dataset.context.recentChanges, ...dataset.context.errors, ...dataset.context.dependencies]) {
      if (contextItemIds.has(item.id)) {
        return yield* Effect.fail(new DatasetMalformed({ path: directory, reason: `Duplicate context item ID: ${item.id}` }))
      }
      contextItemIds.add(item.id)
    }
    const diagnosisIds = new Set<string>()
    for (const diagnosis of dataset.expected.acceptableDiagnoses) {
      if (diagnosisIds.has(diagnosis.id)) {
        return yield* Effect.fail(new DatasetMalformed({ path: directory, reason: `Duplicate diagnosis ID: ${diagnosis.id}` }))
      }
      diagnosisIds.add(diagnosis.id)
    }
    for (const evidenceId of dataset.expected.requiredEvidence) {
      if (!evidenceIds.has(evidenceId)) {
        return yield* Effect.fail(
          new DatasetMalformed({ path: directory, reason: `Expected outcome references missing evidence ID: ${evidenceId}` })
        )
      }
    }
    if (dataset.context.incident.id !== dataset.incident.id) {
      return yield* Effect.fail(new DatasetMalformed({ path: directory, reason: "Context incident does not match incident.json" }))
    }
    yield* validateContext(dataset.rawContext, dataset.evidence)
    return dataset
  })

export const validateDatasetDirectory = (directory: string): Effect.Effect<ReadonlyArray<IncidentDataset>, unknown, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const direct = yield* fs.exists(`${directory}/incident.json`)
    const directories = direct
      ? [directory]
      : (yield* fs.readDirectory(directory)).map((name) => `${directory}/${name}`)
    const datasets: Array<IncidentDataset> = []
    const incidentIds = new Set<string>()
    for (const candidate of directories.sort()) {
      if (!(yield* fs.exists(`${candidate}/incident.json`))) continue
      const dataset = yield* validateIncidentDataset(candidate)
      if (incidentIds.has(dataset.incident.id)) {
        return yield* Effect.fail(
          new DatasetMalformed({ path: directory, reason: `Duplicate incident ID: ${dataset.incident.id}` })
        )
      }
      incidentIds.add(dataset.incident.id)
      datasets.push(dataset)
    }
    if (datasets.length === 0) {
      return yield* Effect.fail(new DatasetMalformed({ path: directory, reason: "No incident datasets found" }))
    }
    return datasets
  })
