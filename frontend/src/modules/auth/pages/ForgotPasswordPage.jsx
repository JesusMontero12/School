import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Field, Spinner } from '../../../components/ui';
import { authService } from '../../../services/authService';
import { getErrorMessage } from '../../../utils/errors';
import { email } from '../../../utils/schemas';
import AuthLayout from './AuthLayout';

export default function ForgotPasswordPage() {
  const [result, setResult] = useState({ ok: '', error: '' });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ email })) });

  const onSubmit = async (values) => {
    try { setResult({ ok: (await authService.forgotPassword(values)).message, error: '' }); }
    catch (e) { setResult({ ok: '', error: getErrorMessage(e) }); }
  };

  return (
    <AuthLayout>
      <h2>Recupera tu acceso</h2>
      <p className="sub">Te enviaremos un enlace para crear una contraseña nueva.</p>
      {result.error && <div className="alert-x" role="alert">{result.error}</div>}
      {result.ok && <div className="alert-x alert-ok" role="status">{result.ok}</div>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Correo" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <button className="btn-pencil" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : 'Enviar enlace'}</button>
      </form>
      <p className="auth-links"><Link to="/login">Volver a entrar</Link></p>
    </AuthLayout>
  );
}
