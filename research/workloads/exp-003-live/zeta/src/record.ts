export interface RecordShape { readonly id: string; readonly quantity: number }
export const validateRecord = (value: unknown): value is RecordShape => {
  if (value === null || typeof value !== "object") return false
  const candidate = value as Partial<RecordShape>
  return typeof candidate.id === "string" && typeof candidate.quantity === "number"
}
