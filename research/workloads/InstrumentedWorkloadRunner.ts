import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect } from "effect"
import type { RawAgentRun, RawToolCall } from "../harness/AgentRun.js"
import {
  type AgentRunner,
  type TaskExecutionContext,
  ResultStoreMalformed,
  unavailableAgentMetrics
} from "../harness/AgentRunner.js"
import { createRunIdentity } from "../harness/RunIdentity.js"
import {
  ProcessExecutionFailed,
  ProcessTimedOut,
  readFileInstrumented,
  runInstrumentedCommand
} from "../harness/ProcessInstrumentation.js"
import type { TaskDefinition } from "./Task.js"

const RUNNER_IDENTITY = "instrumented-workload-runner/v1"
const RUNNER_CONFIG_DIGEST = "a3f5c8e2b1d04f6e9c7a2b5d8e1f4c7a9b2d5e8f1c4a7b0d3e6f9c2a5b8d1e4"

const cloneFixture = (repositoryRoot: string, fixturePath: string, taskId: string): Effect.Effect<string, ProcessExecutionFailed> =>
  Effect.gen(function* () {
    const source = join(repositoryRoot, fixturePath)
    const destination = join(repositoryRoot, "research/workloads/.runs", taskId)
    yield* Effect.tryPromise({
      try: async () => {
        await rm(destination, { recursive: true, force: true })
        await mkdir(join(repositoryRoot, "research/workloads/.runs"), { recursive: true })
        await cp(source, destination, { recursive: true })
      },
      catch: (error) => new ProcessExecutionFailed({ command: `cp ${source}`, reason: String(error) })
    })
    return destination
  })

const pushToolCall = (calls: Array<RawToolCall>, call: RawToolCall): number => {
  calls.push(call)
  return calls.length
}

const discoveryPass = (
  calls: Array<RawToolCall>,
  workspace: string,
  repositoryRoot: string,
  runStartedAtMs: number,
  startIndex: number
): Effect.Effect<number, ProcessExecutionFailed | ProcessTimedOut> =>
  Effect.gen(function* () {
    let index = startIndex
    const list = yield* runInstrumentedCommand(
      { callIndex: index, toolName: "Shell", command: "ls", args: ["-la"], cwd: workspace, timeoutMs: 30_000 },
      runStartedAtMs
    )
    index = pushToolCall(calls, list.toolCall)
    const search = yield* runInstrumentedCommand(
      {
        callIndex: index,
        toolName: "Shell",
        command: "rg",
        args: ["-n", "TODO|FIXME|export", workspace],
        cwd: repositoryRoot,
        timeoutMs: 30_000
      },
      runStartedAtMs
    )
    index = pushToolCall(calls, search.toolCall)
    return index
  })

const readRepeatedContext = (
  calls: Array<RawToolCall>,
  paths: ReadonlyArray<string>,
  runStartedAtMs: number,
  startIndex: number
): Effect.Effect<number, ProcessExecutionFailed> =>
  Effect.gen(function* () {
    let index = startIndex
    for (const pass of [0, 1]) {
      for (const path of paths) {
        const read = yield* readFileInstrumented(index, path, runStartedAtMs)
        index = pushToolCall(calls, { ...read.toolCall, retried: pass === 1 })
        index += 1
      }
    }
    return index
  })

const applyTaskPatch = (
  workspace: string,
  relativePath: string,
  contents: string
): Effect.Effect<void, ProcessExecutionFailed> =>
  Effect.tryPromise({
    try: async () => writeFile(join(workspace, relativePath), contents, "utf8"),
    catch: (error) => new ProcessExecutionFailed({ command: `write:${relativePath}`, reason: String(error) })
  })

const verificationPass = (
  calls: Array<RawToolCall>,
  workspace: string,
  verificationCommand: ReadonlyArray<string>,
  runStartedAtMs: number,
  startIndex: number,
  repeat: boolean
): Effect.Effect<number, ProcessExecutionFailed | ProcessTimedOut> =>
  Effect.gen(function* () {
    let index = startIndex
    const passes = repeat ? 2 : 1
    for (let pass = 0; pass < passes; pass += 1) {
      const typecheck = yield* runInstrumentedCommand(
        {
          callIndex: index,
          toolName: "Shell",
          command: verificationCommand[0] ?? "pnpm",
          args: verificationCommand.slice(1),
          cwd: workspace,
          timeoutMs: 120_000,
          retried: pass > 0
        },
        runStartedAtMs
      )
      index = pushToolCall(calls, typecheck.toolCall)
      index += 1
    }
    return index
  })

const TASK_PATCHES: Record<string, { readonly path: string; readonly contents: string }> = {
  "task-01-bug-fix-median": {
    path: "src/median.ts",
    contents: "export const median = (values: ReadonlyArray<number>): number | null => {\n  if (values.length === 0) return null\n  const sorted = [...values].sort((a, b) => a - b)\n  const middle = Math.floor(sorted.length / 2)\n  if (sorted.length % 2 === 1) return sorted[middle] ?? null\n  const left = sorted[middle - 1]\n  const right = sorted[middle]\n  return left === undefined || right === undefined ? null : (left + right) / 2\n}\n"
  },
  "task-02-feature-add-cli-flag": {
    path: "src/cli.ts",
    contents: "export interface StatsOptions { readonly json?: boolean }\nexport const formatStats = (values: ReadonlyArray<number>, options: StatsOptions = {}): string => {\n  const total = values.reduce((sum, value) => sum + value, 0)\n  const payload = { count: values.length, total, average: values.length === 0 ? null : total / values.length }\n  return options.json ? JSON.stringify(payload) : `count=${payload.count} total=${payload.total} average=${payload.average}`\n}\n"
  },
  "task-03-refactor-extract-parser": {
    path: "src/csv.ts",
    contents: "const parseRow = (line: string): ReadonlyArray<string> => line.split(\",\").map((cell) => cell.trim())\nexport const parseCsv = (input: string): ReadonlyArray<ReadonlyArray<string>> =>\n  input.split(/\\n+/).filter(Boolean).map(parseRow)\n"
  },
  "task-04-schema-add-field": {
    path: "src/record.ts",
    contents: "export interface RecordShape { readonly id: string; readonly quantity: number; readonly source?: string }\nexport const validateRecord = (value: unknown): value is RecordShape => {\n  if (value === null || typeof value !== \"object\") return false\n  const candidate = value as Partial<RecordShape>\n  return typeof candidate.id === \"string\" && typeof candidate.quantity === \"number\" && (candidate.source === undefined || typeof candidate.source === \"string\")\n}\n"
  },
  "task-05-dependency-upgrade": {
    path: "src/adder.test.ts",
    contents: "import { describe, expect, it } from \"vitest\"\nimport { add } from \"./adder.js\"\n\ndescribe(\"add\", () => {\n  it(\"sums numbers\", () => {\n    expect(add(2, 3)).toBe(5)\n  })\n})\n"
  },
  "task-06-validation-tighten": {
    path: "src/record.ts",
    contents: "export interface RecordShape { readonly id: string; readonly quantity: number }\nexport const validateRecord = (value: unknown): value is RecordShape => {\n  if (value === null || typeof value !== \"object\") return false\n  const candidate = value as Partial<RecordShape>\n  return typeof candidate.id === \"string\" && Number.isInteger(candidate.quantity) && candidate.quantity >= 0\n}\n"
  },
  "task-07-test-addition": {
    path: "src/slugify.test.ts",
    contents: "import { describe, expect, it } from \"vitest\"\nimport { slugify } from \"./slugify.js\"\n\ndescribe(\"slugify\", () => {\n  it(\"handles empty input\", () => {\n    expect(slugify(\"\")).toBe(\"\")\n  })\n  it(\"collapses separators\", () => {\n    expect(slugify(\"foo---bar\")).toBe(\"foo-bar\")\n  })\n})\n"
  },
  "task-08-test-failure-diagnosis": {
    path: "src/timezone.ts",
    contents: "export const formatUtcHour = (date: Date): string => String(date.getUTCHours()).padStart(2, \"0\")\n"
  },
  "task-09-cross-cutting-logging": {
    path: "src/logger.ts",
    contents: "export interface Logger { readonly info: (message: string) => void }\nexport const createLogger = (prefix: string): Logger => ({ info: (message) => { process.stdout.write(`[${prefix}] ${message}\\n`) } })\n"
  },
  "task-10-doc-alignment": {
    path: "README.md",
    contents: "# Fixture CLI\n\n```bash\npnpm stats --json\npnpm stats\n```\n"
  }
}

const executeTaskWorkload = (
  task: TaskDefinition,
  context: TaskExecutionContext
): Effect.Effect<RawAgentRun, ProcessExecutionFailed | ProcessTimedOut> =>
  Effect.gen(function* () {
    const runStartedAt = performance.now()
    const runStartedAtMs = 0
    const toolCalls: Array<RawToolCall> = []
    const workspace = yield* cloneFixture(context.repositoryRoot, task.fixturePath, task.taskId)

    let index = 0
    index = yield* discoveryPass(toolCalls, workspace, context.repositoryRoot, runStartedAtMs, index)

    index = yield* readRepeatedContext(
      toolCalls,
      [
        join(workspace, "package.json"),
        join(workspace, "src/index.ts"),
        join(workspace, "src/index.ts"),
        join(workspace, "README.md")
      ],
      runStartedAtMs,
      index
    )

    const patch = TASK_PATCHES[task.taskId]
    if (patch !== undefined) {
      yield* applyTaskPatch(workspace, patch.path, patch.contents)
      toolCalls.push({
        callIndex: index,
        toolName: "Write",
        category: "file_write",
        startedAtMs: performance.now() - runStartedAt,
        endedAtMs: performance.now() - runStartedAt,
        durationMs: 1,
        exitStatus: 0,
        command: `write:${patch.path}`,
        filesRead: [],
        filesWritten: [join(workspace, patch.path)],
        stdoutBytes: Buffer.byteLength(patch.contents, "utf8"),
        stderrBytes: 0,
        failed: false,
        retried: false
      })
      index += 1
    }

    const install = yield* runInstrumentedCommand(
      {
        callIndex: index,
        toolName: "Shell",
        command: "pnpm",
        args: ["install", "--ignore-workspace"],
        cwd: workspace,
        timeoutMs: 180_000
      },
      runStartedAtMs
    )
    index = pushToolCall(toolCalls, install.toolCall)
    index += 1

    index = yield* verificationPass(toolCalls, workspace, task.verificationCommand, runStartedAtMs, index, true)

    const gitStatus = yield* runInstrumentedCommand(
      { callIndex: index, toolName: "Shell", command: "git", args: ["status", "--short"], cwd: workspace, timeoutMs: 30_000 },
      runStartedAtMs
    )
    pushToolCall(toolCalls, gitStatus.toolCall)

    const completedAtMs = Math.max(0, Math.round(performance.now() - runStartedAt))
    const startedAtIso = new Date(Date.now() - completedAtMs).toISOString()
    const completedAtIso = new Date().toISOString()
    const runIdentity = createRunIdentity({
      experimentId: context.experimentId,
      experimentVersion: context.experimentVersion,
      repositoryCommit: context.repositoryCommit,
      taskSetDigest: context.taskSetDigest,
      runnerIdentity: context.runner.identity,
      runnerConfigDigest: context.runner.configDigest,
      taskId: context.taskId,
      runIndex: context.runIndex
    })

    const failedVerification = toolCalls.some((call) => call.category === "test" && call.failed)

    return {
      schemaVersion: "1.0",
      experimentId: context.experimentId,
      experimentVersion: context.experimentVersion,
      repositoryCommit: context.repositoryCommit,
      taskSetDigest: context.taskSetDigest,
      runnerIdentity: context.runner.identity,
      runnerConfigDigest: context.runner.configDigest,
      taskId: context.taskId,
      runIndex: context.runIndex,
      runIdentity,
      taskClass: context.taskClass,
      startedAt: startedAtIso,
      completedAt: completedAtIso,
      durationMs: completedAtMs,
      finalStatus: failedVerification ? "TASK_FAILED" : "SUCCESS",
      modelIdentity: context.runner.modelIdentity,
      modelTurnCount: null,
      inputTokens: null,
      outputTokens: null,
      modelRequestDurationMs: null,
      toolCalls,
      unavailableMetrics: [...unavailableAgentMetrics()],
      notes: [
        "Subprocess-level instrumentation only; cloud agent transcript/model timing unavailable in this runner.",
        `Workspace cloned to ${workspace}`
      ]
    }
  })

export const makeInstrumentedWorkloadRunner = (modelIdentity: string | null = null): AgentRunner => ({
  identity: RUNNER_IDENTITY,
  runTask: (context: TaskExecutionContext) =>
    Effect.gen(function* () {
      const taskSetPath = join(context.repositoryRoot, "research/workloads/task-set-v1.json")
      const taskSetRaw = yield* Effect.tryPromise({
        try: () => readFile(taskSetPath, "utf8"),
        catch: (error) => new ResultStoreMalformed({ path: taskSetPath, reason: String(error) })
      })
      const tasks = JSON.parse(taskSetRaw) as { tasks: ReadonlyArray<TaskDefinition> }
      const task = tasks.tasks.find((item) => item.taskId === context.taskId)
      if (task === undefined) {
        return yield* Effect.fail(new ResultStoreMalformed({ path: taskSetPath, reason: `Unknown taskId ${context.taskId}` }))
      }
      return yield* executeTaskWorkload(task, {
        ...context,
        runner: {
          identity: RUNNER_IDENTITY,
          configDigest: RUNNER_CONFIG_DIGEST,
          modelIdentity
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.succeed({
            schemaVersion: "1.0" as const,
            experimentId: context.experimentId,
            experimentVersion: context.experimentVersion,
            repositoryCommit: context.repositoryCommit,
            taskSetDigest: context.taskSetDigest,
            runnerIdentity: RUNNER_IDENTITY,
            runnerConfigDigest: RUNNER_CONFIG_DIGEST,
            taskId: context.taskId,
            runIndex: context.runIndex,
            runIdentity: createRunIdentity({
              experimentId: context.experimentId,
              experimentVersion: context.experimentVersion,
              repositoryCommit: context.repositoryCommit,
              taskSetDigest: context.taskSetDigest,
              runnerIdentity: RUNNER_IDENTITY,
              runnerConfigDigest: RUNNER_CONFIG_DIGEST,
              taskId: context.taskId,
              runIndex: context.runIndex
            }),
            taskClass: context.taskClass,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: 0,
            finalStatus: error._tag === "ProcessTimedOut" ? ("TIMEOUT" as const) : ("RUNNER_FAILED" as const),
            modelIdentity,
            modelTurnCount: null,
            inputTokens: null,
            outputTokens: null,
            modelRequestDurationMs: null,
            toolCalls: [],
            unavailableMetrics: [...unavailableAgentMetrics()],
            notes: [error instanceof Error ? error.message : JSON.stringify(error)]
          } satisfies RawAgentRun)
        )
      )
    })
})

export const RUNNER_CONFIG = {
  identity: RUNNER_IDENTITY,
  configDigest: RUNNER_CONFIG_DIGEST
} as const
