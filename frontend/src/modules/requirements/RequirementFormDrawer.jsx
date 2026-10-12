import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, Field, Spinner } from '../../components/ui';
import { notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { requirementsService } from './requirementsService';

const schema = z.object({
  name: z.string().trim().min(3, 'Mínimo 3 caracteres').max(80, 'Máximo 80 caracteres'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').optional(),
  isRequired: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number({ invalid_type_error: 'Escribe un número' }).int().min(0).max(9999),
});

export default function RequirementFormDrawer({ requirement, onClose, onSaved }) {
  const isEdit = !!requirement;
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: requirement?.name ?? '', description: requirement?.description ?? '', isRequired: requirement?.isRequired ?? true,
      isActive: requirement?.isActive ?? true, sortOrder: requirement?.sortOrder ?? 100,
    },
  });

  const onSubmit = async (v) => {
    setServerError('');
    try {
      if (isEdit) await requirementsService.update(requirement.id, { ...v, description: v.description ?? '' });
      else await requirementsService.create({ name: v.name, description: v.description || undefined, isRequired: v.isRequired, sortOrder: v.sortOrder });
      notify.success(isEdit ? 'Cambios guardados' : 'Requisito creado');
      onSaved();
    } catch (e) { setServerError(getErrorMessage(e)); }
  };

  return (
    <Drawer title={isEdit ? 'Editar requisito' : 'Nuevo requisito'} onClose={onClose}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose}>Cancelar</button>
        <button form="requirement-form" className="btn-ink" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : isEdit ? 'Guardar cambios' : 'Crear requisito'}</button>
      </>}>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      <form id="requirement-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Nombre" error={errors.name?.message} {...register('name')} />
        <Field label="Descripción (opcional)" error={errors.description?.message} {...register('description')} />
        <Field label="Orden en la lista" type="number" min="0" hint="Los números menores aparecen primero." error={errors.sortOrder?.message} {...register('sortOrder')} />
        <label className="check-row mt-2"><input type="checkbox" {...register('isRequired')} /> Obligatorio para activar la inscripción</label>
        {isEdit && <label className="check-row mt-2"><input type="checkbox" {...register('isActive')} /> Vigente (se pide en nuevas inscripciones)</label>}
      </form>
    </Drawer>
  );
}
