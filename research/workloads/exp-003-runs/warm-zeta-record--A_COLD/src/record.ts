export interface RecordShape { readonly id: string; readonly quantity: number; readonly source?: string }
export const validateRecord = (value: unknown): value is RecordShape => {
  if (value === null || typeof value !== "object") return false
  const candidate = value as Partial<RecordShape>
  return typeof candidate.id === "string" && typeof candidate.quantity === "number" && (candidate.source === undefined || typeof candidate.source === "string")
}
