import { Args, Command, Options } from "@effect/cli"
import { Console, Effect } from "effect"
import { EvidenceCollection } from "../domain/Evidence.js"
import { decodePersisted } from "../domain/Common.js"
import { inspectContext, validateContext } from "../context/ContextValidator.js"
import { SchemaValidationFailed } from "../errors/DatasetErrors.js"
import { handleCliError, readJsonFile } from "./shared.js"

const contextPath = Args.text({ name: "context.json" })
const evidencePath = Options.text("evidence")

export const contextInspectCommand = Command.make(
  "inspect",
  { contextPath, evidencePath },
  ({ contextPath, evidencePath }) =>
    handleCliError(
      Effect.gen(function* () {
        const [contextRaw, evidenceRaw] = yield* Effect.all([readJsonFile(contextPath), readJsonFile(evidencePath)])
        const evidence = yield* decodePersisted(EvidenceCollection)(evidenceRaw).pipe(
          Effect.mapError(
            () =>
              new SchemaValidationFailed({
                path: evidencePath,
                reason: "Input does not match the strict Evidence contract"
              })
          )
        )
        const context = yield* validateContext(contextRaw, evidence)
        yield* Console.log(inspectContext(context).trimEnd())
      })
    )
)
