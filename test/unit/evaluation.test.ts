import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { Effect, Schema } from "effect"
import { EvidenceCollection } from "../../src/domain/Evidence.js"
import { ExpectedOutcome } from "../../src/domain/ExpectedOutcome.js"
import { Incident } from "../../src/domain/Incident.js"
import { IncidentContext } from "../../src/domain/IncidentContext.js"
import type { IncidentDataset } from "../../src/dataset/DatasetLoader.js"
import { makeExperimentInput, runSingleEvaluation } from "../../src/eval/Evaluation.js"
import { makeFakeRunner } from "../../src/eval/AgentRunner.js"
import { createRunIdentity } from "../../src/eval/RunIdentity.js"
import { scoreAgentResult } from "../../src/eval/Scorer.js"
import { buildReport, renderReportMarkdown, type EvaluationReport } from "../../src/eval/Report.js"

const load = async <A, I>(name: string, schema: Schema.Schema<A, I>): Promise<A> => {
  const raw = JSON.parse(await readFile(new URL(`../../fixtures/synthetic-example/${name}`, import.meta.url), "utf8")) as unknown
  return Effect.runPromise(Schema.decodeUnknown(schema)(raw))
}

const dataset = async (): Promise<IncidentDataset> => {
  const incident = await load("incident.json", Incident)
  const evidence = await load("evidence.json", EvidenceCollection)
  const context = await load("context.json", IncidentContext)
  const expected = await load("expected.json", ExpectedOutcome)
  return { directory: "synthetic", incident, evidence, context, expected, rawContext: context }
}

const correctResult = {
  finalDiagnosis: "checkout-api experienced an inventory-api timeout",
  rootCauseCategory: "upstream-timeout",
  affectedComponents: ["checkout-api"],
  triggerEntities: ["inventory-api"],
  citedEvidenceIds: ["ev-error-001"],
  remediationIds: ["rollback-checkout-v184"]
} as const

describe("evaluation core", () => {
  it("keeps control and manual-context inputs structurally separate", async () => {
    const loaded = await dataset()
    expect("context" in makeExperimentInput(loaded, "CONTROL")).toBe(false)
    expect("context" in makeExperimentInput(loaded, "MANUAL_CONTEXT")).toBe(true)
  })

  it("creates deterministic identities bound to every identity input", () => {
    const input = { incidentId: "i", condition: "CONTROL" as const, repetitionIndex: 0, runnerIdentity: "r", promptConfigDigest: "p", contextDigest: null }
    expect(createRunIdentity(input)).toBe(createRunIdentity({ ...input }))
    expect(createRunIdentity(input)).not.toBe(createRunIdentity({ ...input, repetitionIndex: 1 }))
  })

  it("scores exact deterministic evidence and entities as correct", async () => {
    const loaded = await dataset()
    expect(scoreAgentResult(correctResult, loaded.expected).status).toBe("CORRECT")
  })

  it("requires human adjudication for plausible non-deterministic text", async () => {
    const loaded = await dataset()
    expect(scoreAgentResult({ finalDiagnosis: "An upstream became slow" }, loaded.expected).status).toBe("NEEDS_HUMAN_ADJUDICATION")
  })

  it("records unavailable optional metrics as absent, not zero", async () => {
    const loaded = await dataset()
    const runner = makeFakeRunner("fake-v1", () => correctResult)
    const result = await Effect.runPromise(runSingleEvaluation(loaded, "CONTROL", 0, runner, {}))
    expect(result.agentResult.toolCallCount).toBeUndefined()
    expect(result.contextDigest).toBeNull()
  })

  it("cannot mistake synthetic fixtures for research incidents or complete evidence", async () => {
    const loaded = await dataset()
    const runner = makeFakeRunner("fake-v1", () => correctResult)
    const result = await Effect.runPromise(runSingleEvaluation(loaded, "CONTROL", 0, runner, {}))
    const report = buildReport([result])
    expect(report.distinctResearchIncidents).toBe(0)
    expect(report.experimentStatus).toBe("INCOMPLETE")
  })

  it("renders deterministic aggregate data", async () => {
    const loaded = await dataset()
    const runner = makeFakeRunner("fake-v1", () => correctResult)
    const result = await Effect.runPromise(runSingleEvaluation(loaded, "CONTROL", 0, runner, {}))
    expect(buildReport([result])).toEqual(buildReport([result]))
  })

  it("renders total evaluations as the sum of control and manual-context runs", async () => {
    const loaded = await dataset()
    const runner = makeFakeRunner("fake-v1", () => correctResult)
    const control = await Effect.runPromise(runSingleEvaluation(loaded, "CONTROL", 0, runner, {}))
    const manualContext = await Effect.runPromise(runSingleEvaluation(loaded, "MANUAL_CONTEXT", 0, runner, {}))
    const report = buildReport([control, manualContext])
    const markdown = renderReportMarkdown(report)
    expect(markdown).toContain(`Total evaluations: ${report.control.runCount + report.manualContext.runCount}`)
  })

  it("uses a configurable minimum incident count for completeness", async () => {
    const loaded = await dataset()
    const runner = makeFakeRunner("fake-v1", () => correctResult)
    const result = await Effect.runPromise(runSingleEvaluation(loaded, "CONTROL", 0, runner, {}))
    expect(buildReport([result]).completenessReasons).toContain("Fewer than 10 distinct real incident results")
    expect(buildReport([result], { minIncidents: 0 }).completenessReasons).not.toContain(
      "Fewer than 0 distinct real incident results"
    )
    expect(buildReport([result], { minIncidents: 1 }).completenessReasons).toContain(
      "Fewer than 1 distinct real incident results"
    )
  })

  it("shows needs human adjudication counts in report markdown", () => {
    const emptyMetrics = {
      runCount: 0,
      correctCount: 0,
      needsHumanAdjudicationCount: 0,
      diagnosticAccuracy: null,
      medianDurationMs: null,
      medianTimeToCorrectHypothesisMs: null,
      medianToolCalls: null,
      medianTotalTokens: null,
      medianHumanInterventions: null,
      medianFalseHighConfidenceHypotheses: null,
      missingMetrics: []
    }
    const report: EvaluationReport = {
      schemaVersion: "1.0",
      generatedFrom: "results.jsonl",
      experimentStatus: "INCOMPLETE",
      completenessReasons: [],
      distinctResearchIncidents: 0,
      control: { ...emptyMetrics, runCount: 3, needsHumanAdjudicationCount: 2 },
      manualContext: { ...emptyMetrics, runCount: 3, needsHumanAdjudicationCount: 1 },
      comparisons: { medianToolCallReduction: null, medianTimeToCorrectHypothesisReduction: null }
    }
    const markdown = renderReportMarkdown(report)
    expect(markdown).toContain("## Control")
    expect(markdown).toContain("- Needs human adjudication: 2")
    expect(markdown).toContain("## Manual context")
    expect(markdown).toContain("- Needs human adjudication: 1")
  })
})
