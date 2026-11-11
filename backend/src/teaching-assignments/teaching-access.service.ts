import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';

/**
 * Quién puede ver/trabajar qué docencia.
 *
 * · Quien no es DOCENTE (dirección, administración) ve toda la docencia; lo que puede MODIFICAR lo
 *   deciden sus permisos (assignment.*, grade.*).
 * · Un DOCENTE queda limitado a SUS asignaciones vigentes: las que tiene su ficha de docente
 *   (Teacher.userId = usuario). Sin ficha de docente no ve ninguna. Si además tiene `assignment.create`
 *   (rol de gestión), ve todo.
 * · Los roles de familia nunca llegan aquí: los endpoints de gestión académica no se les exponen.
 */
@Injectable()
export class TeachingAccessService {
  constructor(private prisma: PrismaService) {}

  seesAll(user: AuthUser) { return !user.roles.includes('DOCENTE') || user.permissions.includes('assignment.create'); }

  async teacherIdOf(user: AuthUser): Promise<string | null> {
    return (await this.prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } }))?.id ?? null;
  }

  /** Lanza 403 si el usuario no es el docente asignado (vigente) a la materia en la sección y año indicados. */
  async assertTeaches(user: AuthUser, key: { schoolYearId: string; sectionId: string; subjectId: string }) {
    if (this.seesAll(user)) return;
    const teacherId = await this.teacherIdOf(user);
    const ok = teacherId && (await this.prisma.teachingAssignment.count({ where: { ...key, teacherId, endedAt: null } }));
    if (!ok) throw new ForbiddenException('No tienes asignada esta materia en esta sección');
  }
}
