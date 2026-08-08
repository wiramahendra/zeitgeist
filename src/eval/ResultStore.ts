import { open, readFile } from "node:fs/promises"
import { Effect } from "effect"
import { EvaluationResult, type EvaluationResult as EvaluationResultType } from "../domain/EvaluationResult.js"
import { decodePersisted } from "../domain/Common.js"
import { canonicalize } from "../context/Canonicalize.js"
import { ArtifactWriteFailed } from "../errors/EvaluationErrors.js"
import { DatasetMalformed } from "../errors/DatasetErrors.js"

export const parseResultsJsonl = (contents: string, path = "results.jsonl") =>
  Effect.gen(function* () {
    const results: Array<EvaluationResultType> = []
    const identities = new Set<string>()
    const lines = contents.split("\n")
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (line === undefined || line.trim() === "") continue
      const raw = yield* Effect.try({
        try: () => JSON.parse(line) as unknown,
        catch: (error) => new DatasetMalformed({ path, reason: `Malformed JSONL line ${index + 1}: ${String(error)}` })
      })
      const result = yield* decodePersisted(EvaluationResult)(raw).pipe(
        Effect.mapError(() => new DatasetMalformed({ path, reason: `Result line ${index + 1} does not match the strict EvaluationResult contract` }))
      )
      if (identities.has(result.runIdentity)) {
        return yield* Effect.fail(
          new DatasetMalformed({ path, reason: `Duplicate run identity: ${result.runIdentity}` })
        )
      }
      identities.add(result.runIdentity)
      results.push(result)
    }
    return results
  })

export const readResultsJsonl = (path: string) =>
  Effect.tryPromise({
    try: async () => readFile(path, "utf8"),
    catch: (error) => new DatasetMalformed({ path, reason: String(error) })
  }).pipe(Effect.flatMap((contents) => parseResultsJsonl(contents, path)))

export const appendResult = (path: string, result: EvaluationResultType) =>
  Effect.gen(function* () {
    const validatedResult = yield* decodePersisted(EvaluationResult)(result).pipe(
      Effect.mapError(() => new DatasetMalformed({ path, reason: "Result does not match the strict EvaluationResult contract" }))
    )
    const existing = yield* Effect.tryPromise({
      try: async () => readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return ""
        throw error
      }),
      catch: (error) => new DatasetMalformed({ path, reason: String(error) })
    })
    const parsed = yield* parseResultsJsonl(existing, path)
    if (parsed.some((item) => item.runIdentity === result.runIdentity)) {
      return yield* Effect.fail(new DatasetMalformed({ path, reason: `Duplicate run identity: ${result.runIdentity}` }))
    }
    yield* Effect.tryPromise({
      try: async () => {
        const handle = await open(path, "a", 0o600)
        try {
          await handle.write(canonicalize(validatedResult))
          await handle.sync()
        } finally {
          await handle.close()
        }
      },
      catch: (error) => new ArtifactWriteFailed({ path, reason: String(error) })
    })
  })
