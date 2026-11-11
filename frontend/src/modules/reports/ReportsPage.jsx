import { useMemo, useState } from 'react';
import { FiBarChart2 } from 'react-icons/fi';
import { EmptyState, PageHeader, TableSkeleton } from '../../components/ui';
import { StatusTag, Tabs, Tag } from '../../components/academic-ui';
import { useAsync } from '../../hooks/useAsync';
import { TERM_STATUS } from '../../utils/academic';
import { subjectsService } from '../subjects/subjectsService';
import { schoolYearsService } from '../school-years/schoolYearsService';
import { gradeLevelsService, sectionsService } from '../sections/sectionsService';
import { reportsService } from './reportsService';

const pct = (n, total) => (total ? `${Math.round((n / total) * 100)} %` : '—');
const scoreTag = (c) => (c.score == null ? <span className="muted-text" title={c.pending ? `${c.pending} pendiente(s)` : undefined}>—</span>
  : <span style={{ display: 'inline-flex', gap: '.35rem', alignItems: 'center' }}><strong>{c.score}</strong>{c.status === 'PROVISIONAL' && <Tag tone="warn">Prov.</Tag>}</span>);

function PerformanceTab({ params }) {
  const { data, loading, error, reload } = useAsync(() => reportsService.performance(params), [JSON.stringify(params)]);
  if (loading && !data) return <TableSkeleton rows={6} />;
  if (error) return <EmptyState icon={FiBarChart2} title="No pudimos cargar el reporte" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>;
  if (!data.rows.length) return <EmptyState icon={FiBarChart2} title="Sin datos" text="No hay materias ni alumnos con estos filtros." />;
  const t = data.totals;
  return (
    <>
      <p className="muted-text" style={{ padding: '0 1rem' }}>
        {t.approved} aprobadas · {t.failed} reprobadas · {t.withoutScore} sin nota todavía (de {t.scored + t.withoutScore} notas esperadas). Las notas provisionales (momento abierto) cuentan como están hoy.
      </p>
      <div className="table-scroll"><table className="data">
        <thead><tr><th>Año y sección</th><th>Materia</th><th>Docente</th><th>Alumnos</th><th>Aprobados</th><th>Reprobados</th><th>Sin nota</th><th>Promedio</th></tr></thead>
        <tbody>{data.rows.map((r) => (
          <tr key={`${r.section.id}:${r.subject.id}`}>
            <td>{r.section.gradeLevel.name} · {r.section.name}</td><td><strong>{r.subject.name}</strong></td><td>{r.teacher ?? <span className="muted-text">Sin docente</span>}</td>
            <td>{r.students}</td><td>{r.approved} <small className="muted-text">({pct(r.approved, r.scored)})</small></td><td>{r.failed} <small className="muted-text">({pct(r.failed, r.scored)})</small></td>
            <td>{r.withoutScore}</td><td>{r.average ?? '—'}</td>
          </tr>))}</tbody>
      </table></div>
    </>
  );
}

function StudentsTab({ params }) {
  const { data, loading, error, reload } = useAsync(() => (params.sectionId ? reportsService.students(params) : Promise.resolve(null)), [JSON.stringify(params)]);
  if (!params.sectionId) return <EmptyState icon={FiBarChart2} title="Elige una sección" text="Verás la nota de cada alumno en cada materia." />;
  if (loading && !data) return <TableSkeleton rows={6} />;
  if (error) return <EmptyState icon={FiBarChart2} title="No pudimos cargar el reporte" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>;
  if (!data.rows.length) return <EmptyState icon={FiBarChart2} title="Sin alumnos" text="La sección no tiene alumnos en este año escolar." />;
  return (
    <div className="table-scroll"><table className="data">
      <thead><tr><th>Alumno</th>{data.subjects.map((s) => <th key={s.id}>{s.name}</th>)}<th>Aprobadas</th><th>Reprobadas</th><th>Sin nota</th></tr></thead>
      <tbody>{data.rows.map((r) => (
        <tr key={r.enrollmentId}>
          <td><strong>{r.student.lastName}, {r.student.firstName}</strong>{r.enrollmentStatus === 'RETIRADA' && <> <Tag tone="warn">Retirado</Tag></>}</td>
          {r.cells.map((c) => <td key={c.subjectId} style={c.passed === false ? { color: 'var(--bad, #b42318)' } : undefined}>{scoreTag(c)}</td>)}
          <td>{r.approved}</td><td>{r.failed}</td><td>{r.withoutScore}</td>
        </tr>))}</tbody>
    </table></div>
  );
}

function PendingTab({ params }) {
  const { data, loading, error, reload } = useAsync(() => reportsService.pending(params), [JSON.stringify(params)]);
  if (loading && !data) return <TableSkeleton rows={6} />;
  if (error) return <EmptyState icon={FiBarChart2} title="No pudimos cargar el reporte" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState>;
  if (!data.rows.length) return <EmptyState icon={FiBarChart2} title="Sin pendientes" text="Ningún alumno tiene evaluaciones o notas pendientes con estos filtros." />;
  return (
    <>
      <p className="muted-text" style={{ padding: '0 1rem' }}>{data.rows.length} alumno(s) con pendientes. Se cuentan evaluaciones sin calificar, pruebas de lapso faltantes y materias sin nota en momentos cerrados.</p>
      <div className="table-scroll"><table className="data">
        <thead><tr><th>Alumno</th><th>Año y sección</th><th>Pendientes</th></tr></thead>
        <tbody>{data.rows.map((r) => (
          <tr key={r.enrollmentId}>
            <td><strong>{r.student.lastName}, {r.student.firstName}</strong></td>
            <td>{r.section.gradeLevel.name} · {r.section.name}</td>
            <td><ul style={{ margin: 0, paddingLeft: '1rem' }}>{r.items.map((i) => (
              <li key={`${i.subject.id}:${i.term.id}`}>{i.subject.name} — {i.term.name}: {i.reason}{i.pendingEvaluations > 0 && ` (${i.pendingEvaluations})`}</li>))}</ul></td>
          </tr>))}</tbody>
      </table></div>
    </>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState('performance');
  const [f, setF] = useState({ schoolYearId: '', termId: '', gradeLevelId: '', sectionId: '', subjectId: '' });
  const { data: years } = useAsync(schoolYearsService.options, []);
  const { data: grades } = useAsync(gradeLevelsService.list, []);
  const { data: subjects } = useAsync(subjectsService.options, []);
  const { data: sections } = useAsync(() => sectionsService.list({ gradeLevelId: f.gradeLevelId || undefined, isActive: true }), [f.gradeLevelId]);
  const yearId = f.schoolYearId || years?.find((y) => y.status === 'ACTIVO')?.id || years?.[0]?.id || '';
  const { data: year } = useAsync(() => (yearId ? schoolYearsService.get(yearId) : Promise.resolve(null)), [yearId]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value, ...(k === 'gradeLevelId' ? { sectionId: '' } : {}), ...(k === 'schoolYearId' ? { termId: '' } : {}) }));
  const params = useMemo(() => Object.fromEntries(Object.entries({ ...f, schoolYearId: yearId }).filter(([, v]) => v)), [f, yearId]);

  return (
    <>
      <PageHeader title="Reportes académicos" description="Rendimiento y pendientes calculados con las notas reales. Sin periodo se muestra la nota anual." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'performance', label: 'Rendimiento' }, { value: 'students', label: 'Por alumno' }, { value: 'pending', label: 'Pendientes' }]} />
      <div className="panel">
        <div className="toolbar">
          <select className="input" aria-label="Año escolar" value={yearId} onChange={set('schoolYearId')}>{years?.map((y) => <option key={y.id} value={y.id}>{y.name}{y.status === 'ACTIVO' ? ' (activo)' : ''}</option>)}</select>
          <select className="input" aria-label="Periodo" value={f.termId} onChange={set('termId')}>
            <option value="">Nota anual</option>{year?.terms?.map((t) => <option key={t.id} value={t.id}>{t.name}{t.status === 'PENDIENTE' ? ' (pendiente)' : ''}</option>)}
          </select>
          <select className="input" aria-label="Año" value={f.gradeLevelId} onChange={set('gradeLevelId')}><option value="">Todos los años</option>{grades?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          <select className="input" aria-label="Sección" value={f.sectionId} onChange={set('sectionId')}><option value="">{tab === 'students' ? 'Elige sección…' : 'Todas las secciones'}</option>{sections?.data.map((s) => <option key={s.id} value={s.id}>{s.gradeLevel.name} · {s.name}</option>)}</select>
          <select className="input" aria-label="Materia" value={f.subjectId} onChange={set('subjectId')}><option value="">Todas las materias</option>{subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          {f.termId && year?.terms && <StatusTag map={TERM_STATUS} value={year.terms.find((t) => t.id === f.termId)?.status} />}
        </div>
        {!yearId ? <EmptyState icon={FiBarChart2} title="Aún no hay años escolares" text="Crea un año escolar para ver reportes." />
          : tab === 'performance' ? <PerformanceTab params={params} /> : tab === 'students' ? <StudentsTab params={params} /> : <PendingTab params={params} />}
      </div>
    </>
  );
}
