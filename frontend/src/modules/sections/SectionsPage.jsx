import { useMemo, useState } from 'react';
import { FiEdit2, FiLayers, FiPlus, FiTrash2 } from 'react-icons/fi';
import { Can, EmptyState, PageHeader, TableSkeleton } from '../../components/ui';
import { Occupancy, Tag } from '../../components/academic-ui';
import { useAsync } from '../../hooks/useAsync';
import { confirmAction, notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { schoolYearsService } from '../school-years/schoolYearsService';
import GradeFormDrawer from './GradeFormDrawer';
import SectionFormDrawer from './SectionFormDrawer';
import { gradeLevelsService, sectionsService } from './sectionsService';

export default function SectionsPage() {
  const [yearId, setYearId] = useState('');
  const [drawer, setDrawer] = useState(null); // { type: 'section'|'grade', grade, section? }

  const { data: years } = useAsync(schoolYearsService.options, []);
  const { data: grades, loading: loadingGrades, error: gradesError, reload: reloadGrades } = useAsync(gradeLevelsService.list, []);
  const { data: sections, loading, error, reload } = useAsync(() => sectionsService.list({ schoolYearId: yearId || undefined }), [yearId]);

  const byGrade = useMemo(() => {
    const map = new Map();
    sections?.data.forEach((s) => map.set(s.gradeLevel.id, [...(map.get(s.gradeLevel.id) ?? []), s]));
    return map;
  }, [sections]);

  const reloadAll = () => { reloadGrades(); reload(); };
  const currentYear = years?.find((y) => y.id === (yearId || sections?.schoolYearId));

  const remove = async (s) => {
    const ok = await confirmAction({
      title: `¿Eliminar la sección ${s.name}?`, text: 'Solo se puede eliminar si nunca tuvo inscripciones. Si ya las tuvo, desactívala.',
      confirmText: 'Eliminar sección', danger: true,
    });
    if (!ok) return;
    try { await sectionsService.remove(s.id); notify.success('Sección eliminada'); reload(); } catch (e) { notify.error(getErrorMessage(e)); }
  };

  const failed = gradesError || error;

  return (
    <>
      <PageHeader title="Años y secciones" description="Los cinco años de Educación Media y sus secciones. Las secciones no se repiten por año escolar.">
        <select className="input" aria-label="Año escolar para ver el cupo" value={yearId} onChange={(e) => setYearId(e.target.value)} style={{ minWidth: 190 }}>
          <option value="">Cupo del año en curso</option>
          {years?.map((y) => <option key={y.id} value={y.id}>Cupo {y.name}{y.status === 'ACTIVO' ? ' (activo)' : ''}</option>)}
        </select>
      </PageHeader>

      {(loadingGrades && !grades) || (loading && !sections) ? <div className="panel"><TableSkeleton rows={5} /></div> : failed ? (
        <div className="panel"><EmptyState icon={FiLayers} title="No pudimos cargar los años y secciones" text={gradesError || error}>
          <button className="btn-ink" onClick={reloadAll}>Reintentar</button></EmptyState></div>
      ) : (
        <>
          {sections.schoolYearId == null && <div className="callout mb-3">Aún no hay años escolares: el cupo ocupado se mostrará cuando exista uno.</div>}
          {currentYear && <p className="muted-text">Cupo calculado para el año escolar <strong>{currentYear.name}</strong>.</p>}
          <div className="stack">
            {grades.map((g) => {
              const list = byGrade.get(g.id) ?? [];
              return (
                <section className="grade-block" key={g.id} aria-label={g.name}>
                  <header>
                    <h2><span className="num">{g.number}</span>{g.name}{!g.isActive && <Tag tone="muted">Inactivo</Tag>}</h2>
                    <div className="d-flex gap-2 flex-wrap">
                      <Can permission="grade_level.edit"><button className="btn-quiet" onClick={() => setDrawer({ type: 'grade', grade: g })}><FiEdit2 /> Editar año</button></Can>
                      <Can permission="section.create"><button className="btn-pencil" disabled={!g.isActive} onClick={() => setDrawer({ type: 'section', grade: g })}><FiPlus /> Nueva sección</button></Can>
                    </div>
                  </header>
                  {list.length === 0 ? (
                    <p className="muted-text" style={{ padding: '1rem 1.25rem', margin: 0 }}>Este año todavía no tiene secciones.</p>
                  ) : (
                    <div className="table-scroll">
                      <table className="data">
                        <thead><tr><th>Sección</th><th>Cupo</th><th>Estado</th><th><span className="visually-hidden">Acciones</span></th></tr></thead>
                        <tbody>
                          {list.map((s) => (
                            <tr key={s.id}>
                              <td><strong>Sección {s.name}</strong></td>
                              <td><Occupancy occupied={s.occupied} max={s.maxCapacity} /></td>
                              <td><Tag tone={s.isActive ? 'ok' : 'muted'}>{s.isActive ? 'Activa' : 'Inactiva'}</Tag></td>
                              <td><div className="actions">
                                <Can permission="section.edit"><button className="icon-btn" aria-label={`Editar sección ${s.name} de ${g.name}`} onClick={() => setDrawer({ type: 'section', grade: g, section: s })}><FiEdit2 /></button></Can>
                                <Can permission="section.delete"><button className="icon-btn danger" aria-label={`Eliminar sección ${s.name} de ${g.name}`} onClick={() => remove(s)}><FiTrash2 /></button></Can>
                              </div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {drawer?.type === 'grade' && <GradeFormDrawer gradeLevel={drawer.grade} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); reloadAll(); }} />}
      {drawer?.type === 'section' && <SectionFormDrawer gradeLevel={drawer.grade} section={drawer.section} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); reloadAll(); }} />}
    </>
  );
}
