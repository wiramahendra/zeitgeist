#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
FIXTURES="$ROOT/research/workloads/fixtures"

write_common() {
  local dir="$1"
  mkdir -p "$dir/src"
  cat > "$dir/package.json" <<'EOF'
{
  "name": "exp-001-fixture",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "7.0.2",
    "vitest": "4.1.10"
  }
}
EOF
  cat > "$dir/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
EOF
  cat > "$dir/src/index.ts" <<'EOF'
export const identity = <T>(value: T): T => value
EOF
  cat > "$dir/README.md" <<'EOF'
# Fixture workspace
EOF
  cat > "$dir/vitest.config.ts" <<'EOF'
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"]
  }
})
EOF
}

write_common "$FIXTURES/task-01-bug-fix-median"
cat > "$FIXTURES/task-01-bug-fix-median/src/median.ts" <<'EOF'
export const median = (values: ReadonlyArray<number>): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted[middle] ?? null
}
EOF
cat > "$FIXTURES/task-01-bug-fix-median/src/median.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { median } from "./median.js"
describe("median", () => {
  it("averages central values for even length", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
})
EOF

write_common "$FIXTURES/task-02-feature-add-cli-flag"
cat > "$FIXTURES/task-02-feature-add-cli-flag/src/cli.ts" <<'EOF'
export const formatStats = (values: ReadonlyArray<number>): string => {
  const total = values.reduce((sum, value) => sum + value, 0)
  return `count=${values.length} total=${total}`
}
EOF
cat > "$FIXTURES/task-02-feature-add-cli-flag/src/cli.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { formatStats } from "./cli.js"
describe("formatStats", () => {
  it("supports json output", () => {
    expect(formatStats([1, 2, 3])).toContain("count=3")
  })
})
EOF

write_common "$FIXTURES/task-03-refactor-extract-parser"
cat > "$FIXTURES/task-03-refactor-extract-parser/src/csv.ts" <<'EOF'
export const parseCsv = (input: string): ReadonlyArray<ReadonlyArray<string>> =>
  input.split(/\n+/).filter(Boolean).map((line) => line.split(",").map((cell) => cell.trim()))
EOF
cat > "$FIXTURES/task-03-refactor-extract-parser/src/csv.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { parseCsv } from "./csv.js"
describe("parseCsv", () => {
  it("parses rows", () => {
    expect(parseCsv("a,b\n c , d ")).toEqual([["a", "b"], ["c", "d"]])
  })
})
EOF

write_common "$FIXTURES/task-04-schema-add-field"
cat > "$FIXTURES/task-04-schema-add-field/src/record.ts" <<'EOF'
export interface RecordShape { readonly id: string; readonly quantity: number }
export const validateRecord = (value: unknown): value is RecordShape => {
  if (value === null || typeof value !== "object") return false
  const candidate = value as Partial<RecordShape>
  return typeof candidate.id === "string" && typeof candidate.quantity === "number"
}
EOF
cat > "$FIXTURES/task-04-schema-add-field/src/record.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { validateRecord } from "./record.js"
describe("validateRecord", () => {
  it("accepts optional source", () => {
    expect(validateRecord({ id: "a", quantity: 1, source: "x" })).toBe(true)
  })
})
EOF

write_common "$FIXTURES/task-05-dependency-upgrade"
cat > "$FIXTURES/task-05-dependency-upgrade/src/adder.ts" <<'EOF'
export const add = (left: number, right: number): number => left + right
EOF
cat > "$FIXTURES/task-05-dependency-upgrade/src/adder.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { add } from "./adder"
describe("add", () => {
  it("sums numbers", () => {
    expect(add(2, 3)).toBe(5)
  })
})
EOF

write_common "$FIXTURES/task-06-validation-tighten"
cat > "$FIXTURES/task-06-validation-tighten/src/record.ts" <<'EOF'
export interface RecordShape { readonly id: string; readonly quantity: number }
export const validateRecord = (value: unknown): value is RecordShape => {
  if (value === null || typeof value !== "object") return false
  const candidate = value as Partial<RecordShape>
  return typeof candidate.id === "string" && typeof candidate.quantity === "number"
}
EOF
cat > "$FIXTURES/task-06-validation-tighten/src/record.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { validateRecord } from "./record.js"
describe("validateRecord", () => {
  it("rejects negative quantity", () => {
    expect(validateRecord({ id: "a", quantity: -1 })).toBe(false)
  })
})
EOF

write_common "$FIXTURES/task-07-test-addition"
cat > "$FIXTURES/task-07-test-addition/src/slugify.ts" <<'EOF'
export const slugify = (input: string): string =>
  input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
EOF
cat > "$FIXTURES/task-07-test-addition/src/slugify.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { slugify } from "./slugify.js"
describe("slugify", () => {
  it("slugifies words", () => {
    expect(slugify("Hello World")).toBe("hello-world")
  })
})
EOF

write_common "$FIXTURES/task-08-test-failure-diagnosis"
cat > "$FIXTURES/task-08-test-failure-diagnosis/src/timezone.ts" <<'EOF'
export const formatUtcHour = (date: Date): string => String(date.getHours()).padStart(2, "0")
EOF
cat > "$FIXTURES/task-08-test-failure-diagnosis/src/timezone.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { formatUtcHour } from "./timezone.js"
describe("formatUtcHour", () => {
  it("uses UTC hours", () => {
    expect(formatUtcHour(new Date("2026-01-01T15:00:00.000Z"))).toBe("15")
  })
})
EOF

write_common "$FIXTURES/task-09-cross-cutting-logging"
cat > "$FIXTURES/task-09-cross-cutting-logging/src/parser.ts" <<'EOF'
export const parse = (input: string): ReadonlyArray<string> => input.split(",")
EOF
cat > "$FIXTURES/task-09-cross-cutting-logging/src/writer.ts" <<'EOF'
export const write = (values: ReadonlyArray<string>): string => values.join(",")
EOF
cat > "$FIXTURES/task-09-cross-cutting-logging/src/logging.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { createLogger } from "./logger.js"
describe("logging", () => {
  it("creates logger", () => {
    expect(createLogger("test").info).toBeTypeOf("function")
  })
})
EOF

write_common "$FIXTURES/task-10-doc-alignment"
cat > "$FIXTURES/task-10-doc-alignment/src/cli.ts" <<'EOF'
export interface StatsOptions { readonly json?: boolean }
export const formatStats = (values: ReadonlyArray<number>, options: StatsOptions = {}): string => {
  const total = values.reduce((sum, value) => sum + value, 0)
  const payload = { count: values.length, total, average: values.length === 0 ? null : total / values.length }
  return options.json ? JSON.stringify(payload) : `count=${payload.count} total=${payload.total}`
}
EOF
cat > "$FIXTURES/task-10-doc-alignment/README.md" <<'EOF'
# Fixture CLI

Use `pnpm stats` only.
EOF
cat > "$FIXTURES/task-10-doc-alignment/src/cli.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { formatStats } from "./cli.js"
describe("formatStats", () => {
  it("formats output", () => {
    expect(formatStats([1, 2])).toContain("count=2")
  })
})
EOF

echo "Fixtures written under $FIXTURES"
