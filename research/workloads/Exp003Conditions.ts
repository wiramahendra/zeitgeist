export type EnvironmentCondition = "A_COLD" | "B_WARM_PACKAGE" | "C_WARM_WORKSPACE"

export interface Exp003TaskDefinition {
  readonly taskId: string
  readonly taskClass: string
  readonly title: string
  readonly description: string
  readonly fixturePath: string
}

export interface PreparedRun {
  readonly runId: string
  readonly taskId: string
  readonly taskClass: string
  readonly condition: EnvironmentCondition
  readonly runIndex: number
  readonly workspacePath: string
  readonly description: string
}

export const CONDITION_ORDER_BY_TASK_INDEX: ReadonlyArray<ReadonlyArray<EnvironmentCondition>> = [
  ["A_COLD", "B_WARM_PACKAGE", "C_WARM_WORKSPACE"],
  ["B_WARM_PACKAGE", "C_WARM_WORKSPACE", "A_COLD"],
  ["C_WARM_WORKSPACE", "A_COLD", "B_WARM_PACKAGE"],
  ["A_COLD", "C_WARM_WORKSPACE", "B_WARM_PACKAGE"],
  ["B_WARM_PACKAGE", "A_COLD", "C_WARM_WORKSPACE"],
  ["C_WARM_WORKSPACE", "B_WARM_PACKAGE", "A_COLD"]
]

export const buildRunMatrix = (tasks: ReadonlyArray<Exp003TaskDefinition>): ReadonlyArray<PreparedRun> => {
  const runs: Array<PreparedRun> = []
  let runIndex = 0
  for (const [taskIndex, task] of tasks.entries()) {
    const order = CONDITION_ORDER_BY_TASK_INDEX[taskIndex % CONDITION_ORDER_BY_TASK_INDEX.length] ?? [
      "A_COLD",
      "B_WARM_PACKAGE",
      "C_WARM_WORKSPACE"
    ]
    for (const condition of order) {
      runs.push({
        runId: `${task.taskId}--${condition}`,
        taskId: task.taskId,
        taskClass: task.taskClass,
        condition,
        runIndex,
        workspacePath: `research/workloads/exp-003-runs/${task.taskId}--${condition}`,
        description: task.description
      })
      runIndex += 1
    }
  }
  return runs
}

export const environmentBootstrapMs = (
  categoryDurationMs: Readonly<Record<string, number>>
): number => (categoryDurationMs.package_manager ?? 0) + (categoryDurationMs.git ?? 0)
