import { Args, Command, Options } from "@effect/cli"
import { FileSystem } from "@effect/platform"
import { Console, Effect } from "effect"
import { buildReport, writeReport } from "../eval/Report.js"
import { readResultsJsonl } from "../eval/ResultStore.js"
import { handleCliError } from "./shared.js"

const resultsPath = Args.text({ name: "results.jsonl" })
const outputDirectory = Options.text("output-dir")
const minIncidents = Options.integer("min-incidents").pipe(Options.withDefault(10))

export const evalReportCommand = Command.make(
  "report",
  { resultsPath, outputDirectory, minIncidents },
  ({ resultsPath, outputDirectory, minIncidents }) =>
    handleCliError(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const results = yield* readResultsJsonl(resultsPath)
        const report = buildReport(results, { minIncidents })
        yield* fs.makeDirectory(outputDirectory, { recursive: true })
        yield* writeReport(outputDirectory, report)
        yield* Console.log(`Wrote ${report.experimentStatus} report to ${outputDirectory}`)
      })
    )
)
