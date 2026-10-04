import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, Field, PasswordField, Spinner } from '../../components/ui';
import { notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { email, newPassword, passwordHint } from '../../utils/schemas';
import { usersService } from './usersService';

const base = {
  firstName: z.string().trim().min(2, 'Mínimo 2 letras').max(60),
  lastName: z.string().trim().min(2, 'Mínimo 2 letras').max(60),
  phone: z.string().trim().max(30).optional(),
  roleIds: z.array(z.string()).min(1, 'Asigna al menos un rol'),
};
const createSchema = z.object({ ...base, email, password: newPassword });
const editSchema = z.object(base);

export default function UserFormDrawer({ user, roles, onClose, onSaved }) {
  const isEdit = !!user;
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', phone: user?.phone ?? '',
      email: user?.email ?? '', password: '', roleIds: user?.roles.map((r) => r.id) ?? [],
    },
  });
  const selected = watch('roleIds');
  useEffect(() => { register('roleIds'); }, [register]);

  const toggleRole = (id) => setValue('roleIds',
    selected.includes(id) ? selected.filter((r) => r !== id) : [...selected, id], { shouldValidate: true, shouldDirty: true });

  const onSubmit = async (v) => {
    setServerError('');
    try {
      if (isEdit) await usersService.update(user.id, { firstName: v.firstName, lastName: v.lastName, phone: v.phone || undefined, roleIds: v.roleIds });
      else await usersService.create({ ...v, phone: v.phone || undefined });
      notify.success(isEdit ? 'Cambios guardados' : 'Usuario creado');
      onSaved();
    } catch (e) { setServerError(getErrorMessage(e)); }
  };

  return (
    <Drawer title={isEdit ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose}>Cancelar</button>
        <button form="user-form" className="btn-ink" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : isEdit ? 'Guardar cambios' : 'Crear usuario'}</button>
      </>}>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      <form id="user-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="row g-3">
          <div className="col-sm-6"><Field label="Nombre" error={errors.firstName?.message} {...register('firstName')} /></div>
          <div className="col-sm-6"><Field label="Apellido" error={errors.lastName?.message} {...register('lastName')} /></div>
        </div>
        <Field label="Correo" type="email" disabled={isEdit} hint={isEdit ? 'El correo no se puede cambiar.' : undefined} error={errors.email?.message} {...register('email')} />
        <Field label="Teléfono (opcional)" type="tel" error={errors.phone?.message} {...register('phone')} />
        {!isEdit && <PasswordField label="Contraseña temporal" hint={`${passwordHint} Deberá cambiarla al primer ingreso.`} autoComplete="new-password" error={errors.password?.message} {...register('password')} />}
        <fieldset className="field">
          <legend style={{ fontSize: '.875rem', fontWeight: 600, margin: 0, float: 'none' }}>Roles</legend>
          <div className="role-pick">
            {roles.map((r) => (
              <label key={r.id}>
                <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleRole(r.id)} />
                <span>{r.name}</span>
              </label>
            ))}
          </div>
          {errors.roleIds && <span className="error" role="alert">{errors.roleIds.message}</span>}
        </fieldset>
      </form>
    </Drawer>
  );
}
