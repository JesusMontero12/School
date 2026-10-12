import { useState } from 'react';
import { FiEdit2, FiFileText, FiPlus } from 'react-icons/fi';
import { Can, EmptyState, PageHeader, TableSkeleton } from '../../components/ui';
import { Tag } from '../../components/academic-ui';
import { useAsync } from '../../hooks/useAsync';
import RequirementFormDrawer from './RequirementFormDrawer';
import { requirementsService } from './requirementsService';

export default function RequirementsPage() {
  const [drawer, setDrawer] = useState(null); // null | 'new' | requisito
  const { data, loading, error, reload } = useAsync(() => requirementsService.list(), []);

  return (
    <>
      <PageHeader title="Requisitos de inscripción" description="Documentos que se piden al inscribir. Los obligatorios deben estar entregados para activar la inscripción.">
        <Can permission="requirement_type.create"><button className="btn-pencil" onClick={() => setDrawer('new')}><FiPlus /> Nuevo requisito</button></Can>
      </PageHeader>

      <div className="panel">
        {loading && !data ? <TableSkeleton rows={6} /> : error ? (
          <EmptyState icon={FiFileText} title="No pudimos cargar los requisitos" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Requisito</th><th>Tipo</th><th>Estado</th><th><span className="visually-hidden">Acciones</span></th></tr></thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong>{r.description && <small className="d-block muted-text">{r.description}</small>}</td>
                    <td><Tag tone={r.isRequired ? 'info' : 'muted'}>{r.isRequired ? 'Obligatorio' : 'Opcional'}</Tag></td>
                    <td><Tag tone={r.isActive ? 'ok' : 'muted'}>{r.isActive ? 'Vigente' : 'Inactivo'}</Tag></td>
                    <td><div className="actions">
                      <Can permission="requirement_type.edit"><button className="icon-btn" aria-label={`Editar ${r.name}`} onClick={() => setDrawer(r)}><FiEdit2 /></button></Can>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawer && <RequirementFormDrawer requirement={drawer === 'new' ? null : drawer} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); reload(); }} />}
    </>
  );
}
