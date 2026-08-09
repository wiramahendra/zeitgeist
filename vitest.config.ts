import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["research/workloads/fixtures/**", "node_modules/**", "dist/**", "test/research/exp-005-acceptance/**"]
  }
})
