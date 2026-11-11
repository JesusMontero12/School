import { Tag } from '../../components/academic-ui';

const MISSING = {
  SIN_EVALUACIONES_CALIFICADAS: 'Sin notas aún',
  FALTA_PRUEBA_DE_LAPSO: 'Falta prueba de lapso',
  FALTAN_MOMENTOS: 'Faltan momentos',
};

/** Nota de un momento o anual: entero, aprobado/reprobado y si es provisional o definitiva. */
export function ResultScore({ result, detail }) {
  if (!result || result.score == null) {
    return <span className="muted-text" title={detail}>{MISSING[result?.missing] ?? '—'}</span>;
  }
  return (
    <span title={detail} style={{ display: 'inline-flex', gap: '.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <strong style={{ fontSize: '1.05rem' }}>{result.score}</strong>
      <Tag tone={result.passed ? 'ok' : 'bad'}>{result.passed ? 'Aprobado' : 'Reprobado'}</Tag>
      <Tag tone={result.status === 'DEFINITIVA' ? 'info' : 'warn'}>{result.status === 'DEFINITIVA' ? 'Definitiva' : 'Provisional'}</Tag>
    </span>
  );
}

/** Explica de dónde sale la nota del momento (promedio, aporte de la prueba de lapso, pendientes). */
export function termDetail(r) {
  if (!r || r.score == null) return undefined;
  const parts = [`Promedio de continuas: ${r.continuousAverage}/20`];
  if (r.lapsoContribution != null) parts.push(`Continuas 70 %: ${r.continuousContribution}`, `Prueba de lapso: ${r.lapsoContribution}`);
  parts.push(`Antes de redondear: ${r.rawScore}`);
  if (r.pendingEvaluations) parts.push(`${r.pendingEvaluations} evaluación(es) pendiente(s) (no cuentan como cero)`);
  return parts.join(' · ');
}
