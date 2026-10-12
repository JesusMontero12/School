import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, Field, Spinner } from '../../components/ui';
import { notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { gradeLevelsService } from './sectionsService';

const schema = z.object({ name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(40, 'Máximo 40 caracteres'), isActive: z.boolean() });

/** Los 5 años (1er a 5to) vienen de fábrica: solo se puede renombrar o desactivar. */
export default function GradeFormDrawer({ gradeLevel, onClose, onSaved }) {
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema), defaultValues: { name: gradeLevel.name, isActive: gradeLevel.isActive },
  });
  const onSubmit = async (v) => {
    setServerError('');
    try { await gradeLevelsService.update(gradeLevel.id, v); notify.success('Cambios guardados'); onSaved(); }
    catch (e) { setServerError(getErrorMessage(e)); }
  };
  return (
    <Drawer title={`Editar ${gradeLevel.name}`} onClose={onClose}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose}>Cancelar</button>
        <button form="grade-form" className="btn-ink" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : 'Guardar cambios'}</button>
      </>}>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      <form id="grade-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Nombre" error={errors.name?.message} {...register('name')} />
        <label className="check-row mt-2"><input type="checkbox" {...register('isActive')} /> Año/grado activo (admite inscripciones)</label>
      </form>
    </Drawer>
  );
}
