import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ClientMetaData } from '../common/decorators';
import { paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { diffFields } from '../common/utils/diff';
import { normalizeIdentification, tokens } from '../common/utils/normalize';
import { CreateTeacherDto, ListTeachersDto, UpdateTeacherDto } from './dto/teachers.dto';

const AUDITED_FIELDS = ['firstName', 'lastName', 'documentId', 'email', 'phone', 'userId', 'isActive'];

const select = {
  id: true, firstName: true, lastName: true, documentId: true, email: true, phone: true, isActive: true, userId: true,
  user: { select: { id: true, email: true, isActive: true } },
} satisfies Prisma.TeacherSelect;

@Injectable()
export class TeachersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(q: ListTeachersDto) {
    const where: Prisma.TeacherWhereInput = {
      isActive: q.isActive === undefined ? undefined : q.isActive === 'true',
      ...(q.search ? {
        AND: tokens(q.search).map((t) => ({
          OR: [
            { firstName: { contains: t, mode: 'insensitive' as const } },
            { lastName: { contains: t, mode: 'insensitive' as const } },
            { documentId: { contains: normalizeIdentification(t) } },
            { email: { contains: t, mode: 'insensitive' as const } },
          ],
        })),
      } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.teacher.findMany({ where, select, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit }),
      this.prisma.teacher.count({ where }),
    ]);
    const counts = await this.activeAssignmentCounts(rows.map((r) => r.id));
    return paginated(rows.map((r) => ({ ...r, activeAssignments: counts.get(r.id) ?? 0 })), total, q);
  }

  private async activeAssignmentCounts(teacherIds: string[]) {
    const grouped = await this.prisma.teachingAssignment.groupBy({
      by: ['teacherId'], _count: { _all: true },
      where: { teacherId: { in: teacherIds }, endedAt: null, schoolYear: { status: { not: 'CERRADO' } } },
    });
    return new Map(grouped.map((g) => [g.teacherId, g._count._all]));
  }

  /** Docentes activos para los selectores. */
  options() {
    return this.prisma.teacher.findMany({ where: { isActive: true }, select: { id: true, firstName: true, lastName: true, documentId: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] });
  }

  /** Usuarios con rol DOCENTE activos y aún sin ficha de docente (más el actual, al editar). */
  userOptions(includeUserId?: string) {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { teacher: null, userRoles: { some: { role: { code: 'DOCENTE' } } } },
          ...(includeUserId ? [{ id: includeUserId }] : []),
        ],
      },
      select: { id: true, email: true, firstName: true, lastName: true }, orderBy: { email: 'asc' },
    });
  }

  async get(id: string) {
    const row = await this.prisma.teacher.findUnique({ where: { id }, select });
    if (!row) throw new NotFoundException('Docente no encontrado');
    const counts = await this.activeAssignmentCounts([id]);
    return { ...row, activeAssignments: counts.get(id) ?? 0 };
  }

  private async assertUserFree(userId: string, teacherId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, teacher: { select: { id: true } } } });
    if (!user) throw new BadRequestException('El usuario indicado no existe');
    if (!user.isActive) throw new BadRequestException('El usuario indicado está inactivo');
    if (user.teacher && user.teacher.id !== teacherId) throw new ConflictException('Ese usuario ya está vinculado a otro docente');
  }

  private async assertDocumentFree(documentId: string, teacherId?: string) {
    const dup = await this.prisma.teacher.findFirst({ where: { documentId, ...(teacherId ? { id: { not: teacherId } } : {}) }, select: { firstName: true, lastName: true } });
    if (dup) throw new ConflictException(`Ya existe un docente con esa cédula (${dup.firstName} ${dup.lastName})`);
  }

  async create(dto: CreateTeacherDto, actorId: string, meta: ClientMetaData) {
    await this.assertDocumentFree(dto.documentId);
    if (dto.userId) await this.assertUserFree(dto.userId);
    const created = await this.prisma.teacher.create({ data: dto, select });
    await this.audit.log({ userId: actorId, action: 'teacher.create', entity: 'Teacher', entityId: created.id, metadata: { name: `${created.firstName} ${created.lastName}`, documentId: created.documentId }, ...meta });
    return { ...created, activeAssignments: 0 };
  }

  async update(id: string, dto: UpdateTeacherDto, actorId: string, meta: ClientMetaData) {
    const before = await this.prisma.teacher.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Docente no encontrado');
    if ((dto.firstName as unknown) === null || (dto.lastName as unknown) === null) throw new BadRequestException('El nombre y el apellido no pueden quedar vacíos');
    if (dto.documentId && dto.documentId !== before.documentId) await this.assertDocumentFree(dto.documentId, id);
    if (dto.userId && dto.userId !== before.userId) await this.assertUserFree(dto.userId, id);

    if (dto.isActive === false && before.isActive) {
      if (await this.prisma.teachingAssignment.count({ where: { teacherId: id, endedAt: null, schoolYear: { status: { not: 'CERRADO' } } } }))
        throw new ConflictException('No se puede desactivar: tiene asignaciones vigentes. Finalízalas o reasígnalas primero');
      if (await this.prisma.section.count({ where: { coordinatorId: id, isActive: true } }))
        throw new ConflictException('No se puede desactivar: es coordinador de una sección. Cambia el coordinador primero');
    }
    const after = await this.prisma.teacher.update({ where: { id }, data: dto, select });
    await this.audit.log({ userId: actorId, action: 'teacher.update', entity: 'Teacher', entityId: id, metadata: { changes: diffFields(before, after, AUDITED_FIELDS) }, ...meta });
    const counts = await this.activeAssignmentCounts([id]);
    return { ...after, activeAssignments: counts.get(id) ?? 0 };
  }
}
