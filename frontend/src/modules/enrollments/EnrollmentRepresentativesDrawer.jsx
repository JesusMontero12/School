import { useState } from 'react';
import { Drawer, Spinner } from '../../components/ui';
import { notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import RepresentativesEditor from './RepresentativesEditor';
import { enrollmentsService } from './enrollmentsService';
import { repsFromEnrollment, repsPayload, validateReps } from './representativesForm';

/** Cambia los representantes de la inscripción (reutiliza o crea nuevos; siempre uno principal). */
export default function EnrollmentRepresentativesDrawer({ enrollment, onClose, onSaved }) {
  const [items, setItems] = useState(() => repsFromEnrollment(enrollment));
  const [check, setCheck] = useState({ general: null, byKey: {} });
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');

  const change = (next) => { setItems(next); if (check.general || Object.keys(check.byKey).length) setCheck(validateReps(next)); };

  const save = async () => {
    const result = validateReps(items);
    setCheck(result);
    if (!result.ok) return;
    setBusy(true); setServerError('');
    try { await enrollmentsService.setRepresentatives(enrollment.id, repsPayload(items)); notify.success('Representantes actualizados'); onSaved(); }
    catch (e) { setServerError(getErrorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Drawer title="Representantes de la inscripción" onClose={onClose}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-ink" disabled={busy} onClick={save}>{busy ? <Spinner /> : 'Guardar representantes'}</button>
      </>}>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      {check.general && <div className="alert-x" role="alert">{check.general}</div>}
      <RepresentativesEditor items={items} onChange={change} errors={check.byKey} />
    </Drawer>
  );
}
