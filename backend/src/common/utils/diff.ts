type Scalar = string | number | boolean | null;

const normalize = (value: unknown): Scalar => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10); // solo se comparan fechas "día"
  return value as Scalar;
};

/**
 * Cambios campo por campo para el historial de auditoría: { campo: [antes, después] }.
 * Solo incluye los campos que realmente cambiaron.
 */
export function diffFields(before: object, after: object, fields: string[]): Record<string, [Scalar, Scalar]> {
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  const changes: Record<string, [Scalar, Scalar]> = {};
  for (const field of fields) {
    const from = normalize(a[field]);
    const to = normalize(b[field]);
    if (from !== to) changes[field] = [from, to];
  }
  return changes;
}
