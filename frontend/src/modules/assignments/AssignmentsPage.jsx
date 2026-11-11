import { useMemo, useState } from 'react';
import { FiPlus, FiRepeat, FiSlash, FiUsers } from 'react-icons/fi';
import { Can, EmptyState, PageHeader, Pager, TableSkeleton } from '../../components/ui';
import { StatusTag, Tabs, Tag } from '../../components/academic-ui';
import { useAsync } from '../../hooks/useAsync';
import { usePermission } from '../../hooks/usePermission';
import { YEAR_STATUS, formatDay } from '../../utils/academic';
import { confirmAction, notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { schoolYearsService } from '../school-years/schoolYearsService';
import { gradeLevelsService } from '../sections/sectionsService';
import { subjectsService } from '../subjects/subjectsService';
import { teachersService } from '../teachers/teachersService';
import AssignmentDrawer from './AssignmentDrawer';
import { assignmentsService } from './assignmentsService';

const personName = (t) => `${t.lastName}, ${t.firstName}`;

export default function AssignmentsPage() {
  const { can } = usePermission();
  const manage = can('assignment.create');
  const [tab, setTab] = useState('list');
  const [yearId, setYearId] = useState('');
  const [filters, setFilters] = useState({ gradeLevelId: '', subjectId: '', teacherId: '', state: 'vigente' });
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null); // { preset } | { assignment }

  const { data: years } = useAsync(schoolYearsService.options, []);
  const { data: grades } = useAsync(gradeLevelsService.list, []);
  const { data: subjects } = useAsync(subjectsService.options, []);
  const { data: teachers } = useAsync(() => (manage ? teachersService.options() : Promise.resolve([])), [manage]);

  const list = useAsync(
    () => assignmentsService.list({ page, limit: 10, schoolYearId: yearId || undefined, gradeLevelId: filters.gradeLevelId || undefined, subjectId: filters.subjectId || undefined, teacherId: filters.teacherId || undefined, state: filters.state }),
    [page, yearId, filters.gradeLevelId, filters.subjectId, filters.teacherId, filters.state]);
  const coverage = useAsync(() => (manage && tab === 'coverage' ? assignmentsService.coverage({ schoolYearId: yearId || undefined, gradeLevelId: filters.gradeLevelId || undefined }) : Promise.resolve(null)),
    [manage, tab, yearId, filters.gradeLevelId]);

  const effectiveYearId = yearId || list.data?.schoolYearId || '';
  const year = years?.find((y) => y.id === effectiveYearId);
  const closed = year?.status === 'CERRADO';
  const setFilter = (k) => (e) => { setPage(1); setFilters((f) => ({ ...f, [k]: e.target.value })); };
  const reloadAll = () => { list.reload(); coverage.reload(); };

  const end = async (a) => {
    const ok = await confirmAction({ title: `¿Finalizar la asignación de ${a.subject.name}?`, text: `${personName(a.teacher)} dejará de impartirla en la sección ${a.section.name}. Queda en el historial.`, confirmText: 'Finalizar asignación', danger: true });
    if (!ok) return;
    try { await assignmentsService.end(a.id); notify.success('Asignación finalizada'); reloadAll(); } catch (e) { notify.error(getErrorMessage(e)); }
  };

  const missing = useMemo(() => coverage.data?.sections.reduce((n, s) => n + s.subjects.filter((x) => !x.teacher).length, 0) ?? 0, [coverage.data]);

  return (
    <>
      <PageHeader title="Asignaciones docentes" description="Qué docente imparte cada materia en cada sección durante el año escolar. Al reasignar se conserva el historial.">
        <select className="input" aria-label="Año escolar" value={effectiveYearId} onChange={(e) => { setPage(1); setYearId(e.target.value); }} style={{ minWidth: 190 }}>
          {years?.map((y) => <option key={y.id} value={y.id}>{y.name}{y.status === 'ACTIVO' ? ' (activo)' : ''}</option>)}
        </select>
        <Can permission="assignment.create">
          <button className="btn-pencil" disabled={!effectiveYearId || closed} onClick={() => setDrawer({ preset: { schoolYearId: effectiveYearId } })}><FiPlus /> Asignar docente</button>
        </Can>
      </PageHeader>
      {year && <p className="muted-text">Año escolar <strong>{year.name}</strong> <StatusTag map={YEAR_STATUS} value={year.status} />{closed && ' · cerrado: solo consulta'}</p>}

      {manage && <Tabs value={tab} onChange={setTab} tabs={[{ value: 'list', label: 'Asignaciones' }, { value: 'coverage', label: 'Cobertura', count: tab === 'coverage' ? missing : undefined }]} />}

      {tab === 'list' || !manage ? (
        <div className="panel">
          <div className="toolbar">
            <select className="input" aria-label="Año" value={filters.gradeLevelId} onChange={setFilter('gradeLevelId')}>
              <option value="">Todos los años</option>{grades?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select className="input" aria-label="Materia" value={filters.subjectId} onChange={setFilter('subjectId')}>
              <option value="">Todas las materias</option>{subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {manage && (
              <select className="input" aria-label="Docente" value={filters.teacherId} onChange={setFilter('teacherId')}>
                <option value="">Todos los docentes</option>{teachers?.map((t) => <option key={t.id} value={t.id}>{personName(t)}</option>)}
              </select>
            )}
            <select className="input" aria-label="Estado" value={filters.state} onChange={setFilter('state')}>
              <option value="vigente">Vigentes</option><option value="finalizada">Finalizadas (historial)</option><option value="todas">Todas</option>
            </select>
          </div>
          {list.loading && !list.data ? <TableSkeleton /> : list.error ? (
            <EmptyState icon={FiUsers} title="No pudimos cargar las asignaciones" text={list.error}><button className="btn-ink" onClick={list.reload}>Reintentar</button></EmptyState>
          ) : list.data.data.length === 0 ? (
            <EmptyState icon={FiUsers} title="Sin asignaciones" text="No hay asignaciones con estos filtros en el año seleccionado." />
          ) : (
            <div className="table-scroll" style={{ opacity: list.loading ? 0.55 : 1, transition: 'opacity .15s' }}>
              <table className="data">
                <thead><tr><th>Materia</th><th>Sección</th><th>Docente</th><th>Estado</th><th><span className="visually-hidden">Acciones</span></th></tr></thead>
                <tbody>
                  {list.data.data.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.subject.name}</strong></td>
                      <td>{a.section.gradeLevel.name} · {a.section.name}</td>
                      <td>{personName(a.teacher)}</td>
                      <td>{a.endedAt
                        ? <><Tag tone="muted">Finalizada</Tag><small className="d-block muted-text">{formatDay(a.endedAt.slice(0, 10))}{a.endReason ? ` · ${a.endReason}` : ''}</small></>
                        : <Tag tone="ok">Vigente</Tag>}</td>
                      <td><div className="actions">
                        {!a.endedAt && !closed && (
                          <Can permission="assignment.edit">
                            <button className="icon-btn" aria-label={`Reasignar ${a.subject.name} de la sección ${a.section.name}`} onClick={() => setDrawer({ assignment: a })}><FiRepeat /></button>
                            <button className="icon-btn danger" aria-label={`Finalizar ${a.subject.name} de la sección ${a.section.name}`} onClick={() => end(a)}><FiSlash /></button>
                          </Can>
                        )}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager meta={list.data?.meta} onPage={setPage} />
        </div>
      ) : (
        <div className="stack">
          {coverage.loading && !coverage.data ? <div className="panel"><TableSkeleton rows={4} /></div> : coverage.error ? (
            <div className="panel"><EmptyState icon={FiUsers} title="No pudimos cargar la cobertura" text={coverage.error}><button className="btn-ink" onClick={coverage.reload}>Reintentar</button></EmptyState></div>
          ) : coverage.data?.sections.length === 0 ? (
            <div className="panel"><EmptyState icon={FiUsers} title="Sin secciones" text="Crea secciones activas para ver qué materias aún no tienen docente." /></div>
          ) : (
            <>
              <div className={missing ? 'callout warn' : 'callout'}>{missing ? `${missing} materia(s) sin docente en este año escolar.` : 'Todas las materias de todas las secciones tienen docente.'}</div>
              {coverage.data?.sections.map((s) => (
                <section className="grade-block" key={s.id} aria-label={`${s.gradeLevel.name} sección ${s.name}`}>
                  <header><h2><span className="num">{s.gradeLevel.number}</span>{s.gradeLevel.name} · Sección {s.name}</h2></header>
                  {s.subjects.length === 0 ? <p className="muted-text" style={{ padding: '1rem 1.25rem', margin: 0 }}>Este año no tiene materias en su plan de estudio.</p> : (
                    <div className="table-scroll">
                      <table className="data">
                        <thead><tr><th>Materia</th><th>Docente</th><th><span className="visually-hidden">Acciones</span></th></tr></thead>
                        <tbody>
                          {s.subjects.map((m) => (
                            <tr key={m.id}>
                              <td><strong>{m.name}</strong></td>
                              <td>{m.teacher ? personName(m.teacher) : <Tag tone="warn">Sin docente</Tag>}</td>
                              <td><div className="actions">
                                {!closed && (m.teacher
                                  ? <button className="icon-btn" aria-label={`Reasignar ${m.name}`} onClick={() => setDrawer({ assignment: { id: m.assignmentId, subject: m, section: { name: s.name, gradeLevel: s.gradeLevel }, teacher: m.teacher } })}><FiRepeat /></button>
                                  : <button className="btn-quiet" onClick={() => setDrawer({ preset: { schoolYearId: coverage.data.schoolYearId, sectionId: s.id, subjectId: m.id } })}><FiPlus /> Asignar</button>)}
                              </div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </>
          )}
        </div>
      )}

      {drawer && <AssignmentDrawer {...drawer} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); reloadAll(); }} />}
    </>
  );
}
