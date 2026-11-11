import { useState } from 'react';
import { FiEdit2, FiPlus, FiSearch, FiUserCheck } from 'react-icons/fi';
import { Can, EmptyState, PageHeader, Pager, TableSkeleton } from '../../components/ui';
import { Tag } from '../../components/academic-ui';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import TeacherFormDrawer from './TeacherFormDrawer';
import { teachersService } from './teachersService';

export default function TeachersPage() {
  const [filters, setFilters] = useState({ search: '', isActive: '' });
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null);
  const search = useDebounce(filters.search);
  const { data, loading, error, reload } = useAsync(
    () => teachersService.list({ page, limit: 10, search: search || undefined, isActive: filters.isActive || undefined }), [page, search, filters.isActive]);
  const setFilter = (k) => (e) => { setPage(1); setFilters((f) => ({ ...f, [k]: e.target.value })); };
  const filtered = !!(search || filters.isActive);

  return (
    <>
      <PageHeader title="Docentes" description="Personal docente. Se asignan a materias y secciones en Asignaciones.">
        <Can permission="teacher.create"><button className="btn-pencil" onClick={() => setDrawer('new')}><FiPlus /> Nuevo docente</button></Can>
      </PageHeader>
      <div className="panel">
        <div className="toolbar">
          <div className="search">
            <FiSearch aria-hidden />
            <input className="input" type="search" placeholder="Buscar por nombre, cédula o correo" aria-label="Buscar docentes" value={filters.search} onChange={setFilter('search')} />
          </div>
          <select className="input" aria-label="Filtrar por estado" value={filters.isActive} onChange={setFilter('isActive')}>
            <option value="">Cualquier estado</option><option value="true">Activos</option><option value="false">Inactivos</option>
          </select>
        </div>
        {loading && !data ? <TableSkeleton /> : error ? (
          <EmptyState icon={FiUserCheck} title="No pudimos cargar los docentes" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>
        ) : data.data.length === 0 ? (
          <EmptyState icon={FiUserCheck} title={filtered ? 'Sin resultados' : 'Aún no hay docentes'} text={filtered ? 'Prueba con otro nombre o quita el filtro.' : 'Registra al primer docente.'} />
        ) : (
          <div className="table-scroll" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}>
            <table className="data">
              <thead><tr><th>Docente</th><th>Cédula</th><th>Contacto</th><th>Usuario</th><th>Asignaciones</th><th>Estado</th><th><span className="visually-hidden">Acciones</span></th></tr></thead>
              <tbody>
                {data.data.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.lastName}, {t.firstName}</strong></td>
                    <td>{t.documentId}</td>
                    <td>{t.email ?? '—'}{t.phone && <small className="d-block muted-text">{t.phone}</small>}</td>
                    <td>{t.user ? t.user.email : <span className="muted-text">Sin usuario</span>}</td>
                    <td>{t.activeAssignments}</td>
                    <td><Tag tone={t.isActive ? 'ok' : 'muted'}>{t.isActive ? 'Activo' : 'Inactivo'}</Tag></td>
                    <td><div className="actions">
                      <Can permission="teacher.edit"><button className="icon-btn" aria-label={`Editar a ${t.firstName} ${t.lastName}`} onClick={() => setDrawer(t)}><FiEdit2 /></button></Can>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </div>
      {drawer && <TeacherFormDrawer teacher={drawer === 'new' ? null : drawer} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); reload(); }} />}
    </>
  );
}
