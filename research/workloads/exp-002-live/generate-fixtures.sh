#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
BASE="$ROOT/research/workloads/exp-002-live"

write_pkg() {
  local dir="$1"
  mkdir -p "$dir/src"
  cat > "$dir/package.json" <<'EOF'
{
  "name": "exp-002-live-fixture",
  "private": true,
  "type": "module",
  "scripts": { "test": "vitest run" },
  "devDependencies": { "typescript": "7.0.2", "vitest": "4.1.10" }
}
EOF
  cat > "$dir/tsconfig.json" <<'EOF'
{ "compilerOptions": { "target": "ES2023", "module": "NodeNext", "moduleResolution": "NodeNext", "strict": true, "noEmit": true }, "include": ["src/**/*.ts"] }
EOF
  cat > "$dir/vitest.config.ts" <<'EOF'
import { defineConfig } from "vitest/config"
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } })
EOF
}

write_pkg "$BASE/alpha"
cat > "$BASE/alpha/src/ratio.ts" <<'EOF'
export const computeRatio = (numerator: number, denominator: number): number | null => {
  if (denominator === 0) throw new Error("division by zero")
  return numerator / denominator
}
EOF
cat > "$BASE/alpha/src/ratio.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { computeRatio } from "./ratio.js"
describe("computeRatio", () => {
  it("returns null for zero denominator", () => {
    expect(computeRatio(1, 0)).toBeNull()
  })
  it("divides normally", () => {
    expect(computeRatio(4, 2)).toBe(2)
  })
})
EOF

write_pkg "$BASE/beta"
cat > "$BASE/beta/src/label.ts" <<'EOF'
export const formatLabel = (_label: string, _value: string): string => {
  throw new Error("not implemented")
}
EOF
cat > "$BASE/beta/src/label.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { formatLabel } from "./label.js"
describe("formatLabel", () => {
  it("prefixes non-empty labels", () => {
    expect(formatLabel("name", "Ada")).toBe("[name]: Ada")
  })
  it("returns bare value for empty label", () => {
    expect(formatLabel("", "Ada")).toBe("Ada")
  })
})
EOF

write_pkg "$BASE/gamma"
cat > "$BASE/gamma/src/document.ts" <<'EOF'
export const parseDocument = (input: string): ReadonlyArray<ReadonlyArray<string>> =>
  input.split(/\n+/).filter(Boolean).map((line) => line.split(",").map((cell) => cell.trim()))
EOF
cat > "$BASE/gamma/src/document.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { parseDocument } from "./document.js"
describe("parseDocument", () => {
  it("parses lines", () => {
    expect(parseDocument("a,b\n c , d ")).toEqual([["a", "b"], ["c", "d"]])
  })
})
EOF

write_pkg "$BASE/delta"
cat > "$BASE/delta/src/slugify.ts" <<'EOF'
export const slugify = (input: string): string =>
  input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
EOF
cat > "$BASE/delta/src/slugify.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { slugify } from "./slugify.js"
describe("slugify", () => {
  it("slugifies words", () => {
    expect(slugify("Hello World")).toBe("hello-world")
  })
})
EOF

write_pkg "$BASE/epsilon"
cat > "$BASE/epsilon/src/name.ts" <<'EOF'
export const validateName = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0
EOF
cat > "$BASE/epsilon/src/name.test.ts" <<'EOF'
import { describe, expect, it } from "vitest"
import { validateName } from "./name.js"
describe("validateName", () => {
  it("rejects whitespace-only strings", () => {
    expect(validateName("   ")).toBe(false)
  })
  it("accepts normal names", () => {
    expect(validateName("alpha")).toBe(true)
  })
})
EOF

echo "EXP-002 live fixtures written under $BASE"
