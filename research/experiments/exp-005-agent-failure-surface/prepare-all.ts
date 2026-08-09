import { execSync } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { canonicalize, sha256 } from "../../../src/context/Canonicalize.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(__dirname, "../../..")

interface TaskEntry {
  readonly taskId: string
  readonly taskClass: string
  readonly seedBranch: string
}

interface TaskSetFile {
  readonly tasks: ReadonlyArray<TaskEntry>
}

const run = (command: string): string =>
  execSync(command, { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()

const replaceInFile = async (relativePath: string, replacements: ReadonlyArray<{ readonly from: string; readonly to: string }>): Promise<void> => {
  const path = join(repositoryRoot, relativePath)
  let contents = await readFile(path, "utf8")
  for (const replacement of replacements) {
    if (!contents.includes(replacement.from)) {
      throw new Error(`Seed patch miss in ${relativePath}: ${replacement.from.slice(0, 60)}`)
    }
    contents = contents.replace(replacement.from, replacement.to)
  }
  await writeFile(path, contents, "utf8")
}

const seedMutators: Record<string, () => Promise<void>> = {
  "fail-beta-timeline-tiebreak": async () => {
    await replaceInFile("src/domain/Timeline.ts", [
      {
        from: "  left.eventType.localeCompare(right.eventType) ||\n  left.subject.localeCompare(right.subject)",
        to: "  left.subject.localeCompare(right.subject) ||\n  left.eventType.localeCompare(right.eventType)"
      }
    ])
  },
  "fail-eta-condition-delta": async () => {
    const path = join(repositoryRoot, "src/eval/Report.ts")
    const contents = await readFile(path, "utf8")
    if (contents.includes("summarizeConditionDelta")) return
    const insert =
      "\nexport const summarizeConditionDelta = (_control: ConditionMetrics, _manual: ConditionMetrics): string => {\n  // EXP-005 stub — incomplete\n  return \"\"\n}\n\n"
    await writeFile(path, contents.replace("export const renderReportMarkdown", `${insert}export const renderReportMarkdown`), "utf8")
  },
  "fail-theta-import-extensions": async () => {
    await replaceInFile("src/dataset/DatasetLoader.ts", [
      { from: 'from "../domain/Evidence.js"', to: 'from "../domain/Evidence"' },
      { from: 'from "../domain/ExpectedOutcome.js"', to: 'from "../domain/ExpectedOutcome"' },
      { from: 'from "../domain/Incident.js"', to: 'from "../domain/Incident"' },
      { from: 'from "../domain/Common.js"', to: 'from "../domain/Common"' },
      { from: 'from "../errors/DatasetErrors.js"', to: 'from "../errors/DatasetErrors"' },
      { from: 'from "../context/ContextValidator.js"', to: 'from "../context/ContextValidator"' }
    ])
  },
  "fail-kappa-reduction-regression": async () => {
    await replaceInFile("src/eval/Metrics.ts", [
      {
        from: "control === null || treatment === null || control === 0 ? null : (control - treatment) / control",
        to: "control === null || treatment === null || control === 0 ? null : (treatment - control) / control"
      }
    ])
  }
}

const prepareAll = async (): Promise<void> => {
  const frozenCommit = run("git rev-parse HEAD")
  const taskSetRaw = await readFile(join(repositoryRoot, "research/workloads/task-set-exp005-v1.json"), "utf8")
  const taskSet = JSON.parse(taskSetRaw) as TaskSetFile
  const branches: Array<Record<string, unknown>> = []

  for (const task of taskSet.tasks) {
    run(`git checkout ${frozenCommit}`)
    run(`git checkout -B ${task.seedBranch}`)
    const mutator = seedMutators[task.taskId]
    if (mutator !== undefined) await mutator()
    run("git add -A")
    try {
      run(`git commit -m "exp-005 seed: ${task.taskId}"`)
    } catch {
      // no-op when seed branch already matches
    }
    branches.push({
      taskId: task.taskId,
      taskClass: task.taskClass,
      seedBranch: task.seedBranch,
      seeded: mutator !== undefined,
      seedCommit: run("git rev-parse HEAD")
    })
  }

  run(`git checkout cursor/exp-005-agent-failure-surface-1db1`)
  const matrixPath = join(repositoryRoot, "research/results/exp-005/run-matrix.json")
  await mkdir(dirname(matrixPath), { recursive: true })
  const matrix = {
    schemaVersion: "1.0",
    experimentId: "EXP-005",
    frozenRepositoryCommit: frozenCommit,
    taskSetDigest: sha256(taskSetRaw),
    branches
  }
  await writeFile(matrixPath, `${canonicalize(matrix)}\n`, "utf8")
  console.log(`[exp-005] frozen=${frozenCommit}`)
  console.log(`[exp-005] run-matrix: ${matrixPath}`)
}

prepareAll().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
