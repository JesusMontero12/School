import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, Field, Spinner } from '../../components/ui';
import { formatDay } from '../../utils/academic';
import { notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { gradesService } from './gradesService';

const schema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  kind: z.enum(['CONTINUA', 'LAPSO']),
  maxPoints: z.coerce.number({ invalid_type_error: 'Escribe un número' }).positive('Debe ser mayor que 0').max(999.99, 'Máximo 999,99')
    .refine((v) => Math.round(v * 100) === v * 100 || Math.abs(Math.round(v * 100) - v * 100) < 1e-6, 'Máximo 2 decimales'),
  evaluationDate: z.string().min(1, 'Selecciona la fecha'),
  reason: z.string().trim().max(300).optional(),
});

/** Crea o edita una evaluación de un momento. Al editar no se cambia el tipo (continua / lapso). */
export default function EvaluationDrawer({ evaluation, term, sheet, onClose, onSaved }) {
  const isEdit = !!evaluation;
  const closed = term.status === 'CERRADO';
  const hasLapsoSlot = term.hasLapsoTest && !term.evaluations.some((e) => e.kind === 'LAPSO' && !e.voidedAt);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: evaluation?.name ?? '', kind: evaluation?.kind ?? 'CONTINUA', maxPoints: evaluation?.maxPoints ?? 20,
      evaluationDate: evaluation?.evaluationDate ?? '', reason: '',
    },
  });

  const onSubmit = async (v) => {
    setServerError('');
    if (closed && (v.reason ?? '').length < 5) return setError('reason', { message: 'Indica el motivo (mínimo 5 caracteres)' });
    try {
      const reason = closed ? v.reason : undefined;
      if (isEdit) await gradesService.updateEvaluation(evaluation.id, { name: v.name, maxPoints: v.maxPoints, evaluationDate: v.evaluationDate, reason });
      else await gradesService.createEvaluation({ termId: term.id, sectionId: sheet.section.id, subjectId: sheet.subject.id, name: v.name, kind: v.kind, maxPoints: v.maxPoints, evaluationDate: v.evaluationDate, reason });
      notify.success(isEdit ? 'Evaluación actualizada' : 'Evaluación creada');
      onSaved();
    } catch (e) { setServerError(getErrorMessage(e)); }
  };

  return (
    <Drawer title={isEdit ? `Editar ${evaluation.name}` : `Nueva evaluación · ${term.name}`} onClose={onClose}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose}>Cancelar</button>
        <button form="evaluation-form" className="btn-ink" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : isEdit ? 'Guardar cambios' : 'Crear evaluación'}</button>
      </>}>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      {closed && <div className="callout warn mb-3">El momento está cerrado. Este cambio es una corrección: quedará registrada con tu nombre y el motivo.</div>}
      <form id="evaluation-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Nombre" placeholder="Taller 1" error={errors.name?.message} {...register('name')} />
        {!isEdit && (
          <Field label="Tipo" hint={term.hasLapsoTest ? (hasLapsoSlot ? 'Este momento lleva una prueba de lapso.' : 'La prueba de lapso de este momento ya existe.') : 'Esta materia no lleva prueba de lapso en este momento.'} error={errors.kind?.message}>
            {(a11y) => (
              <select className="input" {...a11y} {...register('kind')}>
                <option value="CONTINUA">Evaluación continua</option>
                {hasLapsoSlot && <option value="LAPSO">Prueba de lapso</option>}
              </select>
            )}
          </Field>
        )}
        <Field label="Puntaje máximo" type="number" step="0.01" min="0" hint="Los puntos obtenidos se calculan sobre este máximo." error={errors.maxPoints?.message} {...register('maxPoints')} />
        <Field label="Fecha" type="date" min={term.startDate} max={term.endDate} hint={`Dentro del momento: ${formatDay(term.startDate)} al ${formatDay(term.endDate)}`} error={errors.evaluationDate?.message} {...register('evaluationDate')} />
        {closed && <Field label="Motivo de la corrección" error={errors.reason?.message} {...register('reason')} />}
      </form>
    </Drawer>
  );
}
