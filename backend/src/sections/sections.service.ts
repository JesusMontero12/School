import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ClientMetaData } from '../common/decorators';
import { PrismaService } from '../common/prisma/prisma.service';
import { diffFields } from '../common/utils/diff';
import { CreateSectionDto, ListSectionsDto, UpdateSectionDto } from './dto/sections.dto';

/** Estados que reservan cupo (PENDIENTE y ACTIVA). RETIRADA y ANULADA lo liberan. */
export const OCCUPYING_STATUSES = ['PENDIENTE', 'ACTIVA'] as const;

const include = {
  gradeLevel: { select: { id: true, number: true, name: true } },
  coordinator: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.SectionInclude;

type SectionRow = Prisma.SectionGetPayload<{ include: typeof include }>;
const present = (s: SectionRow, occupied: number | null) => ({
  id: s.id, name: s.name, maxCapacity: s.maxCapacity, isActive: s.isActive,
  gradeLevel: s.gradeLevel, coordinator: s.coordinator,
  occupied, available: occupied === null ? null : Math.max(0, s.maxCapacity - occupied),
});

@Injectable()
export class SectionsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** Año para calcular el cupo: el indicado, si no el ACTIVO, si no el más reciente. */
  private async resolveYearId(schoolYearId?: string) {
    if (schoolYearId) {
      if (!(await this.prisma.schoolYear.findUnique({ where: { id: schoolYearId }, select: { id: true } }))) throw new NotFoundException('Año escolar no encontrado');
      return schoolYearId;
    }
    const year = (await this.prisma.schoolYear.findFirst({ where: { status: 'ACTIVO' }, select: { id: true } }))
      ?? (await this.prisma.schoolYear.findFirst({ orderBy: { startDate: 'desc' }, select: { id: true } }));
    return year?.id ?? null;
  }

  private async occupiedBySection(schoolYearId: string | null, sectionIds?: string[]) {
    const map = new Map<string, number>();
    if (!schoolYearId) return map;
    const rows = await this.prisma.enrollment.groupBy({
      by: ['sectionId'], _count: { _all: true },
      where: { schoolYearId, status: { in: [...OCCUPYING_STATUSES] }, ...(sectionIds ? { sectionId: { in: sectionIds } } : {}) },
    });
    rows.forEach((r) => map.set(r.sectionId, r._count._all));
    return map;
  }

  async list(q: ListSectionsDto) {
    const sections = await this.prisma.section.findMany({
      where: { gradeLevelId: q.gradeLevelId, isActive: q.isActive },
      include, orderBy: [{ gradeLevel: { number: 'asc' } }, { name: 'asc' }],
    });
    const yearId = await this.resolveYearId(q.schoolYearId);
    const occupied = await this.occupiedBySection(yearId);
    return { schoolYearId: yearId, data: sections.map((s) => present(s, yearId ? occupied.get(s.id) ?? 0 : null)) };
  }

  async get(id: string, schoolYearId?: string) {
    const section = await this.prisma.section.findUnique({ where: { id }, include });
    if (!section) throw new NotFoundException('Sección no encontrada');
    const yearId = await this.resolveYearId(schoolYearId);
    const occupied = await this.occupiedBySection(yearId, [id]);
    return present(section, yearId ? occupied.get(id) ?? 0 : null);
  }

  private async assertCoordinator(id: string | null | undefined) {
    if (id && !(await this.prisma.teacher.findUnique({ where: { id }, select: { id: true } })))
      throw new BadRequestException('El docente coordinador no existe');
  }

  async create(dto: CreateSectionDto, actorId: string, meta: ClientMetaData) {
    const grade = await this.prisma.gradeLevel.findUnique({ where: { id: dto.gradeLevelId } });
    if (!grade) throw new BadRequestException('El año/grado no existe');
    if (!grade.isActive) throw new ConflictException('El año/grado está desactivado');
    if (await this.prisma.section.findUnique({ where: { gradeLevelId_name: { gradeLevelId: dto.gradeLevelId, name: dto.name } } }))
      throw new ConflictException(`Ya existe la sección ${dto.name} en ${grade.name}`);
    await this.assertCoordinator(dto.coordinatorId);
    const created = await this.prisma.section.create({
      data: { gradeLevelId: dto.gradeLevelId, name: dto.name, maxCapacity: dto.maxCapacity, coordinatorId: dto.coordinatorId },
      include,
    });
    await this.audit.log({ userId: actorId, action: 'section.create', entity: 'Section', entityId: created.id, metadata: { grade: grade.name, name: created.name, maxCapacity: created.maxCapacity }, ...meta });
    return present(created, 0);
  }

  async update(id: string, dto: UpdateSectionDto, actorId: string, meta: ClientMetaData) {
    const before = await this.prisma.section.findUnique({ where: { id }, include });
    if (!before) throw new NotFoundException('Sección no encontrada');
    if (dto.name && dto.name !== before.name &&
      (await this.prisma.section.findUnique({ where: { gradeLevelId_name: { gradeLevelId: before.gradeLevelId, name: dto.name } } })))
      throw new ConflictException(`Ya existe la sección ${dto.name} en ${before.gradeLevel.name}`);
    await this.assertCoordinator(dto.coordinatorId);

    // Desactivar o reducir el cupo no puede dejar a alumnos ya reservados por encima del límite
    // en ningún año que siga abierto. (Los años CERRADO son historia y no cuentan.)
    if ((dto.maxCapacity !== undefined && dto.maxCapacity < before.maxCapacity) || (dto.isActive === false && before.isActive)) {
      const perYear = await this.prisma.enrollment.groupBy({
        by: ['schoolYearId'], _count: { _all: true },
        where: { sectionId: id, status: { in: [...OCCUPYING_STATUSES] }, schoolYear: { status: { not: 'CERRADO' } } },
      });
      const peak = perYear.reduce((m, r) => Math.max(m, r._count._all), 0);
      if (dto.isActive === false && before.isActive && peak > 0)
        throw new ConflictException(`No se puede desactivar: tiene ${peak} inscripción(es) PENDIENTE/ACTIVA`);
      if (dto.maxCapacity !== undefined && dto.maxCapacity < peak)
        throw new ConflictException(`El cupo no puede ser menor que los ${peak} alumnos ya reservados en la sección`);
    }

    const after = await this.prisma.section.update({
      where: { id }, include,
      data: { name: dto.name, maxCapacity: dto.maxCapacity, isActive: dto.isActive, coordinatorId: dto.coordinatorId },
    });
    await this.audit.log({
      userId: actorId, action: 'section.update', entity: 'Section', entityId: id,
      metadata: { changes: diffFields({ ...before, coordinatorId: before.coordinatorId }, after, ['name', 'maxCapacity', 'isActive', 'coordinatorId']) }, ...meta,
    });
    const occupied = await this.occupiedBySection(await this.resolveYearId(), [id]);
    return present(after, occupied.get(id) ?? 0);
  }

  async remove(id: string, actorId: string, meta: ClientMetaData) {
    const section = await this.prisma.section.findUnique({ where: { id }, include });
    if (!section) throw new NotFoundException('Sección no encontrada');
    const used = await this.prisma.enrollment.count({ where: { sectionId: id } });
    if (used > 0) throw new ConflictException('La sección tiene inscripciones (incluso históricas): desactívala en lugar de eliminarla');
    await this.prisma.section.delete({ where: { id } });
    await this.audit.log({ userId: actorId, action: 'section.delete', entity: 'Section', entityId: id, metadata: { grade: section.gradeLevel.name, name: section.name }, ...meta });
    return { deleted: true };
  }
}
