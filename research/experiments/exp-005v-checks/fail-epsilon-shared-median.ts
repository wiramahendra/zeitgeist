import { readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

const main = async (): Promise<void> => {
  const root = process.cwd()
  const { median } = await import(pathToFileURL(join(root, "src/domain/Common.js")).href)

  const metricsSource = readFileSync(join(root, "src/eval/Metrics.ts"), "utf8")
  if (!/from \"\.\.\/domain\/Common\.js\"/.test(metricsSource)) throw new Error("Metrics must import median from Common")
  if (/const median = \(/.test(metricsSource)) throw new Error("duplicate local median in Metrics")
  if (median([1, 3]) !== 2 || median([1, 2, 9]) !== 2) throw new Error("median values wrong")
  console.log("PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
