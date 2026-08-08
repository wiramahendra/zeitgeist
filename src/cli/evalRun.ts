import { Args, Command, Options } from "@effect/cli"
import { Console, Effect } from "effect"
import { validateDatasetDirectory } from "../dataset/DatasetValidator.js"
import { makeExternalRunner } from "../eval/ExternalRunner.js"
import { runEvaluation } from "../eval/Evaluation.js"
import { handleCliError } from "./shared.js"

const datasetDirectory = Args.text({ name: "dataset-dir" })
const runner = Options.text("runner")
const output = Options.text("output")
const timeoutMs = Options.integer("timeout-ms").pipe(Options.withDefault(60_000))

export const evalRunCommand = Command.make(
  "run",
  { datasetDirectory, runner, output, timeoutMs },
  ({ datasetDirectory, runner, output, timeoutMs }) =>
    handleCliError(
      Effect.gen(function* () {
        const datasets = yield* validateDatasetDirectory(datasetDirectory)
        const count = yield* runEvaluation(
          datasets,
          makeExternalRunner({ executable: runner, timeoutMs }),
          output
        )
        yield* Console.log(`Appended ${count} scored run(s) to ${output}`)
      })
    )
)
