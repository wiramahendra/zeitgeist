import { Args, Command } from "@effect/cli"
import { Console, Effect } from "effect"
import { validateDatasetDirectory } from "../dataset/DatasetValidator.js"
import { handleCliError } from "./shared.js"

const datasetDirectory = Args.text({ name: "dataset-dir" })

export const datasetValidateCommand = Command.make(
  "validate",
  { datasetDirectory },
  ({ datasetDirectory }) =>
    handleCliError(
      validateDatasetDirectory(datasetDirectory).pipe(
        Effect.flatMap((datasets) => Console.log(`Valid dataset: ${datasets.length} incident(s)`))
      )
    )
)
