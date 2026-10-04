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
  student: crud('student'),
  teacher: crud('teacher'),
  representative: crud('representative'),
  enrollment: ['enrollment.view', 'enrollment.create', 'enrollment.edit'],
  grade: ['grade.view', 'grade.create', 'grade.edit', 'grade.approve'],
  attendance: ['attendance.view', 'attendance.register'],
  report: ['report.view', 'report.generate'],
  invoice: ['invoice.view', 'invoice.create'],
  payment: ['payment.view', 'payment.register'],
  payroll: ['payroll.view', 'payroll.create'],
};

const ALL = Object.values(PERMISSIONS).flat();
const only = (...prefixes: string[]) => ALL.filter((p) => prefixes.some((x) => p.startsWith(x)));

const ROLES = [
  { code: 'SUPER_ADMIN', name: 'Super administrador', description: 'Acceso total al sistema', permissions: ALL },
  {
    code: 'DIRECTOR', name: 'Director', description: 'Dirección académica y administrativa',
    permissions: ALL.filter((p) => !['role.create', 'role.edit', 'role.delete', 'user.delete'].includes(p)),
  },
  {
    code: 'ADMINISTRATIVO', name: 'Administrativo', description: 'Gestión diaria de matrícula y pagos',
    permissions: ['dashboard.view', 'user.view', ...only('student', 'teacher', 'representative', 'enrollment', 'invoice', 'payment'), 'attendance.view', 'report.view'],
  },
  {
    code: 'DOCENTE', name: 'Docente', description: 'Notas y asistencia de sus cursos',
    permissions: ['dashboard.view', 'student.view', 'enrollment.view', 'grade.view', 'grade.create', 'grade.edit', 'attendance.view', 'attendance.register'],
  },
  {
    code: 'REPRESENTANTE', name: 'Representante', description: 'Seguimiento de sus representados',
    permissions: ['dashboard.view', 'student.view', 'grade.view', 'attendance.view', 'invoice.view', 'payment.view'],
  },
  {
    code: 'ESTUDIANTE', name: 'Estudiante', description: 'Consulta de su información académica',
    permissions: ['dashboard.view', 'grade.view', 'attendance.view'],
  },
];

async function main() {
  for (const [module, codes] of Object.entries(PERMISSIONS)) {
    for (const code of codes) {
      await prisma.permission.upsert({ where: { code }, update: { module }, create: { code, module, description: code } });
    }
  }
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
  console.log(`✔ ${permissions.length} permisos, ${ROLES.length} roles sincronizados`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
