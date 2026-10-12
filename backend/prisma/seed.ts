import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const crud = (m: string) => ['view', 'create', 'edit', 'delete'].map((a) => `${m}.${a}`);

// Catálogo completo (incluye módulos futuros para que el RBAC ya esté listo)
const PERMISSIONS: Record<string, string[]> = {
  dashboard: ['dashboard.view'],
  user: crud('user'),
  role: crud('role'),
  permission: ['permission.view'],
  audit: ['audit.view'],
  // Núcleo académico. Alumnos y representantes NO se crean desde sus módulos:
  // nacen en Inscripciones (enrollment.create), por eso aquí solo se consultan y editan.
  school_year: ['school_year.view', 'school_year.create', 'school_year.edit'],
  grade_level: ['grade_level.view', 'grade_level.edit'],
  section: crud('section'),
  requirement_type: ['requirement_type.view', 'requirement_type.create', 'requirement_type.edit'],
  student: ['student.view', 'student.edit'],
  representative: ['representative.view', 'representative.edit'],
  enrollment: ['enrollment.view', 'enrollment.create', 'enrollment.edit'],
  // Módulos futuros
  teacher: crud('teacher'),
  grade: ['grade.view', 'grade.create', 'grade.edit', 'grade.approve'],
  attendance: ['attendance.view', 'attendance.register'],
  report: ['report.view', 'report.generate'],
  invoice: ['invoice.view', 'invoice.create'],
  payment: ['payment.view', 'payment.register'],
  payroll: ['payroll.view', 'payroll.create'],
};

// Permisos que existieron antes y ya no tienen endpoint (se eliminan al sincronizar).
const OBSOLETE_PERMISSIONS = ['student.create', 'student.delete', 'representative.create', 'representative.delete'];

const ALL = Object.values(PERMISSIONS).flat();
const only = (...prefixes: string[]) => ALL.filter((p) => prefixes.some((x) => p.startsWith(`${x}.`)));

const ROLES = [
  { code: 'SUPER_ADMIN', name: 'Super administrador', description: 'Acceso total al sistema', permissions: ALL },
  {
    code: 'DIRECTOR', name: 'Director', description: 'Dirección académica y administrativa',
    permissions: ALL.filter((p) => !['role.create', 'role.edit', 'role.delete', 'user.delete'].includes(p)),
  },
  {
    code: 'ADMINISTRATIVO', name: 'Administrativo', description: 'Gestión diaria de matrícula y pagos',
    permissions: [
      'dashboard.view', 'user.view',
      ...only('student', 'teacher', 'representative', 'enrollment', 'section', 'invoice', 'payment'),
      'school_year.view', 'grade_level.view', 'requirement_type.view',
      'attendance.view', 'report.view',
    ],
  },
  {
    code: 'DOCENTE', name: 'Docente', description: 'Notas y asistencia de sus cursos',
    permissions: [
      'dashboard.view', 'student.view', 'enrollment.view',
      'school_year.view', 'grade_level.view', 'section.view',
      'grade.view', 'grade.create', 'grade.edit', 'attendance.view', 'attendance.register',
    ],
  },
  {
    // student.view se limita a "sus representados" en el servicio (ver common/access/access-scope.ts)
    code: 'REPRESENTANTE', name: 'Representante', description: 'Seguimiento de sus representados',
    permissions: ['dashboard.view', 'student.view', 'grade.view', 'attendance.view', 'invoice.view', 'payment.view'],
  },
  {
    code: 'ESTUDIANTE', name: 'Estudiante', description: 'Consulta de su información académica',
    permissions: ['dashboard.view', 'grade.view', 'attendance.view'],
  },
];

// Educación Media: 1er a 5to Año
const GRADE_LEVELS = [
  { number: 1, name: '1er Año' },
  { number: 2, name: '2do Año' },
  { number: 3, name: '3er Año' },
  { number: 4, name: '4to Año' },
  { number: 5, name: '5to Año' },
];

// Requisitos base de inscripción. El colegio puede agregar otros y ajustar cuáles son obligatorios.
const REQUIREMENTS = [
  { code: 'CERTIFICADO_PROMOCION', name: 'Certificado de promoción' },
  { code: 'PARTIDA_NACIMIENTO', name: 'Partida de nacimiento' },
  { code: 'INFORME_DESCRIPTIVO', name: 'Informe descriptivo del alumno' },
  { code: 'COPIA_CI_ALUMNO', name: 'Copia de C.I. del alumno' },
  { code: 'COPIA_CI_REPRESENTANTE', name: 'Copia de C.I. del representante' },
  { code: 'FOTOS_ALUMNO', name: 'Fotografías del alumno' },
  { code: 'FOTO_REPRESENTANTE', name: 'Fotografía del representante' },
  { code: 'CODIGO_SIGES', name: 'Código SIGES' },
];

async function main() {
  for (const [module, codes] of Object.entries(PERMISSIONS)) {
    for (const code of codes) {
      await prisma.permission.upsert({ where: { code }, update: { module }, create: { code, module, description: code } });
    }
  }
  await prisma.permission.deleteMany({ where: { code: { in: OBSOLETE_PERMISSIONS } } });
  const permissions = await prisma.permission.findMany();
  const byCode = new Map(permissions.map((p) => [p.code, p.id]));

  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: { code: r.code, name: r.name, description: r.description, isSystem: true },
    });
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({ data: [...new Set(r.permissions)].map((code) => ({ roleId: role.id, permissionId: byCode.get(code)! })) }),
    ]);
  }

  // `update: {}` → no pisa cambios que el colegio haya hecho después (nombre, obligatoriedad, orden)
  for (const g of GRADE_LEVELS) {
    await prisma.gradeLevel.upsert({ where: { number: g.number }, update: {}, create: g });
  }
  for (const [i, req] of REQUIREMENTS.entries()) {
    await prisma.requirementType.upsert({
      where: { code: req.code }, update: {},
      create: { ...req, isRequired: true, isSystem: true, sortOrder: i + 1 },
    });
  }

  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@escuela.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Cambiar-Esta-Clave-1';
  const superRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } });
  if (!(await prisma.user.findUnique({ where: { email } }))) {
    await prisma.user.create({
      data: {
        email, firstName: 'Administrador', lastName: 'Principal',
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        mustChangePassword: true,
        userRoles: { create: { roleId: superRole.id } },
      },
    });
    console.log(`✔ Super admin creado: ${email}`);
  }
  console.log(`✔ ${permissions.length} permisos, ${ROLES.length} roles, ${GRADE_LEVELS.length} grados y ${REQUIREMENTS.length} requisitos sincronizados`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
