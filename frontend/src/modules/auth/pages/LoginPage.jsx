import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Field, PasswordField, Spinner } from '../../../components/ui';
import { getErrorMessage } from '../../../utils/errors';
import { email } from '../../../utils/schemas';
import { useAuthStore } from '../store/authStore';
import AuthLayout from './AuthLayout';

const schema = z.object({ email, password: z.string().min(1, 'Escribe tu contraseña') });

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      await login(values);
      navigate(location.state?.from?.pathname ?? '/', { replace: true });
    } catch (e) { setServerError(getErrorMessage(e)); }
  };

  return (
    <AuthLayout>
      <h2>Entrar a Aula</h2>
      <p className="sub">Usa el correo con el que te registró la institución.</p>
      {serverError && <div className="alert-x" role="alert">{serverError}</div>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Correo" type="email" autoComplete="username" placeholder="nombre@escuela.edu" error={errors.email?.message} {...register('email')} />
        <PasswordField label="Contraseña" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <button className="btn-pencil" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : 'Entrar'}</button>
      </form>
      <p className="auth-links"><Link to="/forgot-password">¿Olvidaste tu contraseña?</Link></p>
    </AuthLayout>
  );
}
