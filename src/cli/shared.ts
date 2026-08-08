import { FileSystem } from "@effect/platform"
import { Console, Effect } from "effect"
import { DatasetMalformed, DatasetNotFound } from "../errors/DatasetErrors.js"

export const readJsonFile = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const exists = yield* fs.exists(path)
    if (!exists) return yield* Effect.fail(new DatasetNotFound({ path }))
    const text = yield* fs.readFileString(path).pipe(
      Effect.mapError((error) => new DatasetMalformed({ path, reason: String(error) }))
    )
    return yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: (error) => new DatasetMalformed({ path, reason: String(error) })
    })
  })

export const handleCliError = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<void, never, R> =>
  effect.pipe(
    Effect.asVoid,
    Effect.catchAll((error) =>
      Console.error(formatError(error)).pipe(
        Effect.andThen(Effect.sync(() => {
          process.exitCode = 1
        }))
      )
    )
  )

const formatError = (error: unknown): string => {
  if (error !== null && typeof error === "object" && "_tag" in error) {
    const tag = String(error._tag)
    const details = Object.entries(error)
      .filter(([key]) => key !== "_tag")
      .map(([key, value]) => `${key}=${key.toLowerCase().includes("stderr") ? "[redacted]" : String(value)}`)
      .join(" ")
    return `Error [${tag}]${details === "" ? "" : `: ${details}`}`
  }
  return `Error: ${String(error)}`
}
