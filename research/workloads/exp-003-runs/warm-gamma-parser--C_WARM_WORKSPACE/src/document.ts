export const parseLine = (line: string): ReadonlyArray<string> =>
  line.split(",").map((cell) => cell.trim())

export const parseDocument = (input: string): ReadonlyArray<ReadonlyArray<string>> =>
  input.split(/\n+/).filter(Boolean).map(parseLine)
