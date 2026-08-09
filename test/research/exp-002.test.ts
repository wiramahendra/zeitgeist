import { describe, expect, it } from "vitest"
import { parseCloudTranscript, transcriptToRawAgentRun } from "../../research/harness/CloudTranscriptAdapter.js"

describe("cloud transcript adapter", () => {
  const sampleTranscript = {
    messages: [
      { role: "user", text: "Fix the bug" },
      {
        role: "assistant",
        tool_calls: [
          {
            tool_call_id: "turn-0:step:1:tool",
            tool_name: "read_file",
            tool_args: { path: "src/a.ts" },
            started_at_ms: 1000,
            completed_at_ms: 1100,
            duration_ms: 100
          }
        ]
      },
      {
        role: "tool",
        tool_call_id: "turn-0:step:1:tool",
        tool_name: "read_file",
        started_at_ms: 1000,
        completed_at_ms: 1100,
        duration_ms: 100,
        tool_result: { resultType: "readFileResult", value: { contents: "hello" } }
      },
      {
        role: "assistant",
        tool_calls: [
          {
            tool_call_id: "turn-0:step:2:tool",
            tool_name: "run_terminal_cmd",
            tool_args: { command: "pnpm test" },
            started_at_ms: 1200,
            completed_at_ms: 1700,
            duration_ms: 500
          }
        ]
      },
      {
        role: "tool",
        tool_call_id: "turn-0:step:2:tool",
        tool_name: "run_terminal_cmd",
        started_at_ms: 1200,
        completed_at_ms: 1700,
        duration_ms: 500,
        tool_result: { resultType: "runTerminalCommandV2Result", value: { output: "ok", exitCode: 0 } }
      }
    ]
  }

  it("parses transcript messages", () => {
    const parsed = parseCloudTranscript(sampleTranscript)
    expect(parsed.messages.length).toBe(5)
  })

  it("normalizes tool calls with categories and durations", () => {
    const run = transcriptToRawAgentRun({
      experimentId: "EXP-002",
      experimentVersion: "1.0.0",
      repositoryCommit: "abc",
      taskSetDigest: "digest",
      runnerIdentity: "cloud-transcript-adapter/v1",
      runnerConfigDigest: "cfg",
      modelIdentity: "composer-2.5-fast",
      task: {
        taskId: "live-alpha-ratio",
        taskClass: "bug_fix",
        title: "t",
        description: "d",
        workspacePath: "research/workloads/exp-002-live/alpha"
      },
      runIndex: 0,
      transcript: parseCloudTranscript(sampleTranscript),
      cloudAgentBcId: "bc-test"
    })
    expect(run.toolCalls.length).toBe(2)
    expect(run.toolCalls[0]?.category).toBe("file_read")
    expect(run.toolCalls[1]?.category).toBe("test")
    expect(run.modelTurnCount).toBe(1)
    expect(run.inputTokens).toBeNull()
    expect(run.durationMs).toBe(700)
  })

  it("marks failed terminal commands", () => {
    const failed = parseCloudTranscript({
      messages: [
        {
          role: "assistant",
          tool_calls: [
            {
              tool_call_id: "t1",
              tool_name: "run_terminal_cmd",
              tool_args: { command: "pnpm test" },
              started_at_ms: 0,
              completed_at_ms: 100,
              duration_ms: 100
            }
          ]
        },
        {
          role: "tool",
          tool_call_id: "t1",
          tool_name: "run_terminal_cmd",
          started_at_ms: 0,
          completed_at_ms: 100,
          duration_ms: 100,
          tool_result: { value: { exitCode: 1, output: "fail" } }
        }
      ]
    })
    const run = transcriptToRawAgentRun({
      experimentId: "EXP-002",
      experimentVersion: "1.0.0",
      repositoryCommit: "abc",
      taskSetDigest: "digest",
      runnerIdentity: "cloud-transcript-adapter/v1",
      runnerConfigDigest: "cfg",
      modelIdentity: null,
      task: {
        taskId: "live-alpha-ratio",
        taskClass: "bug_fix",
        title: "t",
        description: "d",
        workspacePath: "x"
      },
      runIndex: 0,
      transcript: failed,
      cloudAgentBcId: null,
      finalStatus: "TASK_FAILED"
    })
    expect(run.toolCalls[0]?.failed).toBe(true)
    expect(run.finalStatus).toBe("TASK_FAILED")
  })

  it("falls back to tool result timestamps when call timing is missing", () => {
    const transcript = parseCloudTranscript({
      messages: [
        {
          role: "assistant",
          tool_calls: [
            {
              tool_call_id: "t1",
              tool_name: "grep",
              tool_args: { pattern: "foo" }
            }
          ]
        },
        {
          role: "tool",
          tool_call_id: "t1",
          tool_name: "grep",
          started_at_ms: 500,
          completed_at_ms: 650,
          duration_ms: 150,
          tool_result: { value: { results: [] } }
        }
      ]
    })
    const run = transcriptToRawAgentRun({
      experimentId: "EXP-002",
      experimentVersion: "1.0.0",
      repositoryCommit: "abc",
      taskSetDigest: "digest",
      runnerIdentity: "cloud-transcript-adapter/v1",
      runnerConfigDigest: "cfg",
      modelIdentity: null,
      task: {
        taskId: "live-alpha-ratio",
        taskClass: "bug_fix",
        title: "t",
        description: "d",
        workspacePath: "x"
      },
      runIndex: 0,
      transcript,
      cloudAgentBcId: null
    })
    expect(run.durationMs).toBe(150)
    expect(run.startedAt).toMatch(/T/)
  })
})
