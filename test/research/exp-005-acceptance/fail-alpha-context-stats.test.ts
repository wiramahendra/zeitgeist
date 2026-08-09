import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { execSync } from "node:child_process"

const runCli = (args: ReadonlyArray<string>): string =>
  execSync(["pnpm", "exec", "tsx", "src/cli/root.ts", ...args].join(" "), {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  })

describe("fail-alpha-context-stats acceptance", () => {
  it("prints labeled context counts via context stats subcommand", () => {
    const output = runCli([
      "context",
      "stats",
      "fixtures/synthetic-example/context.json",
      "--evidence",
      "fixtures/synthetic-example/evidence.json"
    ])
    expect(output).toMatch(/Facts:/)
    expect(output).toMatch(/Timeline events:/)
    expect(output).toMatch(/Errors:/)
    expect(output).toMatch(/Dependencies:/)
    expect(output).toMatch(/Timeline unique evidence IDs:/)
  })
})
