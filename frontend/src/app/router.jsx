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
import EnrollmentDetailPage from '../modules/enrollments/EnrollmentDetailPage';
import EnrollmentsPage from '../modules/enrollments/EnrollmentsPage';
import EnrollmentWizardPage from '../modules/enrollments/EnrollmentWizardPage';
import PermissionsPage from '../modules/permissions/PermissionsPage';
import RepresentativesPage from '../modules/representatives/RepresentativesPage';
import RequirementsPage from '../modules/requirements/RequirementsPage';
import SchoolYearsPage from '../modules/school-years/SchoolYearsPage';
import SectionsPage from '../modules/sections/SectionsPage';
import StudentDetailPage from '../modules/students/StudentDetailPage';
import StudentsPage from '../modules/students/StudentsPage';
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
        guarded('enrollment.view', '/enrollments', <EnrollmentsPage />),
        guarded('enrollment.create', '/enrollments/new', <EnrollmentWizardPage />),
        guarded('enrollment.view', '/enrollments/:id', <EnrollmentDetailPage />),
        guarded('student.view', '/students', <StudentsPage />),
        guarded('student.view', '/students/:id', <StudentDetailPage />),
        guarded('representative.view', '/representatives', <RepresentativesPage />),
        guarded('school_year.view', '/school-years', <SchoolYearsPage />),
        guarded('section.view', '/sections', <SectionsPage />),
        guarded('requirement_type.view', '/requirements', <RequirementsPage />),
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
