import { ConflictException } from '@nestjs/common';
import { DocumentStatus, EnrollmentStatus } from '@prisma/client';

/** Transiciones permitidas. ACTIVA → ANULADA no existe (una inscripción activa se RETIRA). RETIRADA/ANULADA son históricos. */
export const TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  PENDIENTE: ['ACTIVA', 'ANULADA'],
  ACTIVA: ['RETIRADA'],
  RETIRADA: [],
  ANULADA: [],
};

export const isTerminal = (status: EnrollmentStatus) => TRANSITIONS[status].length === 0;

/** Estados que reservan cupo en la sección. */
export const OCCUPYING: EnrollmentStatus[] = ['PENDIENTE', 'ACTIVA'];

export interface RequirementInfo { id: string; name: string }

/**
 * Expediente: se CALCULA, no se guarda. Está completo cuando ningún requisito obligatorio vigente
 * está sin entregar (también cuenta como pendiente el que aún no tiene registro).
 */
export function summarizeDocuments(
  documents: { requirementTypeId: string; status: DocumentStatus }[],
  requiredCatalog: RequirementInfo[],
) {
  const delivered = new Set(documents.filter((d) => d.status === 'ENTREGADO').map((d) => d.requirementTypeId));
  const missing = requiredCatalog.filter((r) => !delivered.has(r.id));
  return {
    required: requiredCatalog.length,
    delivered: requiredCatalog.length - missing.length,
    complete: missing.length === 0,
    missing: missing.map((m) => m.name),
  };
}

/** Plazo vencido: indicador calculado (no hay anulación automática). */
export const isOverdue = (status: EnrollmentStatus, dueDate: Date | null, today: Date) =>
  status === 'PENDIENTE' && !!dueDate && dueDate < today;

/** Una inscripción terminal (RETIRADA/ANULADA) o de un año CERRADO es historia: no se modifica. */
export function assertEditable(enrollment: { status: EnrollmentStatus; schoolYear: { status: string } }) {
  if (isTerminal(enrollment.status))
    throw new ConflictException(`La inscripción está ${enrollment.status} y es un registro histórico: no se puede modificar`);
  if (enrollment.schoolYear.status === 'CERRADO')
    throw new ConflictException('El año escolar está cerrado: sus inscripciones ya no se pueden modificar');
}
