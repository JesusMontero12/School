import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { PageHeader, PasswordField, Spinner } from '../../../components/ui';
import { authService } from '../../../services/authService';
import { notify } from '../../../utils/alerts';
import { getErrorMessage } from '../../../utils/errors';
import { newPassword, passwordHint } from '../../../utils/schemas';
import { useAuthStore } from '../store/authStore';

const schema = z.object({ currentPassword: z.string().min(1, 'Escribe tu contraseña actual'), newPassword, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden' });

export default function ChangePasswordPage() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      await authService.changePassword({ currentPassword, newPassword });
      clear(); // el backend revoca todas las sesiones: se vuelve a entrar
      notify.success('Contraseña actualizada. Entra de nuevo.');
      navigate('/login', { replace: true });
    } catch (e) { setError(getErrorMessage(e)); }
  };

  return (
    <>
      <PageHeader title="Cambiar contraseña"
        description={user.mustChangePassword ? 'Tu cuenta usa una contraseña temporal. Crea una propia para continuar.' : 'Al cambiarla se cerrarán tus sesiones abiertas en otros dispositivos.'} />
      <div className="panel" style={{ maxWidth: 520, padding: '1.6rem' }}>
        {error && <div className="alert-x" role="alert">{error}</div>}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <PasswordField label="Contraseña actual" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
          <PasswordField label="Contraseña nueva" hint={passwordHint} autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
          <PasswordField label="Repite la contraseña nueva" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
          <button className="btn-ink" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : 'Guardar contraseña'}</button>
        </form>
      </div>
    </>
  );
}
