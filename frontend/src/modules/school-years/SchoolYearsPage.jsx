import { useState } from 'react';
import { FiCalendar, FiEdit2, FiPlus } from 'react-icons/fi';
import { Can, EmptyState, PageHeader, TableSkeleton } from '../../components/ui';
import { StatusTag } from '../../components/academic-ui';
import { useAsync } from '../../hooks/useAsync';
import { confirmAction, notify } from '../../utils/alerts';
import { TERM_STATUS, YEAR_STATUS, formatDay } from '../../utils/academic';
import { getErrorMessage } from '../../utils/errors';
import SchoolYearFormDrawer from './SchoolYearFormDrawer';
import { schoolYearsService } from './schoolYearsService';

export default function SchoolYearsPage() {
  const [drawer, setDrawer] = useState(null); // null | 'new' | año
  const { data, loading, error, reload } = useAsync(() => schoolYearsService.list({ page: 1, limit: 50 }), []);

  const run = async (fn, okMsg) => {
    try { await fn(); notify.success(okMsg); reload(); } catch (e) { notify.error(getErrorMessage(e)); }
  };

  const changeYear = async (y, status) => {
    const closing = status === 'CERRADO';
    const ok = await confirmAction({
      title: closing ? `¿Cerrar el año escolar ${y.name}?` : `¿Activar el año escolar ${y.name}?`,
      text: closing
        ? 'Sus momentos pedagógicos se cerrarán y ya no se podrán crear ni modificar inscripciones de este año. No se puede deshacer.'
        : 'Será el año en curso. Solo puede haber un año activo a la vez.',
      confirmText: closing ? 'Cerrar año' : 'Activar año', danger: closing,
    });
    if (ok) run(() => schoolYearsService.setStatus(y.id, status), closing ? 'Año cerrado' : 'Año activado');
  };

  const changeTerm = async (y, t, status) => {
    const closing = status === 'CERRADO';
    const ok = await confirmAction({
      title: closing ? `¿Cerrar el ${t.name}?` : `¿Activar el ${t.name}?`,
      text: closing ? 'Un momento cerrado no se puede reabrir.' : 'Solo puede haber un momento activo a la vez.',
      confirmText: closing ? 'Cerrar momento' : 'Activar momento', danger: closing,
    });
    if (ok) run(() => schoolYearsService.setTermStatus(y.id, t.number, status), closing ? 'Momento cerrado' : 'Momento activado');
  };

  return (
    <>
      <PageHeader title="Años escolares" description="Cada año tiene tres momentos pedagógicos. Solo uno puede estar activo.">
        <Can permission="school_year.create"><button className="btn-pencil" onClick={() => setDrawer('new')}><FiPlus /> Nuevo año escolar</button></Can>
      </PageHeader>

      {loading && !data ? <div className="panel"><TableSkeleton rows={4} /></div> : error ? (
        <div className="panel"><EmptyState icon={FiCalendar} title="No pudimos cargar los años escolares" text={error}><button className="btn-ink" onClick={reload}>Reintentar</button></EmptyState></div>
      ) : data.data.length === 0 ? (
        <div className="panel"><EmptyState icon={FiCalendar} title="Aún no hay años escolares" text="Crea el primero para poder inscribir alumnos.">
          <Can permission="school_year.create"><button className="btn-pencil" onClick={() => setDrawer('new')}><FiPlus /> Nuevo año escolar</button></Can>
        </EmptyState></div>
      ) : (
        <div className="stack">
          {data.data.map((y) => (
            <article className="year-card" key={y.id}>
              <header>
                <div>
                  <h2>{y.name} <StatusTag map={YEAR_STATUS} value={y.status} /></h2>
                  <span className="range">{formatDay(y.startDate)} — {formatDay(y.endDate)}</span>
                </div>
                <Can permission="school_year.edit">
                  <div className="d-flex gap-2 flex-wrap">
                    {y.status !== 'CERRADO' && <button className="btn-quiet" onClick={() => setDrawer(y)}><FiEdit2 /> Editar</button>}
                    {y.status === 'PLANIFICADO' && <button className="btn-ink" onClick={() => changeYear(y, 'ACTIVO')}>Activar año</button>}
                    {y.status === 'ACTIVO' && <button className="btn-danger-soft" onClick={() => changeYear(y, 'CERRADO')}>Cerrar año</button>}
                  </div>
                </Can>
              </header>
              <div className="term-grid">
                {y.terms.map((t) => (
                  <div key={t.id} className={`term ${t.status === 'ACTIVO' ? 'active' : ''}`}>
                    <strong>{t.name}</strong>
                    <small>{formatDay(t.startDate)} — {formatDay(t.endDate)}</small>
                    <div><StatusTag map={TERM_STATUS} value={t.status} /></div>
                    <Can permission="school_year.edit">
                      <div className="row-actions">
                        {t.status === 'PENDIENTE' && y.status === 'ACTIVO' && <button className="btn-quiet btn-sm-x" onClick={() => changeTerm(y, t, 'ACTIVO')}>Activar</button>}
                        {t.status === 'ACTIVO' && <button className="btn-quiet btn-sm-x" onClick={() => changeTerm(y, t, 'CERRADO')}>Cerrar</button>}
                      </div>
                    </Can>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {drawer && <SchoolYearFormDrawer year={drawer === 'new' ? null : drawer} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); reload(); }} />}
    </>
  );
}
