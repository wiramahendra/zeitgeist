export const validateName = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0
