import { FiKey } from 'react-icons/fi';
import { EmptyState, PageHeader, TableSkeleton } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { permissionsService } from './permissionsService';

export default function PermissionsPage() {
  const { data, loading, error, reload } = useAsync(permissionsService.listGrouped, []);
  return (
    <>
      <PageHeader title="Permisos" description="Todo lo que el sistema puede controlar. Se asignan a los roles desde la sección Roles." />
      <div className="panel">
        {loading ? <TableSkeleton rows={5} /> : error ? (
          <EmptyState icon={FiKey} title="No pudimos cargar los permisos" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>
        ) : data.map(({ module, permissions }) => (
          <section className="matrix-group" key={module}>
            <h4>{module}<span className="chip">{permissions.length}</span></h4>
            <div className="chips">{permissions.map((p) => <span key={p.id} className="code">{p.code}</span>)}</div>
          </section>
        ))}
      </div>
    </>
  );
}
