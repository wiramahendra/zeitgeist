import { describe, expect, it } from "vitest"
import type { RawAgentRun } from "../../research/harness/AgentRun.js"
import {
  buildAttributionRecords,
  computeInterToolGaps,
  computeTimeAttribution,
  decideExp004,
  detectRecurringPatterns
} from "../../research/harness/TimeAttribution.js"
import { normalizeAgentRun } from "../../research/harness/TraceNormalizer.js"

const baseRun = (toolCalls: RawAgentRun["toolCalls"]): RawAgentRun => ({
  schemaVersion: "1.0",
  experimentId: "EXP-004",
  experimentVersion: "1.0.0",
  repositoryCommit: "abc",
  taskSetDigest: "digest",
  runnerIdentity: "cloud-transcript-adapter/v1",
  runnerConfigDigest: "cfg",
  taskId: "real-alpha-scorer-tests",
  runIndex: 0,
  runIdentity: "run",
  taskClass: "test_addition",
  startedAt: "2026-01-01T00:00:00.000Z",
  completedAt: "2026-01-01T00:00:10.000Z",
  durationMs: 10000,
  finalStatus: "SUCCESS",
  modelIdentity: "composer-2.5-fast",
  modelTurnCount: 1,
  inputTokens: null,
  outputTokens: null,
  modelRequestDurationMs: null,
  toolCalls,
  unavailableMetrics: ["input_tokens", "output_tokens", "model_request_duration_ms"],
  notes: []
})

describe("time attribution", () => {
  it("computes inter-tool gaps between consecutive calls", () => {
    const gaps = computeInterToolGaps([
      { callIndex: 0, startedAtMs: 0, endedAtMs: 100 },
      { callIndex: 1, startedAtMs: 250, endedAtMs: 400 }
    ])
    expect(gaps).toEqual([{ afterCallIndex: 0, durationMs: 150 }])
  })

  it("partitions wall-clock into tool, gap, and unattributed components", () => {
    const run = normalizeAgentRun(
      baseRun([
        {
          callIndex: 0,
          toolName: "Read",
          category: "file_read",
          startedAtMs: 0,
          endedAtMs: 100,
          durationMs: 100,
          exitStatus: null,
          command: "read:src/a.ts",
          filesRead: ["src/a.ts"],
          filesWritten: [],
          stdoutBytes: null,
          stderrBytes: null,
          failed: false,
          retried: false
        },
        {
          callIndex: 1,
          toolName: "Shell",
          category: "test",
          startedAtMs: 300,
          endedAtMs: 800,
          durationMs: 500,
          exitStatus: 0,
          command: "pnpm test",
          filesRead: [],
          filesWritten: [],
          stdoutBytes: 10,
          stderrBytes: null,
          failed: false,
          retried: false
        }
      ])
    )
    run.durationMs = 900
    const attribution = computeTimeAttribution(run)
    expect(attribution.deterministicToolMs).toBe(600)
    expect(attribution.interToolGapMs).toBe(200)
    expect(attribution.unattributedMs).toBe(100)
    expect(attribution.verificationMs).toBe(500)
  })

  it("detects recurring exploration pattern across runs", () => {
    const makeRecord = (taskClass: string, explorationMs: number, wallMs: number) => {
      const run = baseRun([
        {
          callIndex: 0,
          toolName: "Read",
          category: "file_read",
          startedAtMs: 0,
          endedAtMs: explorationMs,
          durationMs: explorationMs,
          exitStatus: null,
          command: "read:src/a.ts",
          filesRead: ["src/a.ts"],
          filesWritten: [],
          stdoutBytes: null,
          stderrBytes: null,
          failed: false,
          retried: false
        }
      ])
      run.taskClass = taskClass
      run.durationMs = wallMs
      return buildAttributionRecords([run])[0]!
    }
    const records = [
      makeRecord("test_addition", 4000, 5000),
      makeRecord("refactor", 4000, 5000),
      makeRecord("bug_fix", 4000, 5000),
      makeRecord("feature_addition", 4000, 5000),
      makeRecord("validation_change", 4000, 5000),
      makeRecord("cross_cutting", 4000, 5000)
    ]
    const patterns = detectRecurringPatterns(records, {
      minRuns: 5,
      minTaskClasses: 3,
      minWallShare: 0.2,
      minToolShare: 0.25
    })
    expect(patterns.some((pattern) => pattern.pattern === "exploration_overhead")).toBe(true)
    expect(decideExp004(records, 6, patterns, { minWallShare: 0.2, minToolShare: 0.25 })).toBe("STRONG_SIGNAL")
  })
})
