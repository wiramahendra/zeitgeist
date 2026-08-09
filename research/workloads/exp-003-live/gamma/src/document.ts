export const parseDocument = (input: string): ReadonlyArray<ReadonlyArray<string>> =>
  input.split(/\n+/).filter(Boolean).map((line) => line.split(",").map((cell) => cell.trim()))
