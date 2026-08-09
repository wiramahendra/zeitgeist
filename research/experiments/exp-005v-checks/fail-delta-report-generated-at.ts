import { join } from "node:path"
import { pathToFileURL } from "node:url"

const main = async (): Promise<void> => {
  const root = process.cwd()
  const { buildReport, renderReportMarkdown } = await import(pathToFileURL(join(root, "src/eval/Report.js")).href)

  const report = buildReport([])
  if (!/^\d{4}-\d{2}-\d{2}T/.test(report.generatedAt)) throw new Error("missing generatedAt")
  if (!renderReportMarkdown(report).includes("Generated:")) throw new Error("missing Generated line")
  console.log("PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
