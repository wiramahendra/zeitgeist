import { describe, expect, it } from "vitest"
import { execSync } from "node:child_process"

describe("fail-theta-import-extensions acceptance", () => {
  it("passes typecheck with correct dataset loader imports", () => {
    execSync("pnpm typecheck", { stdio: "pipe" })
  })
})
