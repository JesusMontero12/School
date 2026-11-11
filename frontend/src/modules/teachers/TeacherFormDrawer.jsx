import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer, Field, Spinner } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { EMAIL_RE, normalizeId } from '../../utils/academic';
import { notify } from '../../utils/alerts';
import { getErrorMessage } from '../../utils/errors';
import { teachersService } from './teachersService';

const schema = z.object({
  firstName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(60),
  lastName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(60),
  documentId: z.string().trim().refine((v) => /^[A-Z0-9]{4,20}$/.test(normalizeId(v)), 'Entre 4 y 20 letras o números'),
  email: z.string().trim().refine((v) => !v || EMAIL_RE.test(v), 'Correo no válido'),
  phone: z.string().trim().refine((v) => !v || /^[0-9+()\-\s]{7,20}$/.test(v), 'Entre 7 y 20 caracteres (números, +, -, paréntesis)'),
  userId: z.string(),
  isActive: z.boolean(),
});

export default function TeacherFormDrawer({ teacher, onClose, onSaved }) {
  const isEdit = !!teacher;
  const [serverError, setServerError] = useState('');
  const { data: users } = useAsync(() => teachersService.userOptions(teacher?.userId), [teacher?.userId]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: teacher?.firstName ?? '', lastName: teacher?.lastName ?? '', documentId: teacher?.documentId ?? '',
      email: teacher?.email ?? '', phone: teacher?.phone ?? '', userId: teacher?.userId ?? '', isActive: teacher?.isActive ?? true,
    },
  });

  const onSubmit = async (v) => {
    setServerError('');
    try {
      const base = { firstName: v.firstName, lastName: v.lastName, documentId: v.documentId };
      if (isEdit) await teachersService.update(teacher.id, { ...base, email: v.email || null, phone: v.phone || null, userId: v.userId || null, isActive: v.isActive });
      else await teachersService.create({ ...base, email: v.email || undefined, phone: v.phone || undefined, userId: v.userId || undefined });
      notify.success(isEdit ? 'Cambios guardados' : 'Docente registrado');
      onSaved();
    } catch (e) { setServerError(getErrorMessage(e)); }
  };

  return (
    <Drawer title={isEdit ? `Editar a ${teacher.firstName} ${teacher.lastName}` : 'Nuevo docente'} onClose={onClose}
      footer={<>
        <button type="button" className="btn-quiet" onClick={onClose}>Cancelar</button>
        <button form="teacher-form" className="btn-ink" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : isEdit ? 'Guardar cambios' : 'Registrar docente'}</button>
      </>}>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      <form id="teacher-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Nombres" error={errors.firstName?.message} {...register('firstName')} />
        <Field label="Apellidos" error={errors.lastName?.message} {...register('lastName')} />
        <Field label="Cédula" placeholder="V-12345678" error={errors.documentId?.message} {...register('documentId')} />
        <Field label="Correo (opcional)" type="email" error={errors.email?.message} {...register('email')} />
        <Field label="Teléfono (opcional)" error={errors.phone?.message} {...register('phone')} />
        <Field label="Usuario de acceso (opcional)" hint="Vincula al docente con su cuenta para que vea solo sus materias." error={errors.userId?.message}>
          {(a11y) => (
            <select className="input" {...a11y} {...register('userId')}>
              <option value="">Sin usuario</option>
              {users?.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} · {u.email}</option>)}
            </select>
          )}
        </Field>
        {isEdit && <label className="check-row mt-2"><input type="checkbox" {...register('isActive')} /> Docente activo</label>}
      </form>
    </Drawer>
  );
}
