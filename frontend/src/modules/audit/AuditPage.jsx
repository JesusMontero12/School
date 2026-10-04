import { useState } from 'react';
import { FiActivity } from 'react-icons/fi';
import { EmptyState, PageHeader, Pager, TableSkeleton } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { formatDate } from '../../utils/format';
import { auditService } from './auditService';

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => auditService.list({ page, limit: 15 }), [page]);
  return (
    <>
      <PageHeader title="Auditoría" description="Registro de accesos y cambios sensibles, del más reciente al más antiguo." />
      <div className="panel">
        {loading && !data ? <TableSkeleton /> : error ? (
          <EmptyState icon={FiActivity} title="No pudimos cargar el registro" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>
        ) : data.data.length === 0 ? (
          <EmptyState icon={FiActivity} title="Sin actividad todavía" text="Los accesos y cambios aparecerán aquí a medida que ocurran." />
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Fecha</th><th>Persona</th><th>Acción</th><th>Entidad</th><th>IP</th></tr></thead>
              <tbody>{data.data.map((l) => (
                <tr key={l.id}>
                  <td>{formatDate(l.createdAt)}</td>
                  <td>{l.user ? `${l.user.firstName} ${l.user.lastName}` : <span style={{ color: 'var(--muted)' }}>Sistema</span>}</td>
                  <td><span className="code">{l.action}</span></td>
                  <td>{l.entity}</td>
                  <td style={{ color: 'var(--muted)' }}>{l.ip ?? '—'}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </div>
    </>
  );
}
