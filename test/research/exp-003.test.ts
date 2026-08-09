import { describe, expect, it } from "vitest"
import { buildRunMatrix, environmentBootstrapMs } from "../../research/workloads/Exp003Conditions.js"

describe("exp-003 conditions", () => {
  const tasks = [
    { taskId: "t1", taskClass: "bug_fix", title: "a", description: "d", fixturePath: "x" },
    { taskId: "t2", taskClass: "refactor", title: "b", description: "d", fixturePath: "y" }
  ]

  it("builds full factorial with counterbalanced order", () => {
    const runs = buildRunMatrix(tasks)
    expect(runs.length).toBe(6)
    expect(new Set(runs.map((run) => run.condition)).size).toBe(3)
  })

  it("computes bootstrap ms from categories", () => {
    expect(
      environmentBootstrapMs({
        package_manager: 100,
        git: 50,
        agent_internal: 0,
        build: 0,
        file_read: 0,
        file_write: 0,
        repository_discovery: 0,
        search: 0,
        shell_other: 0,
        test: 0,
        typecheck: 0,
        unknown: 0
      })
    ).toBe(150)
  })
})
