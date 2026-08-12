import { join } from "node:path"
import { pathToFileURL } from "node:url"

const main = async (): Promise<void> => {
  const root = process.cwd()
  const { reduction } = await import(pathToFileURL(join(root, "src/eval/Metrics.js")).href)

  if (reduction(null, 10) !== null || reduction(10, null) !== null || reduction(0, 5) !== null) {
    throw new Error("null/zero control cases wrong")
  }
  const value = reduction(100, 50)
  if (value === null || Math.abs(value - 0.5) > 1e-9) throw new Error("positive reduction wrong")
  console.log("PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
