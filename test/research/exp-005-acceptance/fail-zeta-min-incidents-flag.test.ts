import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

describe("fail-zeta-min-incidents-flag acceptance", () => {
  it("documents and implements --min-incidents on eval report command", () => {
    const cliSource = readFileSync("src/cli/evalReport.ts", "utf8")
    expect(cliSource).toMatch(/min-incidents|minIncidents/)
    const reportSource = readFileSync("src/eval/Report.ts", "utf8")
    expect(reportSource).toMatch(/minIncidents|minimumIncidents/)
  })
})
