import { cp, mkdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { spawn } from "node:child_process"
import { Effect } from "effect"
import type { EnvironmentCondition, Exp003TaskDefinition } from "../../workloads/Exp003Conditions.js"

const runCommand = (command: string, args: ReadonlyArray<string>, cwd: string): Effect.Effect<void, Error> =>
  Effect.tryPromise({
    try: () =>
      new Promise((resolve, reject) => {
        const child = spawn(command, [...args], {
          cwd,
          stdio: "ignore",
          env: { ...process.env, PATH: `/exec-daemon:${process.env.PATH ?? ""}` }
        })
        child.on("error", reject)
        child.on("close", (code) => (code === 0 ? resolve(undefined) : reject(new Error(`${command} exited ${code}`))))
      }),
    catch: (error) => (error instanceof Error ? error : new Error(String(error)))
  })

export const prepareWorkspace = (
  repositoryRoot: string,
  task: Exp003TaskDefinition,
  condition: EnvironmentCondition,
  workspaceRelativePath: string
): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const source = join(repositoryRoot, task.fixturePath)
    const destination = join(repositoryRoot, workspaceRelativePath)
    yield* Effect.tryPromise({
      try: async () => {
        await rm(destination, { recursive: true, force: true })
        await mkdir(join(repositoryRoot, "research/workloads/exp-003-runs"), { recursive: true })
        await cp(source, destination, { recursive: true })
      },
      catch: (error) => new Error(String(error))
    })

    if (condition === "A_COLD") {
      yield* Effect.tryPromise({
        try: async () => {
          await rm(join(destination, "node_modules"), { recursive: true, force: true })
        },
        catch: () => new Error("cleanup failed")
      }).pipe(Effect.catchAll(() => Effect.void))
      return
    }

    if (condition === "B_WARM_PACKAGE") {
      yield* Effect.tryPromise({
        try: async () => {
          await rm(join(destination, "node_modules"), { recursive: true, force: true })
        },
        catch: () => new Error("cleanup failed")
      }).pipe(Effect.catchAll(() => Effect.void))
      const warmDir = join(repositoryRoot, "research/workloads/exp-003-runs/.warm-store-seed")
      yield* Effect.tryPromise({
        try: async () => {
          await rm(warmDir, { recursive: true, force: true })
          await cp(source, warmDir, { recursive: true })
        },
        catch: (error) => new Error(String(error))
      })
      yield* runCommand("pnpm", ["install", "--ignore-workspace"], warmDir)
      return
    }

    yield* runCommand("pnpm", ["install", "--ignore-workspace"], destination)
  })

export const loadTaskSet = async (repositoryRoot: string): Promise<ReadonlyArray<Exp003TaskDefinition>> => {
  const raw = await readFile(join(repositoryRoot, "research/workloads/task-set-exp003-v1.json"), "utf8")
  return (JSON.parse(raw) as { tasks: ReadonlyArray<Exp003TaskDefinition> }).tasks
}
