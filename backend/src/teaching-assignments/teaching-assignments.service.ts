import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ClientMetaData } from '../common/decorators';
import { paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { CoverageDto, CreateAssignmentDto, EndAssignmentDto, ListAssignmentsDto, ReassignDto } from './dto/teaching-assignments.dto';
import { TeachingAccessService } from './teaching-access.service';

const include = {
  schoolYear: { select: { id: true, name: true, status: true } },
  section: { select: { id: true, name: true, gradeLevel: { select: { id: true, number: true, name: true } } } },
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.TeachingAssignmentInclude;

@Injectable()
export class TeachingAssignmentsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private access: TeachingAccessService) {}

  private async resolveYearId(schoolYearId?: string) {
    if (schoolYearId) {
      if (!(await this.prisma.schoolYear.findUnique({ where: { id: schoolYearId }, select: { id: true } }))) throw new NotFoundException('Año escolar no encontrado');
      return schoolYearId;
    }
    const year = (await this.prisma.schoolYear.findFirst({ where: { status: 'ACTIVO' }, select: { id: true } }))
      ?? (await this.prisma.schoolYear.findFirst({ orderBy: { startDate: 'desc' }, select: { id: true } }));
    return year?.id ?? null;
  }

  async list(q: ListAssignmentsDto, user: AuthUser) {
    const schoolYearId = await this.resolveYearId(q.schoolYearId);
    const where: Prisma.TeachingAssignmentWhereInput = {
      schoolYearId: schoolYearId ?? '00000000-0000-0000-0000-000000000000',
      sectionId: q.sectionId, subjectId: q.subjectId, teacherId: q.teacherId,
      ...(q.gradeLevelId ? { section: { gradeLevelId: q.gradeLevelId } } : {}),
      ...((q.state ?? 'vigente') === 'vigente' ? { endedAt: null } : q.state === 'finalizada' ? { endedAt: { not: null } } : {}),
    };
    if (!this.access.seesAll(user)) {
      // Un docente solo ve lo suyo. Sin ficha de docente: nada.
      const teacherId = await this.access.teacherIdOf(user);
      where.teacherId = teacherId ?? '00000000-0000-0000-0000-000000000000';
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.teachingAssignment.findMany({
        where, include, skip: (q.page - 1) * q.limit, take: q.limit,
        orderBy: [{ section: { gradeLevel: { number: 'asc' } } }, { section: { name: 'asc' } }, { subject: { name: 'asc' } }, { createdAt: 'desc' }],
      }),
      this.prisma.teachingAssignment.count({ where }),
    ]);
    return { ...paginated(rows, total, q), schoolYearId };
  }

  /**
   * Cobertura de un año: cada sección activa con las materias de su plan de estudio y el docente vigente
   * (o null si aún no tiene). Solo para quien gestiona la docencia.
   */
  async coverage(q: CoverageDto) {
    const schoolYearId = await this.resolveYearId(q.schoolYearId);
    if (!schoolYearId) return { schoolYearId: null, sections: [] };
    const [sections, current] = await Promise.all([
      this.prisma.section.findMany({
        where: { isActive: true, ...(q.gradeLevelId ? { gradeLevelId: q.gradeLevelId } : {}) },
        select: { id: true, name: true, gradeLevel: { select: { id: true, number: true, name: true, subjects: { select: { subject: { select: { id: true, name: true, isActive: true } } } } } } },
        orderBy: [{ gradeLevel: { number: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.teachingAssignment.findMany({ where: { schoolYearId, endedAt: null }, select: { id: true, sectionId: true, subjectId: true, teacher: { select: { id: true, firstName: true, lastName: true } } } }),
    ]);
    const byKey = new Map(current.map((a) => [`${a.sectionId}:${a.subjectId}`, a]));
    return {
      schoolYearId,
      sections: sections.map((s) => ({
        id: s.id, name: s.name, gradeLevel: { id: s.gradeLevel.id, number: s.gradeLevel.number, name: s.gradeLevel.name },
        subjects: s.gradeLevel.subjects.map((x) => x.subject).filter((x) => x.isActive).sort((a, b) => a.name.localeCompare(b.name, 'es'))
          .map((sub) => { const a = byKey.get(`${s.id}:${sub.id}`); return { id: sub.id, name: sub.name, assignmentId: a?.id ?? null, teacher: a?.teacher ?? null }; }),
      })),
    };
  }

  private async assertYearOpen(schoolYearId: string) {
    const year = await this.prisma.schoolYear.findUnique({ where: { id: schoolYearId }, select: { status: true } });
    if (!year) throw new NotFoundException('Año escolar no encontrado');
    if (year.status === 'CERRADO') throw new ConflictException('El año escolar está cerrado: sus asignaciones no se pueden modificar');
  }

  private async assertTeacherActive(teacherId: string) {
    const t = await this.prisma.teacher.findUnique({ where: { id: teacherId }, select: { isActive: true } });
    if (!t) throw new NotFoundException('Docente no encontrado');
    if (!t.isActive) throw new BadRequestException('El docente está inactivo');
  }

  async create(dto: CreateAssignmentDto, actorId: string, meta: ClientMetaData) {
    await this.assertYearOpen(dto.schoolYearId);
    await this.assertTeacherActive(dto.teacherId);
    const [section, subject] = await Promise.all([
      this.prisma.section.findUnique({ where: { id: dto.sectionId }, select: { isActive: true, gradeLevelId: true } }),
      this.prisma.subject.findUnique({ where: { id: dto.subjectId }, select: { isActive: true, gradeLevels: { select: { gradeLevelId: true } } } }),
    ]);
    if (!section) throw new NotFoundException('Sección no encontrada');
    if (!subject) throw new NotFoundException('Materia no encontrada');
    if (!section.isActive) throw new BadRequestException('La sección está inactiva');
    if (!subject.isActive) throw new BadRequestException('La materia está inactiva');
    if (!subject.gradeLevels.some((g) => g.gradeLevelId === section.gradeLevelId))
      throw new BadRequestException('La materia no pertenece al plan de estudio del año de esta sección');
    const existing = await this.prisma.teachingAssignment.findFirst({
      where: { schoolYearId: dto.schoolYearId, sectionId: dto.sectionId, subjectId: dto.subjectId, endedAt: null },
      select: { teacher: { select: { firstName: true, lastName: true } } },
    });
    if (existing) throw new ConflictException(`Esta materia ya está asignada en la sección a ${existing.teacher.firstName} ${existing.teacher.lastName}. Usa "Reasignar"`);
    const created = await this.prisma.teachingAssignment.create({ data: { ...dto, createdById: actorId }, include });
    await this.audit.log({ userId: actorId, action: 'assignment.create', entity: 'TeachingAssignment', entityId: created.id, metadata: { ...dto }, ...meta });
    return created;
  }

  private async findLive(id: string) {
    const row = await this.prisma.teachingAssignment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Asignación no encontrada');
    if (row.endedAt) throw new ConflictException('La asignación ya fue finalizada');
    await this.assertYearOpen(row.schoolYearId);
    return row;
  }

  /** Cierra la asignación vigente y abre otra con el nuevo docente; el historial de ambos queda. */
  async reassign(id: string, dto: ReassignDto, actorId: string, meta: ClientMetaData) {
    const old = await this.findLive(id);
    if (old.teacherId === dto.teacherId) throw new BadRequestException('La materia ya está asignada a ese docente');
    await this.assertTeacherActive(dto.teacherId);
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.teachingAssignment.update({ where: { id }, data: { endedAt: new Date(), endReason: dto.reason ?? 'Reasignación' } });
      return tx.teachingAssignment.create({
        data: { schoolYearId: old.schoolYearId, sectionId: old.sectionId, subjectId: old.subjectId, teacherId: dto.teacherId, createdById: actorId },
        include,
      });
    });
    await this.audit.log({
      userId: actorId, action: 'assignment.reassign', entity: 'TeachingAssignment', entityId: created.id,
      metadata: { previousAssignmentId: id, teacherId: [old.teacherId, dto.teacherId], reason: dto.reason ?? null }, ...meta,
    });
    return created;
  }

  async end(id: string, dto: EndAssignmentDto, actorId: string, meta: ClientMetaData) {
    const old = await this.findLive(id);
    const ended = await this.prisma.teachingAssignment.update({ where: { id }, data: { endedAt: new Date(), endReason: dto.reason ?? null }, include });
    await this.audit.log({ userId: actorId, action: 'assignment.end', entity: 'TeachingAssignment', entityId: id, metadata: { teacherId: old.teacherId, reason: dto.reason ?? null }, ...meta });
    return ended;
  }
}
