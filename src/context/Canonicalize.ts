import { createHash, randomBytes } from "node:crypto"
import { open, rename, unlink } from "node:fs/promises"
import { dirname, basename, join } from "node:path"
import { Effect } from "effect"
import { ArtifactWriteFailed } from "../errors/EvaluationErrors.js"

type CanonicalValue = string | number | boolean | null | ReadonlyArray<CanonicalValue> | { readonly [key: string]: CanonicalValue }

const canonicalValue = (value: unknown): CanonicalValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON cannot contain non-finite numbers")
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => {
          if (child === undefined) throw new TypeError(`Canonical JSON cannot contain undefined at ${key}`)
          return [key, canonicalValue(child)]
        })
    )
  }
  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}`)
}

export const canonicalize = (value: unknown): string => `${JSON.stringify(canonicalValue(value))}\n`

export const sha256 = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex")

export const canonicalDigest = (value: unknown): string => sha256(canonicalize(value))

export const atomicWrite = (path: string, contents: string): Effect.Effect<void, ArtifactWriteFailed> =>
  Effect.tryPromise({
    try: async () => {
      const directory = dirname(path)
      const temporary = join(directory, `.${basename(path)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`)
      let handle: Awaited<ReturnType<typeof open>> | undefined
      try {
        handle = await open(temporary, "wx", 0o600)
        await handle.writeFile(contents, "utf8")
        await handle.sync()
        await handle.close()
        handle = undefined
        await rename(temporary, path)
        const directoryHandle = await open(directory, "r")
        try {
          await directoryHandle.sync()
        } finally {
          await directoryHandle.close()
        }
      } catch (error) {
        if (handle !== undefined) await handle.close().catch(() => undefined)
        await unlink(temporary).catch(() => undefined)
        throw error
      }
    },
    catch: (error) => new ArtifactWriteFailed({ path, reason: String(error) })
  })
