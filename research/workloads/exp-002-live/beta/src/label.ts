export const formatLabel = (label: string, value: string): string => {
  if (label === "") {
    return value
  }
  return `[${label}]: ${value}`
}
