export const validateName = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0
