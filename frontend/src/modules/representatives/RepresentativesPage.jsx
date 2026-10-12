import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiSearch, FiUsers } from 'react-icons/fi';
import { Can, EmptyState, PageHeader, Pager, TableSkeleton } from '../../components/ui';
import { PersonPhoto, Tag } from '../../components/academic-ui';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import RepresentativeDrawer from './RepresentativeDrawer';
import { representativesService } from './representativesService';

export default function RepresentativesPage() {
  const [filters, setFilters] = useState({ search: '', isActive: '' });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const search = useDebounce(filters.search);

  const { data, loading, error, reload } = useAsync(
    () => representativesService.list({ page, limit: 10, search: search || undefined, isActive: filters.isActive || undefined }),
    [page, search, filters.isActive]);

  const setFilter = (k) => (e) => { setPage(1); setFilters((f) => ({ ...f, [k]: e.target.value })); };
  const filtered = !!(search || filters.isActive);

  return (
    <>
      <PageHeader title="Representantes" description="Consulta y actualiza los datos de contacto. Los representantes nuevos se registran al inscribir.">
        <Can permission="enrollment.create"><Link to="/enrollments/new" className="btn-pencil"><FiPlus /> Nueva inscripción</Link></Can>
      </PageHeader>

      <div className="panel">
        <div className="toolbar">
          <div className="search">
            <FiSearch aria-hidden />
            <input className="input" type="search" placeholder="Buscar por nombre, cédula o teléfono" aria-label="Buscar representantes" value={filters.search} onChange={setFilter('search')} />
          </div>
          <select className="input" aria-label="Filtrar por estado" value={filters.isActive} onChange={setFilter('isActive')}>
            <option value="">Cualquier estado</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>

        {loading && !data ? <TableSkeleton /> : error ? (
          <EmptyState icon={FiUsers} title="No pudimos cargar los representantes" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>
        ) : data.data.length === 0 ? (
          <EmptyState icon={FiUsers} title={filtered ? 'Sin resultados' : 'Aún no hay representantes'}
            text={filtered ? 'Prueba con otro nombre o quita el filtro.' : 'Los representantes aparecen aquí cuando se registra una inscripción.'} />
        ) : (
          <div className="table-scroll" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}>
            <table className="data">
              <thead><tr><th>Representante</th><th>Cédula</th><th>Teléfono</th><th>Alumnos</th><th>Estado</th></tr></thead>
              <tbody>
                {data.data.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => setOpenId(r.id)}>
                    <td><div className="person">
                      <PersonPhoto size="sm" first={r.firstName} last={r.lastName} path={r.hasPhoto ? representativesService.photoPath(r.id) : null} />
                      <div><button className="row-link btn-reset" onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }}>{r.lastName}, {r.firstName}</button></div>
                    </div></td>
                    <td>{r.documentId}</td><td>{r.phone ?? '—'}</td><td>{r.studentsCount}</td>
                    <td><Tag tone={r.isActive ? 'ok' : 'muted'}>{r.isActive ? 'Activo' : 'Inactivo'}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </div>

      {openId && <RepresentativeDrawer representativeId={openId} onClose={() => setOpenId(null)} onSaved={() => { setOpenId(null); reload(); }} />}
    </>
  );
}
