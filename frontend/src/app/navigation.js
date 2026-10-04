import { FiGrid, FiUsers, FiShield, FiKey, FiActivity } from 'react-icons/fi';

/**
 * Fuente única del menú. Para sumar un módulo (p. ej. Estudiantes) se agrega un ítem aquí
 * y su ruta en router.jsx: el menú y la protección salen solos a partir del permiso.
 */
export const NAV_ITEMS = [
  { path: '/', label: 'Inicio', description: 'Resumen de tu cuenta', icon: FiGrid, permission: 'dashboard.view', group: 'General', end: true },
  { path: '/users', label: 'Usuarios', description: 'Cuentas y accesos', icon: FiUsers, permission: 'user.view', group: 'Seguridad' },
  { path: '/roles', label: 'Roles', description: 'Qué puede hacer cada rol', icon: FiShield, permission: 'role.view', group: 'Seguridad' },
  { path: '/permissions', label: 'Permisos', description: 'Catálogo de permisos', icon: FiKey, permission: 'permission.view', group: 'Seguridad' },
  { path: '/audit', label: 'Auditoría', description: 'Quién hizo qué y cuándo', icon: FiActivity, permission: 'audit.view', group: 'Seguridad' },
];

export const groupNav = (items) =>
  Object.entries(items.reduce((acc, it) => ({ ...acc, [it.group]: [...(acc[it.group] ?? []), it] }), {}));
