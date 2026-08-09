export interface TaskDefinition {
  readonly taskId: string
  readonly taskClass: string
  readonly title: string
  readonly description: string
  readonly fixturePath: string
  readonly verificationCommand: ReadonlyArray<string>
}

export interface TaskSet {
  readonly schemaVersion: "1.0"
  readonly taskSetId: string
  readonly taskSetVersion: string
  readonly tasks: ReadonlyArray<TaskDefinition>
}

export const isTaskSet = (value: unknown): value is TaskSet => {
  if (value === null || typeof value !== "object") return false
  const candidate = value as Partial<TaskSet>
  return candidate.schemaVersion === "1.0" && Array.isArray(candidate.tasks)
}
