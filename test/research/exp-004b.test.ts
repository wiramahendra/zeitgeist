import { describe, expect, it } from "vitest"
import type { CloudTranscript } from "../../research/harness/CloudTranscriptAdapter.js"
import {
  buildGapAttributionRunRecord,
  buildTelemetryCapabilityAudit,
  computeGapAttribution,
  decideExp004b,
  detectDominantGapCause,
  GAP_ATTRIBUTION_CATEGORIES,
  type GapAttributionRunRecord
} from "../../research/harness/GapAttribution.js"
import type { RawAgentRun } from "../../research/harness/AgentRun.js"
import { normalizeAgentRun } from "../../research/harness/TraceNormalizer.js"

const baseRun = (toolCalls: RawAgentRun["toolCalls"]): RawAgentRun => ({
  schemaVersion: "1.0",
  experimentId: "EXP-004b",
  experimentVersion: "1.0.0",
  repositoryCommit: "abc",
  taskSetDigest: "digest",
  runnerIdentity: "gap-attribution/v1",
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

const transcriptWithGaps = (): CloudTranscript => ({
  messages: [
    { role: "user", text: "task" },
    {
      role: "assistant",
      tool_calls: [
        {
          tool_call_id: "a",
          tool_name: "Read",
          started_at_ms: 1000,
          completed_at_ms: 1100,
          duration_ms: 100
        }
      ]
    },
    {
      role: "tool",
      tool_call_id: "a",
      tool_name: "Read",
      started_at_ms: 1000,
      completed_at_ms: 1100,
      duration_ms: 100,
      tool_result: { value: {} }
    },
    { role: "assistant", thinking: "plan next", text: "next" },
    {
      role: "assistant",
      tool_calls: [
        {
          tool_call_id: "b",
          tool_name: "Shell",
          started_at_ms: 2000,
          completed_at_ms: 2500,
          duration_ms: 500
        }
      ]
    },
    {
      role: "tool",
      tool_call_id: "b",
      tool_name: "Shell",
      started_at_ms: 2000,
      completed_at_ms: 2500,
      duration_ms: 500,
      tool_result: { value: { exitCode: 0 } }
    }
  ]
})

describe("gap attribution", () => {
  it("measures inter-batch gap duration from transcript timestamps", () => {
    const run = baseRun([
      {
        callIndex: 0,
        toolName: "Read",
        category: "file_read",
        startedAtMs: 0,
        endedAtMs: 100,
        durationMs: 100,
        exitStatus: null,
        command: "read:a",
        filesRead: ["a"],
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
        startedAtMs: 1000,
        endedAtMs: 1500,
        durationMs: 500,
        exitStatus: 0,
        command: "pnpm test",
        filesRead: [],
        filesWritten: [],
        stdoutBytes: null,
        stderrBytes: null,
        failed: false,
        retried: false
      }
    ])
    const result = computeGapAttribution(normalizeAgentRun(run), transcriptWithGaps())
    expect(result.gapCount).toBe(1)
    expect(result.interBatchGapMs).toBe(900)
    expect(result.gaps[0]?.durationMs).toBe(900)
  })

  it("attributes only tool result processing when result completes after batch end", () => {
    const transcript: CloudTranscript = {
      messages: [
        {
          role: "assistant",
          tool_calls: [
            {
              tool_call_id: "a",
              tool_name: "Read",
              started_at_ms: 0,
              completed_at_ms: 100,
              duration_ms: 100
            }
          ]
        },
        {
          role: "tool",
          tool_call_id: "a",
          tool_name: "Read",
          started_at_ms: 0,
          completed_at_ms: 250,
          duration_ms: 250,
          tool_result: { value: {} }
        },
        {
          role: "assistant",
          tool_calls: [
            {
              tool_call_id: "b",
              tool_name: "Shell",
              started_at_ms: 1000,
              completed_at_ms: 1100,
              duration_ms: 100
            }
          ]
        }
      ]
    }
    const run = baseRun([
      {
        callIndex: 0,
        toolName: "Read",
        category: "file_read",
        startedAtMs: 0,
        endedAtMs: 100,
        durationMs: 100,
        exitStatus: null,
        command: "read:a",
        filesRead: ["a"],
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
        startedAtMs: 1000,
        endedAtMs: 1100,
        durationMs: 100,
        exitStatus: 0,
        command: "pnpm test",
        filesRead: [],
        filesWritten: [],
        stdoutBytes: null,
        stderrBytes: null,
        failed: false,
        retried: false
      }
    ])
    const result = computeGapAttribution(normalizeAgentRun(run), transcript)
    expect(result.categoryMs.tool_result_context_processing).toBe(150)
    expect(result.categoryMs.UNATTRIBUTED).toBe(750)
    expect(result.attributableShare).toBeCloseTo(150 / 900, 5)
  })

  it("marks entire gap UNATTRIBUTED when no sub-phase timestamps exist", () => {
    const run = baseRun([
      {
        callIndex: 0,
        toolName: "Read",
        category: "file_read",
        startedAtMs: 0,
        endedAtMs: 100,
        durationMs: 100,
        exitStatus: null,
        command: "read:a",
        filesRead: ["a"],
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
        startedAtMs: 1000,
        endedAtMs: 1500,
        durationMs: 500,
        exitStatus: 0,
        command: "pnpm test",
        filesRead: [],
        filesWritten: [],
        stdoutBytes: null,
        stderrBytes: null,
        failed: false,
        retried: false
      }
    ])
    const result = computeGapAttribution(normalizeAgentRun(run), transcriptWithGaps())
    expect(result.categoryMs.tool_result_context_processing).toBe(0)
    expect(result.categoryMs.model_provider_latency).toBe(0)
    expect(result.categoryMs.agent_model_processing).toBe(0)
    expect(result.categoryMs.harness_scheduling).toBe(0)
    expect(result.categoryMs.UNATTRIBUTED).toBe(900)
    expect(result.attributableShare).toBe(0)
  })

  it("returns INVALID when attributable share is below threshold", () => {
    const record = buildGapAttributionRunRecord(
      baseRun([
        {
          callIndex: 0,
          toolName: "Read",
          category: "file_read",
          startedAtMs: 0,
          endedAtMs: 100,
          durationMs: 100,
          exitStatus: null,
          command: "read:a",
          filesRead: ["a"],
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
          startedAtMs: 500,
          endedAtMs: 600,
          durationMs: 100,
          exitStatus: 0,
          command: "pnpm test",
          filesRead: [],
          filesWritten: [],
          stdoutBytes: null,
          stderrBytes: null,
          failed: false,
          retried: false
        }
      ]),
      transcriptWithGaps(),
      "bc-test"
    )
    const records: ReadonlyArray<GapAttributionRunRecord> = [record]
    expect(decideExp004b(records, { minAttributableShare: 0.8, minDominantShare: 0.5, minTaskClasses: 3 })).toBe(
      "INVALID"
    )
  })

  it("documents telemetry fields that cannot support causal gap attribution", () => {
    const audit = buildTelemetryCapabilityAudit(false)
    const thinking = audit.transcriptMessageFields.find((field) => field.field.includes("thinking"))
    expect(thinking?.supportsCausalAttribution).toBe(false)
    expect(audit.cloudEventsAvailable).toBe(false)
    expect(GAP_ATTRIBUTION_CATEGORIES).toContain("UNATTRIBUTED")
  })

  it("does not detect a dominant cause when all gap time is unattributed", () => {
    const record = buildGapAttributionRunRecord(baseRun([]), transcriptWithGaps(), null)
    const dominant = detectDominantGapCause([record], { minShare: 0.5, minTaskClasses: 1 })
    expect(dominant).toBeNull()
  })
})
