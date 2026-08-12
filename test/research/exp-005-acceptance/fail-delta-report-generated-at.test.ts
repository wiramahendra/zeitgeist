import { describe, expect, it } from "vitest"
import { buildReport, renderReportMarkdown } from "../../src/eval/Report.js"

describe("fail-delta-report-generated-at acceptance", () => {
  it("includes generatedAt on built reports and markdown output", () => {
    const report = buildReport([])
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    const markdown = renderReportMarkdown(report)
    expect(markdown).toMatch(/Generated:/)
  })
})
