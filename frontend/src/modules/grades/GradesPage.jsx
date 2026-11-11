import { useEffect, useMemo, useState } from 'react';
import { FiBookOpen, FiEdit2, FiPlus, FiSlash } from 'react-icons/fi';
import { EmptyState, PageHeader, Spinner, TableSkeleton } from '../../components/ui';
import { StatusTag, Tabs, Tag } from '../../components/academic-ui';
import { useAsync } from '../../hooks/useAsync';
import { usePermission } from '../../hooks/usePermission';
import { TERM_STATUS, YEAR_STATUS, formatDay } from '../../utils/academic';
import { confirmAction, notify, promptText } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { assignmentsService } from '../assignments/assignmentsService';
import { schoolYearsService } from '../school-years/schoolYearsService';
import { sectionsService } from '../sections/sectionsService';
import EvaluationDrawer from './EvaluationDrawer';
import { gradesService } from './gradesService';
import { ResultScore, termDetail } from './ResultTag';

const fmt = (n) => (n == null ? '' : String(n));

export default function GradesPage() {
  const { can } = usePermission();
  const [yearId, setYearId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [tab, setTab] = useState('');
  const [drafts, setDrafts] = useState({}); // { [evaluationId]: { [enrollmentId]: 'texto' } }
  const [saving, setSaving] = useState(false);
  const [drawer, setDrawer] = useState(null); // { term, evaluation? }

  const { data: years } = useAsync(schoolYearsService.options, []);
  const effectiveYear = yearId || years?.find((y) => y.status === 'ACTIVO')?.id || years?.[0]?.id || '';
  const year = years?.find((y) => y.id === effectiveYear);

  const { data: sections } = useAsync(() => sectionsService.list({ isActive: true, schoolYearId: effectiveYear || undefined }), [effectiveYear]);
  // Materias que la persona puede trabajar en la sección elegida (un docente solo ve las suyas).
  const mine = useAsync(() => (effectiveYear ? assignmentsService.list({ schoolYearId: effectiveYear, limit: 100, state: 'vigente' }) : Promise.resolve(null)), [effectiveYear]);
  const complete = mine.data && mine.data.meta.total <= 100;
  const sectionOptions = useMemo(() => {
    const all = sections?.data ?? [];
    if (!complete) return all;
    const ids = new Set(mine.data.data.map((a) => a.section.id));
    return all.filter((s) => ids.has(s.id));
  }, [sections, mine.data, complete]);
  const subjectOptions = useMemo(
    () => (mine.data?.data ?? []).filter((a) => a.section.id === sectionId).map((a) => a.subject).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [mine.data, sectionId]);

  useEffect(() => { setSubjectId(''); setDrafts({}); }, [sectionId, effectiveYear]);

  const sheet = useAsync(
    () => (sectionId && subjectId ? gradesService.sheet({ schoolYearId: effectiveYear, sectionId, subjectId }) : Promise.resolve(null)),
    [effectiveYear, sectionId, subjectId]);
  const data = sheet.data;

  // Momento visible: el activo por defecto, si no el primero.
  useEffect(() => {
    if (data && !data.terms.some((t) => t.id === tab) && tab !== 'annual') setTab((data.terms.find((t) => t.status === 'ACTIVO') ?? data.terms[0]).id);
  }, [data, tab]);
  const term = data?.terms.find((t) => t.id === tab);

  const canWriteTerm = (t) => can('grade.edit') && (t.status === 'ACTIVO' || (t.status === 'CERRADO' && can('grade.approve')));
  const canCreateTerm = (t) => can('grade.create') && (t.status === 'ACTIVO' || (t.status === 'CERRADO' && can('grade.approve')));
  const live = term?.evaluations.filter((e) => !e.voidedAt) ?? [];
  const voided = term?.evaluations.filter((e) => e.voidedAt) ?? [];
  const lapsoMissing = term?.hasLapsoTest && !live.some((e) => e.kind === 'LAPSO');
  const dirty = Object.values(drafts).some((m) => Object.keys(m).length > 0);

  const setDraft = (evalId, enrId, value, original) =>
    setDrafts((d) => {
      const m = { ...(d[evalId] ?? {}) };
      if (value === fmt(original)) delete m[enrId]; else m[enrId] = value;
      return { ...d, [evalId]: m };
    });

  const save = async () => {
    const batches = [];
    for (const ev of live) {
      const entries = Object.entries(drafts[ev.id] ?? {});
      if (!entries.length) continue;
      const scores = [];
      for (const [enrollmentId, text] of entries) {
        const points = text.trim() === '' ? null : Number(text.replace(',', '.'));
        if (points !== null && (!Number.isFinite(points) || points < 0 || points > ev.maxPoints || Math.round(points * 100) / 100 !== points))
          return notify.error(`"${ev.name}": los puntos deben estar entre 0 y ${ev.maxPoints} (máx. 2 decimales)`);
        scores.push({ enrollmentId, points });
      }
      batches.push({ ev, scores });
    }
    let reason;
    if (term.status === 'CERRADO') {
      reason = await promptText({ title: 'Corregir notas de un momento cerrado', text: 'Quedará registrado con tu nombre y este motivo.', label: 'Motivo de la corrección', confirmText: 'Guardar corrección' });
      if (!reason) return;
    }
    setSaving(true);
    try {
      for (const { ev, scores } of batches) await gradesService.saveScores(ev.id, scores, reason);
      notify.success('Calificaciones guardadas');
      setDrafts({});
    } catch (e) { notify.error(getErrorMessage(e)); }
    finally { setSaving(false); sheet.reload(); }
  };

  const changeTab = async (v) => {
    if (dirty && !(await confirmAction({ title: 'Tienes cambios sin guardar', text: 'Si cambias de pestaña se descartan.', confirmText: 'Descartar y cambiar' }))) return;
    setDrafts({}); setTab(v);
  };

  const voidEvaluation = async (ev) => {
    const reason = await promptText({ title: `Anular "${ev.name}"`, text: 'Deja de contar para las notas. Los puntos cargados se conservan en el historial.', label: 'Motivo de la anulación', confirmText: 'Anular evaluación' });
    if (!reason) return;
    try { await gradesService.voidEvaluation(ev.id, reason); notify.success('Evaluación anulada'); sheet.reload(); } catch (e) { notify.error(getErrorMessage(e)); }
  };

  return (
    <>
      <PageHeader title="Calificaciones" description="Evaluaciones y puntos por materia y sección. La nota de cada momento se calcula sola con las reglas del colegio.">
        <select className="input" aria-label="Año escolar" value={effectiveYear} onChange={(e) => { setYearId(e.target.value); setSectionId(''); }} style={{ minWidth: 170 }}>
          {years?.map((y) => <option key={y.id} value={y.id}>{y.name}{y.status === 'ACTIVO' ? ' (activo)' : ''}</option>)}
        </select>
        <select className="input" aria-label="Sección" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">Sección…</option>
          {sectionOptions.map((s) => <option key={s.id} value={s.id}>{s.gradeLevel.name} · {s.name}</option>)}
        </select>
        <select className="input" aria-label="Materia" value={subjectId} disabled={!sectionId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Materia…</option>
          {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </PageHeader>
      {year && <p className="muted-text">Año escolar <strong>{year.name}</strong> <StatusTag map={YEAR_STATUS} value={year.status} /></p>}

      {!sectionId || !subjectId ? (
        <div className="panel"><EmptyState icon={FiBookOpen} title="Elige una sección y una materia"
          text={mine.data && mine.data.data.length === 0 ? 'No tienes materias asignadas en este año escolar.' : 'Verás la planilla de evaluaciones y las notas de cada alumno.'} /></div>
      ) : sheet.loading && !data ? <div className="panel"><TableSkeleton rows={6} /></div> : sheet.error ? (
        <div className="panel"><EmptyState icon={FiBookOpen} title="No pudimos cargar la planilla" text={sheet.error}><button className="btn-ink" onClick={sheet.reload}>Reintentar</button></EmptyState></div>
      ) : data && (
        <>
          <p className="muted-text">{data.subject.name} · {data.section.gradeLevel.name} sección {data.section.name}{data.teacher && <> · Docente: {data.teacher.lastName}, {data.teacher.firstName}</>}</p>
          <Tabs value={tab} onChange={changeTab}
            tabs={[...data.terms.map((t) => ({ value: t.id, label: t.name })), { value: 'annual', label: 'Resumen anual' }]} />

          {tab === 'annual' ? (
            <div className="panel"><div className="table-scroll"><table className="data">
              <thead><tr><th>Alumno</th>{data.terms.map((t) => <th key={t.id}>{t.name}</th>)}<th>Nota anual</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.enrollmentId}>
                    <td><strong>{r.student.lastName}, {r.student.firstName}</strong></td>
                    {data.terms.map((t) => <td key={t.id}><ResultScore result={r.terms[t.id].result} detail={termDetail(r.terms[t.id].result)} /></td>)}
                    <td><ResultScore result={r.annual} detail="Promedio de las notas de los tres momentos, redondeado" /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <p className="muted-text" style={{ padding: '.75rem 1rem', margin: 0 }}>La nota anual es el promedio de las notas de los tres momentos. Solo existe cuando los tres momentos tienen nota.</p></div>
          ) : term && (
            <div className="panel">
              <div className="toolbar">
                <StatusTag map={TERM_STATUS} value={term.status} />
                <span className="muted-text">{formatDay(term.startDate)} al {formatDay(term.endDate)}</span>
                <Tag tone={term.hasLapsoTest ? 'info' : 'muted'}>{term.hasLapsoTest ? 'Con prueba de lapso (70 % + 30 %)' : 'Sin prueba de lapso (100 % continuas)'}</Tag>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '.5rem' }}>
                  {canCreateTerm(term) && <button className="btn-quiet" onClick={() => setDrawer({ term })}><FiPlus /> Nueva evaluación</button>}
                  {canWriteTerm(term) && <button className="btn-ink" disabled={!dirty || saving} onClick={save}>{saving ? <Spinner /> : 'Guardar notas'}</button>}
                </div>
              </div>
              {term.status === 'PENDIENTE' && <div className="callout" style={{ margin: '0 1rem 1rem' }}>Este momento aún no inicia: no admite evaluaciones ni notas.</div>}
              {term.status === 'CERRADO' && <div className="callout warn" style={{ margin: '0 1rem 1rem' }}>Momento cerrado: {can('grade.approve') ? 'cualquier cambio es una corrección con motivo y queda auditada.' : 'solo consulta. Las correcciones las hace quien tiene permiso de aprobación.'}</div>}
              {lapsoMissing && <div className="callout warn" style={{ margin: '0 1rem 1rem' }}>Esta materia lleva prueba de lapso en este momento y aún no se ha creado: hasta entonces no hay nota del momento.</div>}

              {live.length === 0 ? <EmptyState icon={FiBookOpen} title="Sin evaluaciones" text={canCreateTerm(term) ? 'Crea la primera evaluación para empezar a cargar notas.' : 'Todavía no hay evaluaciones en este momento.'} /> : (
                <div className="table-scroll">
                  <table className="data">
                    <thead><tr>
                      <th>Alumno</th>
                      {live.map((ev) => (
                        <th key={ev.id} style={{ minWidth: 120 }}>
                          {ev.name} {ev.kind === 'LAPSO' && <Tag tone="info">Lapso</Tag>}
                          <small className="d-block muted-text">/ {ev.maxPoints} · {formatDay(ev.evaluationDate)}</small>
                          {canWriteTerm(term) && (
                            <span className="actions">
                              <button className="icon-btn" aria-label={`Editar ${ev.name}`} onClick={() => setDrawer({ term, evaluation: ev })}><FiEdit2 /></button>
                              <button className="icon-btn danger" aria-label={`Anular ${ev.name}`} onClick={() => voidEvaluation(ev)}><FiSlash /></button>
                            </span>
                          )}
                        </th>
                      ))}
                      <th>Nota del momento</th>
                    </tr></thead>
                    <tbody>
                      {data.rows.map((r) => {
                        const cell = r.terms[term.id];
                        return (
                          <tr key={r.enrollmentId}>
                            <td><strong>{r.student.lastName}, {r.student.firstName}</strong>{r.status === 'RETIRADA' && <> <Tag tone="warn">Retirado</Tag></>}</td>
                            {live.map((ev) => {
                              const original = cell.scores[ev.id];
                              const value = drafts[ev.id]?.[r.enrollmentId] ?? fmt(original);
                              return (
                                <td key={ev.id}>
                                  {canWriteTerm(term) && r.canGrade ? (
                                    <input className="input" type="number" inputMode="decimal" step="0.01" min="0" max={ev.maxPoints} style={{ width: 90 }}
                                      aria-label={`${ev.name} de ${r.student.lastName}, ${r.student.firstName}`} placeholder="—" value={value}
                                      onChange={(e) => setDraft(ev.id, r.enrollmentId, e.target.value, original)} />
                                  ) : (original ?? <span className="muted-text">—</span>)}
                                </td>
                              );
                            })}
                            <td><ResultScore result={cell.result} detail={termDetail(cell.result)} />
                              {cell.result.pendingEvaluations > 0 && <small className="d-block muted-text">{cell.result.pendingEvaluations} pendiente(s)</small>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {voided.length > 0 && (
                <p className="muted-text" style={{ padding: '.75rem 1rem', margin: 0 }}>
                  Evaluaciones anuladas (no cuentan): {voided.map((v) => `${v.name} (${v.voidReason})`).join('; ')}.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {drawer && <EvaluationDrawer term={drawer.term} evaluation={drawer.evaluation} sheet={data} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); setDrafts({}); sheet.reload(); }} />}
    </>
  );
}
