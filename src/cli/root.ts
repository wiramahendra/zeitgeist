#!/usr/bin/env node
import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { contextInspectCommand } from "./contextInspect.js"
import { contextStatsCommand } from "./contextStats.js"
import { contextValidateCommand } from "./contextValidate.js"
import { datasetValidateCommand } from "./datasetValidate.js"
import { evalReportCommand } from "./evalReport.js"
import { evalRunCommand } from "./evalRun.js"

const datasetCommand = Command.make("dataset").pipe(Command.withSubcommands([datasetValidateCommand]))
const contextCommand = Command.make("context").pipe(
  Command.withSubcommands([contextValidateCommand, contextInspectCommand, contextStatsCommand])
)
const evalCommand = Command.make("eval").pipe(Command.withSubcommands([evalRunCommand, evalReportCommand]))

const rootCommand = Command.make("zeitgeist").pipe(
  Command.withSubcommands([datasetCommand, contextCommand, evalCommand])
)

const cli = Command.run(rootCommand, {
  name: "Zeitgeist Gate 0 Experiment Harness",
  version: "0.0.0-gate0a"
})

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain)
