import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, Field, Spinner } from '../../components/ui';
import { notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { schoolYearsService } from './schoolYearsService';

const TERM_LABELS = ['Primer momento pedagógico', 'Segundo momento pedagógico', 'Tercer momento pedagógico'];
const date = z.string().min(1, 'Elige una fecha');
const term = z.object({ startDate: date, endDate: date });

/** Las fechas llegan como AAAA-MM-DD, así que comparar texto equivale a comparar fechas. */
const schema = z.object({
  name: z.string().trim().regex(/^\d{4}-\d{4}$/, 'Usa el formato AAAA-AAAA (ej. 2026-2027)'),
  startDate: date,
  endDate: date,
  terms: z.array(term).length(3),
}).superRefine((v, ctx) => {
  const add = (path, message) => ctx.addIssue({ code: 'custom', path, message });
  const [a, b] = v.name.split('-').map(Number);
  if (b !== a + 1) add(['name'], 'El segundo año debe ser el siguiente al primero (2026-2027)');
  if (v.startDate && v.endDate && v.startDate >= v.endDate) add(['endDate'], 'Debe ser posterior al inicio del año');
  v.terms.forEach((t, i) => {
    if (!t.startDate || !t.endDate) return;
    if (t.startDate >= t.endDate) add(['terms', i, 'endDate'], 'Debe ser posterior al inicio del momento');
    if (v.startDate && t.startDate < v.startDate) add(['terms', i, 'startDate'], 'No puede ser antes del inicio del año');
    if (v.endDate && t.endDate > v.endDate) add(['terms', i, 'endDate'], 'No puede ser después del fin del año');
    const prev = v.terms[i - 1];
    if (prev?.endDate && t.startDate <= prev.endDate) add(['terms', i, 'startDate'], 'Debe empezar después de que termine el momento anterior');
  });
});

export default function SchoolYearFormDrawer({ year, onClose, onSaved }) {
  const isEdit = !!year;
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: year?.name ?? '', startDate: year?.startDate ?? '', endDate: year?.endDate ?? '',
      terms: [0, 1, 2].map((i) => ({ startDate: year?.terms[i]?.startDate ?? '', endDate: year?.terms[i]?.endDate ?? '' })),
    },
  });

  const onSubmit = async (v) => {
    setServerError('');
    try {
      if (isEdit) await schoolYearsService.update(year.id, v); else await schoolYearsService.create(v);
      notify.success(isEdit ? 'Cambios guardados' : 'Año escolar creado');
      onSaved();
    } catch (e) { setServerError(getErrorMessage(e)); }
  };

  return (
    <Drawer title={isEdit ? `Editar año escolar ${year.name}` : 'Nuevo año escolar'} onClose={onClose}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose}>Cancelar</button>
        <button form="school-year-form" className="btn-ink" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : isEdit ? 'Guardar cambios' : 'Crear año escolar'}</button>
      </>}>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      <form id="school-year-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-section">
          <Field label="Nombre" placeholder="2026-2027" error={errors.name?.message} {...register('name')} />
          <div className="row g-3">
            <div className="col-sm-6"><Field label="Inicio del año" type="date" error={errors.startDate?.message} {...register('startDate')} /></div>
            <div className="col-sm-6"><Field label="Fin del año" type="date" error={errors.endDate?.message} {...register('endDate')} /></div>
          </div>
        </div>
        <div className="form-section">
          <h3>Momentos pedagógicos</h3>
          <p className="muted-text" style={{ fontSize: '.85rem' }}>Todo año tiene exactamente tres momentos, en orden y sin solaparse.</p>
          {TERM_LABELS.map((label, i) => {
            const locked = year?.terms[i]?.status === 'CERRADO';
            return (
              <div key={label} className="mb-2">
                <strong style={{ fontSize: '.875rem' }}>{label}{locked && ' (cerrado: fechas bloqueadas)'}</strong>
                <div className="row g-3 mt-0">
                  <div className="col-sm-6"><Field label="Inicio" type="date" disabled={locked} error={errors.terms?.[i]?.startDate?.message} {...register(`terms.${i}.startDate`)} /></div>
                  <div className="col-sm-6"><Field label="Fin" type="date" disabled={locked} error={errors.terms?.[i]?.endDate?.message} {...register(`terms.${i}.endDate`)} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </form>
    </Drawer>
  );
}
