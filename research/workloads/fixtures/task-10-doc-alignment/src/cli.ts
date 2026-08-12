export interface StatsOptions { readonly json?: boolean }
export const formatStats = (values: ReadonlyArray<number>, options: StatsOptions = {}): string => {
  const total = values.reduce((sum, value) => sum + value, 0)
  const payload = { count: values.length, total, average: values.length === 0 ? null : total / values.length }
  return options.json ? JSON.stringify(payload) : `count=${payload.count} total=${payload.total}`
}
