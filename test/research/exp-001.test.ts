import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { createRunIdentity } from "../../research/harness/RunIdentity.js"
import { parseRawResultsJsonl, appendRawResult } from "../../research/harness/AgentRunner.js"
import {
  categorizeCommand,
  categorizeToolName,
  normalizeAgentRun,
  repeatedCommands,
  repeatedFileReads
} from "../../research/harness/TraceNormalizer.js"
import { computeRunMetrics, median } from "../../research/harness/Metrics.js"
import type { RawAgentRun } from "../../research/harness/AgentRun.js"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

const baseRun = (): RawAgentRun => ({
  schemaVersion: "1.0",
  experimentId: "EXP-001",
  experimentVersion: "1.0.0",
  repositoryCommit: "abc123",
  taskSetDigest: "digest",
  runnerIdentity: "runner",
  runnerConfigDigest: "config",
  taskId: "task-a",
  runIndex: 0,
  runIdentity: "will-be-set",
  taskClass: "bug_fix",
  startedAt: "2026-08-09T00:00:00.000Z",
  completedAt: "2026-08-09T00:00:10.000Z",
  durationMs: 10_000,
  finalStatus: "SUCCESS",
  modelIdentity: null,
  modelTurnCount: null,
  inputTokens: null,
  outputTokens: null,
  modelRequestDurationMs: null,
  toolCalls: [
    {
      callIndex: 0,
      toolName: "Read",
      category: "file_read",
      startedAtMs: 100,
      endedAtMs: 200,
      durationMs: 100,
      exitStatus: 0,
      command: "read:src/a.ts",
      filesRead: ["src/a.ts"],
      filesWritten: [],
      stdoutBytes: 10,
      stderrBytes: 0,
      failed: false,
      retried: false
    },
    {
      callIndex: 1,
      toolName: "Read",
      category: "file_read",
      startedAtMs: 300,
      endedAtMs: 400,
      durationMs: 100,
      exitStatus: 0,
      command: "read:src/a.ts",
      filesRead: ["src/a.ts"],
      filesWritten: [],
      stdoutBytes: 10,
      stderrBytes: 0,
      failed: false,
      retried: true
    },
    {
      callIndex: 2,
      toolName: "Shell",
      category: "test",
      startedAtMs: 500,
      endedAtMs: 1500,
      durationMs: 1000,
      exitStatus: 0,
      command: "pnpm test",
      filesRead: [],
      filesWritten: [],
      stdoutBytes: 100,
      stderrBytes: 0,
      failed: false,
      retried: false
    }
  ],
  unavailableMetrics: ["model_request_duration_ms"],
  notes: []
})

describe("run identity", () => {
  it("is deterministic", () => {
    const input = {
      experimentId: "EXP-001",
      experimentVersion: "1.0.0",
      repositoryCommit: "abc",
      taskSetDigest: "taskset",
      runnerIdentity: "runner",
      runnerConfigDigest: "cfg",
      taskId: "task-1",
      runIndex: 0
    }
    expect(createRunIdentity(input)).toBe(createRunIdentity(input))
  })
})

describe("result store", () => {
  it("rejects malformed JSONL", async () => {
    const either = await Effect.runPromise(Effect.either(parseRawResultsJsonl("{broken", "raw.jsonl")))
    expect(either._tag).toBe("Left")
  })

  it("rejects duplicate run identities", async () => {
    const run = baseRun()
    run.runIdentity = "same"
    const line = JSON.stringify(run)
    const either = await Effect.runPromise(Effect.either(parseRawResultsJsonl(`${line}\n${line}\n`, "raw.jsonl")))
    expect(either._tag).toBe("Left")
  })

  it("rejects duplicate append", async () => {
    const dir = await mkdtemp(join(tmpdir(), "exp001-"))
    const path = join(dir, "raw.jsonl")
    const run = { ...baseRun(), runIdentity: createRunIdentity({
      experimentId: "EXP-001", experimentVersion: "1.0.0", repositoryCommit: "abc", taskSetDigest: "d",
      runnerIdentity: "r", runnerConfigDigest: "c", taskId: "task-a", runIndex: 0
    }) }
    await Effect.runPromise(appendRawResult(path, run))
    const second = await Effect.runPromise(Effect.either(appendRawResult(path, run)))
    expect(second._tag).toBe("Left")
    await rm(dir, { recursive: true, force: true })
  })
})

describe("trace normalization", () => {
  it("categorizes commands and tool names", () => {
    expect(categorizeToolName("Grep")).toBe("search")
    expect(categorizeCommand("pnpm test")).toBe("test")
    expect(categorizeCommand("git status")).toBe("git")
  })

  it("detects repeated file reads and commands", () => {
    const run = normalizeAgentRun(baseRun())
    expect(repeatedFileReads(run.toolCalls).repeated).toBe(1)
    expect(repeatedCommands(run.toolCalls).repeated).toBe(1)
  })
})

describe("metrics", () => {
  it("computes duration and duplicate metrics", () => {
    const metrics = computeRunMetrics(normalizeAgentRun(baseRun()))
    expect(metrics.deterministicToolDurationMs).toBe(1200)
    expect(metrics.duplicateFileReadRatio).toBeCloseTo(0.5)
    expect(metrics.unavailableMetrics).toContain("model_request_duration_ms")
  })

  it("handles missing metrics without estimation", () => {
    const metrics = computeRunMetrics(normalizeAgentRun(baseRun()))
    expect(metrics.modelRequestDurationMs).toBeNull()
    expect(metrics.modelTimeShare).toBeNull()
  })

  it("computes medians deterministically", () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([])).toBeNull()
  })
})

describe("report determinism", () => {
  it("canonicalizes identical metric input consistently", async () => {
    const run = normalizeAgentRun(baseRun())
    const first = JSON.stringify(computeRunMetrics(run))
    const second = JSON.stringify(computeRunMetrics(run))
    expect(first).toBe(second)
  })
})

describe("failure classification", () => {
  it("preserves task failure status", () => {
    const run = baseRun()
    run.finalStatus = "TASK_FAILED"
    const metrics = computeRunMetrics(normalizeAgentRun(run))
    expect(metrics.finalStatus).toBe("TASK_FAILED")
  })
})

describe("incomplete experiment reporting", () => {
  it("marks missing tasks as incomplete via aggregate helper", async () => {
    const { computeAggregateMetrics } = await import("../../research/harness/Metrics.js")
    const metrics = [computeRunMetrics(normalizeAgentRun(baseRun()))]
    const aggregate = computeAggregateMetrics(metrics, ["task-a", "task-b"])
    expect(aggregate.incomplete).toBe(true)
    expect(aggregate.missingRuns).toEqual(["task-b"])
  })
})

describe("overlapping timing", () => {
  it("flags overlapping tool calls as unsupported", () => {
    const run = baseRun()
    run.toolCalls = [
      { ...run.toolCalls[0]!, startedAtMs: 0, endedAtMs: 500, durationMs: 500 },
      { ...run.toolCalls[1]!, startedAtMs: 100, endedAtMs: 400, durationMs: 300 }
    ]
    const normalized = normalizeAgentRun(run)
    expect(normalized.timingSemantics).toBe("overlapping_unsupported")
    const metrics = computeRunMetrics(normalized)
    expect(metrics.toolTimeShare).toBeNull()
    expect(metrics.unavailableMetrics).toContain("overlapping_timing_aggregation")
  })
})
