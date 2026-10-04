import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, Field, Spinner } from '../../components/ui';
import { notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { rolesService } from './rolesService';

const schema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{2,39}$/, 'MAYÚSCULAS, números y guion bajo (3-40 caracteres)'),
  name: z.string().trim().min(3, 'Mínimo 3 caracteres').max(60),
  description: z.string().trim().max(200).optional(),
});

export default function RoleFormDrawer({ onClose, onSaved }) {
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (v) => {
    try { const role = await rolesService.create({ ...v, description: v.description || undefined }); notify.success('Rol creado'); onSaved(role); }
    catch (e) { setServerError(getErrorMessage(e)); }
  };

  return (
    <Drawer title="Nuevo rol" onClose={onClose}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose}>Cancelar</button>
        <button form="role-form" className="btn-ink" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : 'Crear rol'}</button>
      </>}>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      <form id="role-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Nombre" placeholder="Coordinador académico" error={errors.name?.message} {...register('name')} />
        <Field label="Código" placeholder="COORDINADOR" hint="Identificador interno. No se puede cambiar después." error={errors.code?.message} {...register('code')} />
        <Field label="Descripción (opcional)" error={errors.description?.message} {...register('description')} />
        <p className="hint" style={{ color: 'var(--muted)' }}>El rol nace sin permisos: asígnalos en la matriz después de crearlo.</p>
      </form>
    </Drawer>
  );
}
