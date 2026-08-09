import { defineConfig } from "vitest/config"

/** EXP-005V audit-only config: runs hidden acceptance tests excluded from default vitest.config.ts */
export default defineConfig({
  test: {
    include: ["test/research/exp-005-acceptance/**/*.test.ts"],
    exclude: ["research/workloads/fixtures/**", "node_modules/**", "dist/**"]
  }
})
