import { useState } from 'react';
import { Drawer, Spinner } from '../../components/ui';
import { notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { enrollmentsService } from './enrollmentsService';

const COPY = {
  ACTIVA: { title: 'Activar inscripción', button: 'Activar inscripción', ok: 'Inscripción activada', text: 'El expediente está completo. La inscripción pasará a ACTIVA y se quitará el plazo de documentos.', danger: false },
  ANULADA: { title: 'Anular inscripción', button: 'Anular inscripción', ok: 'Inscripción anulada', text: 'La inscripción quedará ANULADA como registro histórico y liberará el cupo. No se puede deshacer.', danger: true },
  RETIRADA: { title: 'Retirar alumno', button: 'Retirar alumno', ok: 'Alumno retirado', text: 'La inscripción quedará RETIRADA como registro histórico y liberará el cupo. No se puede deshacer.', danger: true },
};

/** Cambio de estado con motivo opcional (queda en el historial del alumno). */
export default function EnrollmentStatusDrawer({ enrollment, target, onClose, onSaved }) {
  const copy = COPY[target];
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setServerError('');
    try { await enrollmentsService.setStatus(enrollment.id, target, reason.trim()); notify.success(copy.ok); onSaved(); }
    catch (err) { setServerError(getErrorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Drawer title={copy.title} onClose={onClose}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose}>Cancelar</button>
        <button form="status-form" className={copy.danger ? 'btn-danger-soft' : 'btn-ink'} disabled={busy}>{busy ? <Spinner /> : copy.button}</button>
      </>}>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      <p><strong>{enrollment.student.firstName} {enrollment.student.lastName}</strong> · {enrollment.gradeLevel.name} {enrollment.section.name} · {enrollment.schoolYear.name}</p>
      <div className={`callout ${copy.danger ? 'warn' : 'ok'} mb-3`}>{copy.text}</div>
      <form id="status-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="status-reason">Motivo (opcional)</label>
          <textarea id="status-reason" className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </form>
    </Drawer>
  );
}
