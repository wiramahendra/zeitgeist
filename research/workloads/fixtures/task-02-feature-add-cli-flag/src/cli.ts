export const formatStats = (values: ReadonlyArray<number>): string => {
  const total = values.reduce((sum, value) => sum + value, 0)
  return `count=${values.length} total=${total}`
}
