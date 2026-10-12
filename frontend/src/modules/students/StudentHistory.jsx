import { useState } from 'react';
import { FiClock } from 'react-icons/fi';
import { EmptyState, Pager, Spinner } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { AUDIT_ACTIONS, ENROLLMENT_STATUS, FIELD_LABELS, formatDay, formatDateTime } from '../../utils/academic';
import { studentsService } from './studentsService';

const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const show = (v) => (v == null || v === '' ? 'vacío' : isDay(v) ? formatDay(v) : String(v));

/** Frase corta con el detalle que guarda cada acción de auditoría. */
function detail(log) {
  const m = log.metadata ?? {};
  if (log.action === 'enrollment.status') return `${ENROLLMENT_STATUS[m.from]?.label ?? m.from} → ${ENROLLMENT_STATUS[m.to]?.label ?? m.to}${m.reason ? ` · ${m.reason}` : ''}`;
  if (log.action === 'enrollment.create') return m.receiptNumber ? `Recibo ${m.receiptNumber} · ${ENROLLMENT_STATUS[m.status]?.label ?? m.status}` : null;
  return null;
}

/** Quién cambió qué y cuándo (alumno e inscripciones). Solo personal del colegio. */
export default function StudentHistory({ studentId }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => studentsService.history(studentId, { page, limit: 10 }), [studentId, page]);

  if (loading && !data) return <div className="panel-body"><Spinner /></div>;
  if (error) return <EmptyState icon={FiClock} title="No pudimos cargar el historial" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>;
  if (data.data.length === 0) return <EmptyState icon={FiClock} title="Sin movimientos" text="Aún no se registran cambios de este alumno." />;

  return (
    <>
      <ul className="timeline">
        {data.data.map((log) => {
          const changes = Object.entries(log.metadata?.changes ?? {});
          const extra = detail(log);
          return (
            <li key={log.id}>
              <strong>{AUDIT_ACTIONS[log.action] ?? log.action}</strong>
              <div className="when">{formatDateTime(log.createdAt)} · {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sistema'}</div>
              {extra && <div style={{ fontSize: '.875rem' }}>{extra}</div>}
              {changes.length > 0 && (
                <ul className="changes">
                  {changes.map(([field, [from, to]]) => <li key={field}><b>{FIELD_LABELS[field] ?? field}:</b> {show(from)} → {show(to)}</li>)}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <Pager meta={data.meta} onPage={setPage} />
    </>
  );
}
