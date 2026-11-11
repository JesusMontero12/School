import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiAward } from 'react-icons/fi';
import { EmptyState, TableSkeleton } from '../../components/ui';
import { StatusTag, Tag } from '../../components/academic-ui';
import { useAsync } from '../../hooks/useAsync';
import { YEAR_STATUS, formatDateTime, identification } from '../../utils/academic';
import { ResultScore, termDetail } from '../grades/ResultTag';
import { reportCardsService } from './reportCardsService';

/** Boletín de una inscripción. Lo provisional se distingue de lo definitivo y nada pendiente se muestra como cero. */
export default function ReportCardPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(() => reportCardsService.get(id), [id]);

  return (
    <>
      <Link to="/report-cards" className="page-back"><FiArrowLeft /> Boletines</Link>
      {loading && !data ? <div className="panel"><TableSkeleton rows={6} /></div> : error ? (
        <div className="panel"><EmptyState icon={FiAward} title="No pudimos cargar el boletín" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState></div>
      ) : (
        <>
          <div className="detail-head">
            <div>
              <h1>{data.student.lastName}, {data.student.firstName}</h1>
              <p className="muted-text">
                {identification(data.student.identificationType, data.student.identificationNumber)} · {data.section.gradeLevel.name} sección {data.section.name} · Año escolar {data.schoolYear.name} <StatusTag map={YEAR_STATUS} value={data.schoolYear.status} />
                {data.enrollmentStatus === 'RETIRADA' && <> <Tag tone="warn">Inscripción retirada</Tag></>}
              </p>
            </div>
          </div>

          <div className="callout" role="note">
            <strong>Provisional</strong>: el momento sigue abierto y la nota puede cambiar. <strong>Definitiva</strong>: el momento está cerrado. Una evaluación sin calificar no cuenta como cero.
          </div>

          <div className="panel">
            <div className="table-scroll">
              <table className="data">
                <thead><tr><th>Materia</th>{data.terms.map((t) => <th key={t.id}>{t.name}</th>)}<th>Nota anual</th></tr></thead>
                <tbody>
                  {data.subjects.map((s) => (
                    <tr key={s.subject.id}>
                      <td><strong>{s.subject.name}</strong>{s.teacher && <small className="d-block muted-text">{s.teacher}</small>}</td>
                      {data.terms.map((t) => <td key={t.id}><ResultScore result={s.terms[t.id]} detail={termDetail(s.terms[t.id])} />
                        {s.terms[t.id].pendingEvaluations > 0 && <small className="d-block muted-text">{s.terms[t.id].pendingEvaluations} evaluación(es) pendiente(s)</small>}</td>)}
                      <td><ResultScore result={s.annual} detail="Promedio de las notas de los tres momentos, redondeado" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel" style={{ padding: '1rem 1.25rem' }}>
            <strong>Resumen anual</strong>
            <p className="muted-text" style={{ margin: '.25rem 0 0' }}>
              {data.summary.subjects} materias · {data.summary.approved} aprobadas · {data.summary.failed} reprobadas · {data.summary.withoutAnnualScore} sin nota anual todavía
              {data.summary.provisional > 0 && ` · ${data.summary.provisional} con nota provisional`}.
            </p>
            <small className="muted-text">Calculado el {formatDateTime(data.generatedAt)}.</small>
          </div>
        </>
      )}
    </>
  );
}
