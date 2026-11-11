import { useState } from 'react';
import { FiBookOpen, FiEdit2, FiPlus, FiSearch } from 'react-icons/fi';
import { Can, EmptyState, PageHeader, Pager, TableSkeleton } from '../../components/ui';
import { StatusTag, Tabs, Tag } from '../../components/academic-ui';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { usePermission } from '../../hooks/usePermission';
import { TERM_STATUS } from '../../utils/academic';
import { confirmAction, notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { schoolYearsService } from '../school-years/schoolYearsService';
import { gradeLevelsService } from '../sections/sectionsService';
import SubjectFormDrawer from './SubjectFormDrawer';
import { subjectsService } from './subjectsService';

function SubjectsTab({ gradeLevels }) {
  const [filters, setFilters] = useState({ search: '', gradeLevelId: '', isActive: '' });
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null); // null | 'new' | materia
  const search = useDebounce(filters.search);
  const { data, loading, error, reload } = useAsync(
    () => subjectsService.list({ page, limit: 10, search: search || undefined, gradeLevelId: filters.gradeLevelId || undefined, isActive: filters.isActive || undefined }),
    [page, search, filters.gradeLevelId, filters.isActive]);
  const setFilter = (k) => (e) => { setPage(1); setFilters((f) => ({ ...f, [k]: e.target.value })); };
  const filtered = !!(search || filters.gradeLevelId || filters.isActive);

  return (
    <>
      <div className="panel">
        <div className="toolbar">
          <div className="search">
            <FiSearch aria-hidden />
            <input className="input" type="search" placeholder="Buscar por nombre o código" aria-label="Buscar materias" value={filters.search} onChange={setFilter('search')} />
          </div>
          <select className="input" aria-label="Filtrar por año" value={filters.gradeLevelId} onChange={setFilter('gradeLevelId')}>
            <option value="">Todos los años</option>
            {gradeLevels?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="input" aria-label="Filtrar por estado" value={filters.isActive} onChange={setFilter('isActive')}>
            <option value="">Cualquier estado</option><option value="true">Activas</option><option value="false">Inactivas</option>
          </select>
          <Can permission="subject.create"><button className="btn-pencil" onClick={() => setDrawer('new')}><FiPlus /> Nueva materia</button></Can>
        </div>

        {loading && !data ? <TableSkeleton /> : error ? (
          <EmptyState icon={FiBookOpen} title="No pudimos cargar las materias" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>
        ) : data.data.length === 0 ? (
          <EmptyState icon={FiBookOpen} title={filtered ? 'Sin resultados' : 'Aún no hay materias'} text={filtered ? 'Prueba con otro nombre o quita los filtros.' : 'Crea la primera materia del plan de estudio.'} />
        ) : (
          <div className="table-scroll" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}>
            <table className="data">
              <thead><tr><th>Materia</th><th>Años</th><th>Asignaciones vigentes</th><th>Estado</th><th><span className="visually-hidden">Acciones</span></th></tr></thead>
              <tbody>
                {data.data.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong><small className="d-block muted-text">{s.code}</small></td>
                    <td>{s.gradeLevels.map((g) => g.name).join(', ') || '—'}</td>
                    <td>{s.activeAssignments}</td>
                    <td><Tag tone={s.isActive ? 'ok' : 'muted'}>{s.isActive ? 'Activa' : 'Inactiva'}</Tag></td>
                    <td><div className="actions">
                      <Can permission="subject.edit"><button className="icon-btn" aria-label={`Editar ${s.name}`} onClick={() => setDrawer(s)}><FiEdit2 /></button></Can>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager meta={data?.meta} onPage={setPage} />
      </div>
      {drawer && gradeLevels && <SubjectFormDrawer subject={drawer === 'new' ? null : drawer} gradeLevels={gradeLevels} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); reload(); }} />}
    </>
  );
}

/** Define en qué momentos cada materia lleva prueba de lapso (cambia cómo se calcula la nota del momento). */
function LapsoTab() {
  const { can } = usePermission();
  const [yearId, setYearId] = useState('');
  const { data: years } = useAsync(schoolYearsService.options, []);
  const targetYear = yearId || years?.find((y) => y.status === 'ACTIVO')?.id || years?.[0]?.id;
  const { data, loading, error, reload } = useAsync(() => (targetYear ? subjectsService.termSettings(targetYear) : Promise.resolve(null)), [targetYear]);
  const canEdit = can('subject.edit');

  const toggle = async (subject, term, value) => {
    if (!value && !(await confirmAction({ title: `¿Quitar la prueba de lapso de ${subject.name}?`, text: `Dejará de aplicarse en el ${term.name}: las notas de ese momento se calcularán solo con las evaluaciones continuas.`, confirmText: 'Quitar prueba de lapso' }))) return;
    try { await subjectsService.setTermSetting(subject.id, term.id, value); notify.success('Configuración guardada'); reload(); } catch (e) { notify.error(getErrorMessage(e)); }
  };

  return (
    <div className="panel">
      <div className="toolbar">
        <select className="input" aria-label="Año escolar" value={targetYear ?? ''} onChange={(e) => setYearId(e.target.value)}>
          {years?.map((y) => <option key={y.id} value={y.id}>{y.name}{y.status === 'ACTIVO' ? ' (activo)' : ''}</option>)}
        </select>
      </div>
      <div className="callout" style={{ margin: '0 1rem 1rem' }}>
        Con prueba de lapso, la nota del momento es: continuas 70 % + prueba de lapso 30 %. Sin ella, las continuas valen el 100 %. No se puede cambiar en momentos cerrados.
      </div>
      {!targetYear ? <EmptyState icon={FiBookOpen} title="Aún no hay años escolares" text="Crea un año escolar para configurar sus momentos." />
        : loading && !data ? <TableSkeleton rows={5} /> : error ? (
          <EmptyState icon={FiBookOpen} title="No pudimos cargar la configuración" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>
        ) : data && (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Materia</th>{data.terms.map((t) => <th key={t.id}>{t.name} <StatusTag map={TERM_STATUS} value={t.status} /></th>)}</tr></thead>
              <tbody>
                {data.subjects.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    {data.terms.map((t) => (
                      <td key={t.id}>
                        <label className="check-row">
                          <input type="checkbox" checked={!!s.terms[t.id]} disabled={!canEdit || t.status === 'CERRADO'}
                            aria-label={`${s.name}: prueba de lapso en ${t.name}`} onChange={(e) => toggle(s, t, e.target.checked)} />
                          {s.terms[t.id] ? 'Con prueba' : 'Sin prueba'}
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

export default function SubjectsPage() {
  const [tab, setTab] = useState('catalog');
  const { data: gradeLevels } = useAsync(gradeLevelsService.list, []);
  return (
    <>
      <PageHeader title="Materias" description="Catálogo de materias, los años donde se imparten y en qué momentos llevan prueba de lapso." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'catalog', label: 'Catálogo' }, { value: 'lapso', label: 'Prueba de lapso' }]} />
      {tab === 'catalog' ? <SubjectsTab gradeLevels={gradeLevels} /> : <LapsoTab />}
    </>
  );
}
