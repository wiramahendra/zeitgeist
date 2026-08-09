import { join } from "node:path"
import { pathToFileURL } from "node:url"

const main = async (): Promise<void> => {
  const root = process.cwd()
  const { summarizeConditionDelta } = await import(pathToFileURL(join(root, "src/eval/Report.js")).href)

  const metrics = (runCount: number, correctCount: number) => ({
    runCount,
    correctCount,
    needsHumanAdjudicationCount: 0,
    diagnosticAccuracy: 1,
    medianDurationMs: 100,
    medianTimeToCorrectHypothesisMs: 100,
    medianToolCalls: 1,
    medianTotalTokens: 1,
    medianHumanInterventions: 0,
    medianFalseHighConfidenceHypotheses: 0,
    missingMetrics: []
  })

  const fragment = summarizeConditionDelta(metrics(5, 4), metrics(5, 5))
  if (!/control/i.test(fragment) || !/manual/i.test(fragment) || !/5/.test(fragment)) {
    throw new Error(`fragment missing expected content: ${fragment}`)
  }
  console.log("PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
