import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiAward, FiSearch } from 'react-icons/fi';
import { EmptyState, PageHeader, Pager, TableSkeleton } from '../../components/ui';
import { StatusTag } from '../../components/academic-ui';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { ENROLLMENT_STATUS } from '../../utils/academic';
import { schoolYearsService } from '../school-years/schoolYearsService';
import { gradeLevelsService, sectionsService } from '../sections/sectionsService';
import { reportCardsService } from './reportCardsService';

export default function ReportCardsPage() {
  const [filters, setFilters] = useState({ schoolYearId: '', gradeLevelId: '', sectionId: '', search: '' });
  const [page, setPage] = useState(1);
  const search = useDebounce(filters.search);
  const { data: years } = useAsync(schoolYearsService.options, []);
  const { data: grades } = useAsync(gradeLevelsService.list, []);
  const { data: sections } = useAsync(() => sectionsService.list({ gradeLevelId: filters.gradeLevelId || undefined, isActive: true }), [filters.gradeLevelId]);
  const { data, loading, error, reload } = useAsync(
    () => reportCardsService.list({ page, limit: 10, schoolYearId: filters.schoolYearId || undefined, gradeLevelId: filters.gradeLevelId || undefined, sectionId: filters.sectionId || undefined, search: search || undefined }),
    [page, filters.schoolYearId, filters.gradeLevelId, filters.sectionId, search]);
  const set = (k) => (e) => { setPage(1); setFilters((f) => ({ ...f, [k]: e.target.value, ...(k === 'gradeLevelId' ? { sectionId: '' } : {}) })); };
  const filtered = !!(search || filters.gradeLevelId || filters.sectionId);

  return (
    <>
      <PageHeader title="Boletines" description="Resultados de cada alumno por momento y anual, calculados con las notas registradas." />
      <div className="panel">
        <div className="toolbar">
          <div className="search">
            <FiSearch aria-hidden />
            <input className="input" type="search" placeholder="Buscar por nombre o cédula" aria-label="Buscar alumnos" value={filters.search} onChange={set('search')} />
          </div>
          <select className="input" aria-label="Año escolar" value={filters.schoolYearId || data?.schoolYearId || ''} onChange={set('schoolYearId')}>
            {years?.map((y) => <option key={y.id} value={y.id}>{y.name}{y.status === 'ACTIVO' ? ' (activo)' : ''}</option>)}
          </select>
          <select className="input" aria-label="Año" value={filters.gradeLevelId} onChange={set('gradeLevelId')}>
            <option value="">Todos los años</option>{grades?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="input" aria-label="Sección" value={filters.sectionId} onChange={set('sectionId')}>
            <option value="">Todas las secciones</option>{sections?.data.map((s) => <option key={s.id} value={s.id}>{s.gradeLevel.name} · {s.name}</option>)}
          </select>
        </div>
        {loading && !data ? <TableSkeleton /> : error ? (
          <EmptyState icon={FiAward} title="No pudimos cargar los boletines" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>
        ) : data.data.length === 0 ? (
          <EmptyState icon={FiAward} title={filtered ? 'Sin resultados' : 'No hay boletines'} text={filtered ? 'Prueba con otro nombre o quita los filtros.' : 'Aparecen cuando hay inscripciones en el año escolar.'} />
        ) : (
          <div className="table-scroll" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}>
            <table className="data">
              <thead><tr><th>Alumno</th><th>Cédula</th><th>Año y sección</th><th>Inscripción</th><th><span className="visually-hidden">Abrir</span></th></tr></thead>
              <tbody>
                {data.data.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.student.lastName}, {r.student.firstName}</strong></td>
                    <td>{r.student.identificationNumber}</td>
                    <td>{r.section.gradeLevel.name} · {r.section.name}</td>
                    <td><StatusTag map={ENROLLMENT_STATUS} value={r.status} /></td>
                    <td><Link className="btn-quiet" to={`/report-cards/${r.id}`}>Ver boletín</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </div>
    </>
  );
}
