import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullPageLoader } from '../components/ui';
import { usePermission } from '../hooks/usePermission';
import { useAuthStore } from '../modules/auth/store/authStore';

/** Exige sesión. Si la cuenta tiene clave temporal, fuerza el cambio antes de seguir. */
export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const mustChange = useAuthStore((s) => s.user?.mustChangePassword);
  const location = useLocation();

  if (status === 'idle' || status === 'loading') return <FullPageLoader />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  if (mustChange && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  return <Outlet />;
}

/** Solo para visitantes (login, recuperación). */
export function GuestOnly() {
  const status = useAuthStore((s) => s.status);
  if (status === 'idle' || status === 'loading') return <FullPageLoader />;
  return status === 'authenticated' ? <Navigate to="/" replace /> : <Outlet />;
}

export function RequirePermission({ permission }) {
  const { can } = usePermission();
  return can(permission) ? <Outlet /> : <Navigate to="/forbidden" replace />;
}
