import { createBrowserRouter } from 'react-router-dom';
import AppShell from './AppShell';
import { GuestOnly, RequireAuth, RequirePermission } from './guards';
import { ForbiddenPage, NotFoundPage } from './StatusPages';
import AuditPage from '../modules/audit/AuditPage';
import ChangePasswordPage from '../modules/auth/pages/ChangePasswordPage';
import ForgotPasswordPage from '../modules/auth/pages/ForgotPasswordPage';
import LoginPage from '../modules/auth/pages/LoginPage';
import ResetPasswordPage from '../modules/auth/pages/ResetPasswordPage';
import DashboardPage from '../modules/dashboard/DashboardPage';
import PermissionsPage from '../modules/permissions/PermissionsPage';
import RolesPage from '../modules/roles/RolesPage';
import UsersPage from '../modules/users/UsersPage';

/** Cada ruta protegida declara el permiso que exige; el backend lo vuelve a validar. */
const guarded = (permission, path, element) => ({
  element: <RequirePermission permission={permission} />,
  children: [{ path, element }],
});

export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [{
      element: <AppShell />,
      children: [
        guarded('dashboard.view', '/', <DashboardPage />),
        guarded('user.view', '/users', <UsersPage />),
        guarded('role.view', '/roles', <RolesPage />),
        guarded('permission.view', '/permissions', <PermissionsPage />),
        guarded('audit.view', '/audit', <AuditPage />),
        { path: '/change-password', element: <ChangePasswordPage /> },
        { path: '/forbidden', element: <ForbiddenPage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    }],
  },
]);
