import { describe, expect, it } from "vitest"
import { execSync } from "node:child_process"

describe("fail-iota-inspect-evidence-flag acceptance", () => {
  it("accepts --evidence on context inspect and validates references", () => {
    const output = execSync(
      "pnpm exec tsx src/cli/root.ts context inspect fixtures/synthetic-example/context.json --evidence fixtures/synthetic-example/evidence.json",
      { encoding: "utf8" }
    )
    expect(output).toMatch(/Incident:/)
  })
})
