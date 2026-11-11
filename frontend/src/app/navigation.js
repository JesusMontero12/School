import { FiGrid, FiUsers, FiShield, FiKey, FiActivity, FiClipboard, FiUser, FiHeart, FiCalendar, FiLayers, FiFileText, FiBookOpen, FiUserCheck, FiLink, FiEdit3, FiAward, FiBarChart2 } from 'react-icons/fi';

/**
 * Fuente única del menú. Para sumar un módulo (p. ej. Estudiantes) se agrega un ítem aquí
 * y su ruta en router.jsx: el menú y la protección salen solos a partir del permiso.
 * `visible(can)` (opcional) afina cuándo se muestra el ítem; el backend siempre valida el acceso real.
 */
export const NAV_ITEMS = [
  { path: '/', label: 'Inicio', description: 'Resumen de tu cuenta', icon: FiGrid, permission: 'dashboard.view', group: 'General', end: true },
  { path: '/enrollments', label: 'Inscripciones', description: 'Matrícula por año escolar', icon: FiClipboard, permission: 'enrollment.view', group: 'Académico' },
  { path: '/students', label: 'Alumnos', description: 'Datos, fotos e historial', icon: FiUser, permission: 'student.view', group: 'Académico' },
  { path: '/representatives', label: 'Representantes', description: 'Contacto de las familias', icon: FiHeart, permission: 'representative.view', group: 'Académico' },
  { path: '/school-years', label: 'Años escolares', description: 'Momentos pedagógicos', icon: FiCalendar, permission: 'school_year.view', group: 'Académico' },
  { path: '/sections', label: 'Años y secciones', description: 'Secciones y cupos', icon: FiLayers, permission: 'section.view', group: 'Académico' },
  { path: '/requirements', label: 'Requisitos', description: 'Documentos de inscripción', icon: FiFileText, permission: 'requirement_type.view', group: 'Académico' },
  { path: '/subjects', label: 'Materias', description: 'Catálogo y plan de estudio', icon: FiBookOpen, permission: 'subject.view', group: 'Académico' },
  { path: '/teachers', label: 'Docentes', description: 'Personal docente', icon: FiUserCheck, permission: 'teacher.view', group: 'Académico' },
  { path: '/assignments', label: 'Asignaciones', description: 'Docente por materia y sección', icon: FiLink, permission: 'assignment.view', group: 'Académico' },
  { path: '/grades', label: 'Calificaciones', description: 'Evaluaciones y notas por materia', icon: FiEdit3, permission: 'assignment.view', group: 'Académico' },
  {
    // Familias (grade.view sin assignment.view) y personal con report.view. Un docente ve sus planillas, no boletines completos.
    path: '/report-cards', label: 'Boletines', description: 'Notas por momento y anual', icon: FiAward, permission: 'grade.view', group: 'Académico',
    visible: (can) => can('report.view') || (can('grade.view') && !can('assignment.view')),
  },
  { path: '/reports', label: 'Reportes', description: 'Rendimiento y pendientes', icon: FiBarChart2, permission: 'report.view', group: 'Académico' },
  { path: '/users', label: 'Usuarios', description: 'Cuentas y accesos', icon: FiUsers, permission: 'user.view', group: 'Seguridad' },
  { path: '/roles', label: 'Roles', description: 'Qué puede hacer cada rol', icon: FiShield, permission: 'role.view', group: 'Seguridad' },
  { path: '/permissions', label: 'Permisos', description: 'Catálogo de permisos', icon: FiKey, permission: 'permission.view', group: 'Seguridad' },
  { path: '/audit', label: 'Auditoría', description: 'Quién hizo qué y cuándo', icon: FiActivity, permission: 'audit.view', group: 'Seguridad' },
];

export const groupNav = (items) =>
  Object.entries(items.reduce((acc, it) => ({ ...acc, [it.group]: [...(acc[it.group] ?? []), it] }), {}));
