import { Effect } from "effect"
import { ContextBudgetExceeded } from "../errors/ContextErrors.js"
import { canonicalize } from "./Canonicalize.js"

export const DEFAULT_CONTEXT_BUDGET_BYTES = 25 * 1024

export const validateContextBudget = (
  context: unknown,
  maximumBytes = DEFAULT_CONTEXT_BUDGET_BYTES
): Effect.Effect<number, ContextBudgetExceeded> => {
  const actualBytes = Buffer.byteLength(canonicalize(context), "utf8")
  return actualBytes <= maximumBytes
    ? Effect.succeed(actualBytes)
    : Effect.fail(new ContextBudgetExceeded({ actualBytes, maximumBytes }))
}
