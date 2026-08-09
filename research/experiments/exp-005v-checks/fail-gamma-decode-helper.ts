import { readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { Effect } from "effect"

const main = async (): Promise<void> => {
  const root = process.cwd()
  const { decodePersistedFile } = await import(pathToFileURL(join(root, "src/domain/Common.js")).href)
  const { ExpectedOutcome } = await import(pathToFileURL(join(root, "src/domain/ExpectedOutcome.js")).href)

  const commonSource = readFileSync(join(root, "src/domain/Common.ts"), "utf8")
  if (!/decodePersistedFile/.test(commonSource)) throw new Error("no decodePersistedFile in Common")
  const loaderSource = readFileSync(join(root, "src/dataset/DatasetLoader.ts"), "utf8")
  const validatorSource = readFileSync(join(root, "src/context/ContextValidator.ts"), "utf8")
  if (!/decodePersistedFile/.test(loaderSource)) throw new Error("DatasetLoader not updated")
  if (/decodePersisted\(schema\)\(raw\)\.pipe\(\s*Effect\.mapError/.test(validatorSource)) {
    throw new Error("ContextValidator still uses inline decode pattern")
  }
  const raw = JSON.parse(readFileSync(join(root, "fixtures/synthetic-example/expected.json"), "utf8"))
  const decoded = await Effect.runPromise(decodePersistedFile(ExpectedOutcome, raw, "expected.json"))
  if (decoded.acceptableDiagnoses.length <= 0) throw new Error("decode behavior broken")
  console.log("PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
