import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, Field, Spinner } from '../../components/ui';
import { notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { sectionsService } from './sectionsService';

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre (ej. A)').max(10, 'Máximo 10 caracteres')
    .regex(/^[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ][A-Za-z0-9ÁÉÍÓÚÑáéíóúñ \-]*$/, 'Solo letras, números, espacio o guion'),
  maxCapacity: z.coerce.number({ invalid_type_error: 'Escribe un número' }).int('Debe ser un número entero').min(1, 'Mínimo 1').max(200, 'Máximo 200'),
  isActive: z.boolean(),
});

/** Crea o edita una sección. El año/grado se fija al crear y no cambia después. */
export default function SectionFormDrawer({ section, gradeLevel, onClose, onSaved }) {
  const isEdit = !!section;
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: section?.name ?? '', maxCapacity: section?.maxCapacity ?? 35, isActive: section?.isActive ?? true },
  });

  const onSubmit = async (v) => {
    setServerError('');
    try {
      if (isEdit) await sectionsService.update(section.id, v);
      else await sectionsService.create({ gradeLevelId: gradeLevel.id, name: v.name, maxCapacity: v.maxCapacity });
      notify.success(isEdit ? 'Cambios guardados' : 'Sección creada');
      onSaved();
    } catch (e) { setServerError(getErrorMessage(e)); }
  };

  return (
    <Drawer title={isEdit ? `Editar sección ${section.name} · ${gradeLevel.name}` : `Nueva sección · ${gradeLevel.name}`} onClose={onClose}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose}>Cancelar</button>
        <button form="section-form" className="btn-ink" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : isEdit ? 'Guardar cambios' : 'Crear sección'}</button>
      </>}>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      <form id="section-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Nombre de la sección" placeholder="A" error={errors.name?.message} {...register('name')} />
        <Field label="Cupo máximo" type="number" min="1" hint="Los cupos PENDIENTE y ACTIVA cuentan como ocupados." error={errors.maxCapacity?.message} {...register('maxCapacity')} />
        {isEdit && (
          <label className="check-row mt-2">
            <input type="checkbox" {...register('isActive')} /> Sección activa (admite nuevas inscripciones)
          </label>
        )}
      </form>
    </Drawer>
  );
}
