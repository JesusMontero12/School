import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, Field, Spinner } from '../../components/ui';
import { notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { subjectsService } from './subjectsService';

const schema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').optional(),
  gradeLevelIds: z.array(z.string()).min(1, 'Selecciona al menos un año'),
  isActive: z.boolean(),
});

/** Crea o edita una materia y define en qué años está (plan de estudio). */
export default function SubjectFormDrawer({ subject, gradeLevels, onClose, onSaved }) {
  const isEdit = !!subject;
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: subject?.name ?? '', description: subject?.description ?? '',
      gradeLevelIds: subject?.gradeLevels.map((g) => g.id) ?? [], isActive: subject?.isActive ?? true,
    },
  });

  const onSubmit = async (v) => {
    setServerError('');
    try {
      const body = { name: v.name, description: v.description || undefined, gradeLevelIds: v.gradeLevelIds };
      if (isEdit) await subjectsService.update(subject.id, { ...body, description: v.description ?? '', isActive: v.isActive });
      else await subjectsService.create(body);
      notify.success(isEdit ? 'Cambios guardados' : 'Materia creada');
      onSaved();
    } catch (e) { setServerError(getErrorMessage(e)); }
  };

  return (
    <Drawer title={isEdit ? `Editar ${subject.name}` : 'Nueva materia'} onClose={onClose}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose}>Cancelar</button>
        <button form="subject-form" className="btn-ink" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : isEdit ? 'Guardar cambios' : 'Crear materia'}</button>
      </>}>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      <form id="subject-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Nombre" placeholder="Matemática" error={errors.name?.message} {...register('name')} />
        <Field label="Descripción (opcional)" error={errors.description?.message} {...register('description')} />
        <div className="field" role="group" aria-labelledby="subject-grades-label">
          <label id="subject-grades-label">Años donde se imparte</label>
          <div className="stack" style={{ gap: '.35rem' }}>
            {gradeLevels.map((g) => (
              <label key={g.id} className="check-row">
                <input type="checkbox" value={g.id} disabled={!g.isActive} {...register('gradeLevelIds')} /> {g.name}{!g.isActive && ' (inactivo)'}
              </label>
            ))}
          </div>
          {errors.gradeLevelIds && <span className="error" role="alert">{errors.gradeLevelIds.message}</span>}
        </div>
        {isEdit && (
          <label className="check-row mt-2"><input type="checkbox" {...register('isActive')} /> Materia activa</label>
        )}
      </form>
    </Drawer>
  );
}
