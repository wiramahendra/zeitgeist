import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { makeExternalRunner } from "../../src/eval/ExternalRunner.js"
import type { ExperimentInput } from "../../src/eval/AgentRunner.js"

const input = {
  schemaVersion: "1.0",
  incident: {
    schemaVersion: "1.0",
    id: "test",
    startedAt: "2026-08-01T00:00:00Z",
    signal: "test",
    affectedService: "test",
    environment: "test"
  },
  evidence: [],
  condition: "CONTROL"
} satisfies ExperimentInput

describe("external runner", () => {
  const failure = async (effect: Effect.Effect<unknown, unknown>) => {
    const either = await Effect.runPromise(Effect.either(effect))
    return either._tag === "Left" ? either.left : undefined
  }
  it("parses structured JSON stdout", async () => {
    const runner = makeExternalRunner({
      executable: process.execPath,
      args: ["-e", "process.stdin.resume(); process.stdin.on('end',()=>console.log(JSON.stringify({finalDiagnosis:'test diagnosis'})))"]
    })
    const output = await Effect.runPromise(runner.run(input))
    expect(output.result.finalDiagnosis).toBe("test diagnosis")
  })

  it("times out and terminates a long-running command", async () => {
    const runner = makeExternalRunner({ executable: process.execPath, args: ["-e", "setInterval(()=>{},1000)"], timeoutMs: 30 })
    expect(await failure(runner.run(input))).toMatchObject({ _tag: "RunnerTimedOut" })
  })

  it("rejects malformed runner output", async () => {
    const runner = makeExternalRunner({ executable: process.execPath, args: ["-e", "console.log('not-json')"] })
    expect(await failure(runner.run(input))).toMatchObject({ _tag: "InvalidRunnerOutput" })
  })

  it("classifies non-zero runner exits", async () => {
    const runner = makeExternalRunner({ executable: process.execPath, args: ["-e", "process.stderr.write('failed'); process.exit(7)"] })
    expect(await failure(runner.run(input))).toMatchObject({ _tag: "RunnerFailed", exitCode: 7 })
  })
})
