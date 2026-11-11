import { useMemo, useState } from 'react';
import { Drawer, Field, Spinner } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { sectionsService } from '../sections/sectionsService';
import { subjectsService } from '../subjects/subjectsService';
import { teachersService } from '../teachers/teachersService';
import { assignmentsService } from './assignmentsService';

/**
 * Asignar un docente a una materia en una sección, o reasignarla (cierra la vigente y abre otra).
 * `preset`: { schoolYearId, sectionId?, subjectId? } al crear · `assignment` al reasignar.
 */
export default function AssignmentDrawer({ preset, assignment, onClose, onSaved }) {
  const isReassign = !!assignment;
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sectionId, setSectionId] = useState(preset?.sectionId ?? '');
  const [subjectId, setSubjectId] = useState(preset?.subjectId ?? '');
  const [teacherId, setTeacherId] = useState('');
  const [reason, setReason] = useState('');

  const { data: sections } = useAsync(() => (isReassign ? Promise.resolve(null) : sectionsService.list({ isActive: true })), []);
  const { data: subjects } = useAsync(() => (isReassign ? Promise.resolve(null) : subjectsService.options()), []);
  const { data: teachers } = useAsync(teachersService.options, []);

  const section = sections?.data.find((s) => s.id === sectionId);
  const subjectChoices = useMemo(
    () => (section ? subjects?.filter((s) => s.gradeLevels.some((g) => g.id === section.gradeLevel.id)) ?? [] : []),
    [section, subjects]);

  const submit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!teacherId) return setServerError('Selecciona un docente');
    if (!isReassign && (!sectionId || !subjectId)) return setServerError('Selecciona la sección y la materia');
    setSaving(true);
    try {
      if (isReassign) await assignmentsService.reassign(assignment.id, { teacherId, reason: reason || undefined });
      else await assignmentsService.create({ schoolYearId: preset.schoolYearId, sectionId, subjectId, teacherId });
      notify.success(isReassign ? 'Materia reasignada' : 'Docente asignado');
      onSaved();
    } catch (err) { setServerError(getErrorMessage(err)); } finally { setSaving(false); }
  };

  const available = teachers?.filter((t) => t.id !== assignment?.teacher.id);

  return (
    <Drawer title={isReassign ? 'Reasignar materia' : 'Asignar docente'} onClose={onClose}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose}>Cancelar</button>
        <button form="assignment-form" className="btn-ink" disabled={saving}>{saving ? <Spinner /> : isReassign ? 'Reasignar' : 'Asignar'}</button>
      </>}>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      <form id="assignment-form" onSubmit={submit} noValidate>
        {isReassign ? (
          <div className="callout mb-3">
            <strong>{assignment.subject.name}</strong> · {assignment.section.gradeLevel.name} sección {assignment.section.name}<br />
            Docente actual: {assignment.teacher.lastName}, {assignment.teacher.firstName}. Su asignación quedará finalizada en el historial.
          </div>
        ) : (
          <>
            <Field label="Sección">
              {(a11y) => (
                <select className="input" {...a11y} value={sectionId} onChange={(e) => { setSectionId(e.target.value); setSubjectId(''); }}>
                  <option value="">Selecciona…</option>
                  {sections?.data.map((s) => <option key={s.id} value={s.id}>{s.gradeLevel.name} · Sección {s.name}</option>)}
                </select>
              )}
            </Field>
            <Field label="Materia" hint="Solo aparecen las materias del plan de estudio de ese año.">
              {(a11y) => (
                <select className="input" {...a11y} value={subjectId} disabled={!sectionId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {subjectChoices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </Field>
          </>
        )}
        <Field label={isReassign ? 'Nuevo docente' : 'Docente'}>
          {(a11y) => (
            <select className="input" {...a11y} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Selecciona…</option>
              {(isReassign ? available : teachers)?.map((t) => <option key={t.id} value={t.id}>{t.lastName}, {t.firstName}</option>)}
            </select>
          )}
        </Field>
        {isReassign && <Field label="Motivo (opcional)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </form>
    </Drawer>
  );
}
