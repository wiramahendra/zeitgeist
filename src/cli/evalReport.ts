import { Args, Command, Options } from "@effect/cli"
import { FileSystem } from "@effect/platform"
import { Console, Effect } from "effect"
import { buildReport, writeReport } from "../eval/Report.js"
import { readResultsJsonl } from "../eval/ResultStore.js"
import { handleCliError } from "./shared.js"

const resultsPath = Args.text({ name: "results.jsonl" })
const outputDirectory = Options.text("output-dir")

export const evalReportCommand = Command.make(
  "report",
  { resultsPath, outputDirectory },
  ({ resultsPath, outputDirectory }) =>
    handleCliError(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const results = yield* readResultsJsonl(resultsPath)
        const report = buildReport(results)
        yield* fs.makeDirectory(outputDirectory, { recursive: true })
        yield* writeReport(outputDirectory, report)
        yield* Console.log(`Wrote ${report.experimentStatus} report to ${outputDirectory}`)
      })
    )
)
