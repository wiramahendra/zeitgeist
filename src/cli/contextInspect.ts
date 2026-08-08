import { Args, Command } from "@effect/cli"
import { Console, Effect } from "effect"
import { decodeContext, inspectContext } from "../context/ContextValidator.js"
import { handleCliError, readJsonFile } from "./shared.js"

const contextPath = Args.text({ name: "context.json" })

export const contextInspectCommand = Command.make(
  "inspect",
  { contextPath },
  ({ contextPath }) =>
    handleCliError(
      readJsonFile(contextPath).pipe(
        Effect.flatMap((raw) => decodeContext(raw, contextPath)),
        Effect.flatMap((context) => Console.log(inspectContext(context).trimEnd()))
      )
    )
)
