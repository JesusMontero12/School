import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PasswordField, Spinner } from '../../../components/ui';
import { authService } from '../../../services/authService';
import { notify } from '../../../utils/alerts';
import { getErrorMessage } from '../../../utils/errors';
import { newPassword, passwordHint } from '../../../utils/schemas';
import AuthLayout from './AuthLayout';

const schema = z.object({ newPassword, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden' });

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  if (!token) return (
    <AuthLayout>
      <h2>Enlace incompleto</h2>
      <p className="sub">Abre el enlace completo del correo o solicita uno nuevo.</p>
      <Link className="btn-ink" to="/forgot-password" style={{ textDecoration: 'none' }}>Solicitar enlace nuevo</Link>
    </AuthLayout>
  );

  const onSubmit = async ({ newPassword }) => {
    try {
      await authService.resetPassword({ token, newPassword });
      notify.success('Contraseña restablecida');
      navigate('/login', { replace: true });
    } catch (e) { setError(getErrorMessage(e)); }
  };

  return (
    <AuthLayout>
      <h2>Crea una contraseña nueva</h2>
      <p className="sub">Elige una que no uses en otros sitios.</p>
      {error && <div className="alert-x" role="alert">{error}</div>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <PasswordField label="Contraseña nueva" hint={passwordHint} autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
        <PasswordField label="Repite la contraseña" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <button className="btn-pencil" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : 'Guardar contraseña'}</button>
      </form>
    </AuthLayout>
  );
}
