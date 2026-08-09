export const computeRatio = (numerator: number, denominator: number): number | null => {
  if (denominator === 0) throw new Error("division by zero")
  return numerator / denominator
}
