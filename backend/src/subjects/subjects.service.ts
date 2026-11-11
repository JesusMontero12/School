import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ClientMetaData } from '../common/decorators';
import { paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { diffFields } from '../common/utils/diff';
import { tokens, toCode } from '../common/utils/normalize';
import { CreateSubjectDto, ListSubjectsDto, SetTermSettingDto, UpdateSubjectDto } from './dto/subjects.dto';

const include = {
  gradeLevels: { select: { gradeLevel: { select: { id: true, number: true, name: true } } } },
  _count: { select: { assignments: { where: { endedAt: null } } } },
} satisfies Prisma.SubjectInclude;
type Row = Prisma.SubjectGetPayload<{ include: typeof include }>;

const present = (s: Row) => ({
  id: s.id, code: s.code, name: s.name, description: s.description, isActive: s.isActive,
  gradeLevels: s.gradeLevels.map((g) => g.gradeLevel).sort((a, b) => a.number - b.number),
  activeAssignments: s._count.assignments,
});

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(q: ListSubjectsDto) {
    const where: Prisma.SubjectWhereInput = {
      isActive: q.isActive,
      ...(q.gradeLevelId ? { gradeLevels: { some: { gradeLevelId: q.gradeLevelId } } } : {}),
      ...(q.search ? { AND: tokens(q.search).map((t) => ({ OR: [{ name: { contains: t, mode: 'insensitive' as const } }, { code: { contains: toCode(t) || t, mode: 'insensitive' as const } }] })) } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.subject.findMany({ where, include, orderBy: { name: 'asc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
      this.prisma.subject.count({ where }),
    ]);
    return paginated(rows.map(present), total, q);
  }

  /** Materias activas para los selectores. */
  async options() {
    const rows = await this.prisma.subject.findMany({ where: { isActive: true }, include, orderBy: { name: 'asc' } });
    return rows.map(present);
  }

  async get(id: string) {
    const row = await this.prisma.subject.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException('Materia no encontrada');
    return present(row);
  }

  private async assertGradeLevels(ids: string[]) {
    const found = await this.prisma.gradeLevel.findMany({ where: { id: { in: ids } }, select: { id: true, isActive: true, name: true } });
    if (found.length !== ids.length) throw new BadRequestException('Alguno de los años seleccionados no existe');
    const inactive = found.find((g) => !g.isActive);
    if (inactive) throw new BadRequestException(`El año "${inactive.name}" está inactivo`);
  }

  async create(dto: CreateSubjectDto, actorId: string, meta: ClientMetaData) {
    const base = toCode(dto.name);
    if (!base) throw new BadRequestException('El nombre debe contener letras o números');
    if (await this.prisma.subject.findFirst({ where: { name: { equals: dto.name, mode: 'insensitive' } } })) throw new ConflictException('Ya existe una materia con ese nombre');
    await this.assertGradeLevels(dto.gradeLevelIds);
    let code = base;
    for (let n = 2; await this.prisma.subject.findUnique({ where: { code } }); n++) code = `${base.slice(0, 36)}_${n}`;
    const created = await this.prisma.subject.create({
      data: { code, name: dto.name, description: dto.description, gradeLevels: { create: dto.gradeLevelIds.map((gradeLevelId) => ({ gradeLevelId })) } },
      include,
    });
    await this.audit.log({ userId: actorId, action: 'subject.create', entity: 'Subject', entityId: created.id, metadata: { code, name: created.name, gradeLevelIds: dto.gradeLevelIds }, ...meta });
    return present(created);
  }

  async update(id: string, dto: UpdateSubjectDto, actorId: string, meta: ClientMetaData) {
    const before = await this.prisma.subject.findUnique({ where: { id }, include });
    if (!before) throw new NotFoundException('Materia no encontrada');
    if (dto.name && dto.name.toLowerCase() !== before.name.toLowerCase() &&
      (await this.prisma.subject.findFirst({ where: { name: { equals: dto.name, mode: 'insensitive' }, id: { not: id } } })))
      throw new ConflictException('Ya existe una materia con ese nombre');

    // Una asignación vigente en un año no cerrado depende de que la materia siga activa y en el plan del año.
    const liveAssignments = { subjectId: id, endedAt: null, schoolYear: { status: { not: 'CERRADO' as const } } };
    if (dto.isActive === false && before.isActive && (await this.prisma.teachingAssignment.count({ where: liveAssignments })))
      throw new ConflictException('No se puede desactivar: tiene asignaciones docentes vigentes. Finalízalas primero');

    let removed: string[] = [];
    if (dto.gradeLevelIds) {
      await this.assertGradeLevels(dto.gradeLevelIds.filter((g) => !before.gradeLevels.some((x) => x.gradeLevel.id === g)));
      removed = before.gradeLevels.map((g) => g.gradeLevel.id).filter((g) => !dto.gradeLevelIds!.includes(g));
      if (removed.length && (await this.prisma.teachingAssignment.count({ where: { ...liveAssignments, section: { gradeLevelId: { in: removed } } } })))
        throw new ConflictException('No se puede quitar un año con asignaciones docentes vigentes. Finalízalas primero');
    }

    const { gradeLevelIds, ...data } = dto;
    const after = await this.prisma.$transaction(async (tx) => {
      if (gradeLevelIds) {
        if (removed.length) await tx.gradeLevelSubject.deleteMany({ where: { subjectId: id, gradeLevelId: { in: removed } } });
        const have = new Set(before.gradeLevels.map((g) => g.gradeLevel.id));
        const add = gradeLevelIds.filter((g) => !have.has(g));
        if (add.length) await tx.gradeLevelSubject.createMany({ data: add.map((gradeLevelId) => ({ gradeLevelId, subjectId: id })) });
      }
      return tx.subject.update({ where: { id }, data, include });
    });
    const changes = diffFields(before, after, ['name', 'description', 'isActive']);
    const ids = (r: Row) => r.gradeLevels.map((g) => g.gradeLevel.number).sort().join(',');
    if (ids(before) !== ids(after)) changes.gradeLevels = [ids(before), ids(after)];
    await this.audit.log({ userId: actorId, action: 'subject.update', entity: 'Subject', entityId: id, metadata: { changes }, ...meta });
    return present(after);
  }

  // ───────── Prueba de lapso por materia y momento ─────────

  /** Matriz de un año: momentos × materias activas, con la configuración de lapso (por defecto: sin prueba de lapso). */
  async termSettings(schoolYearId: string) {
    const year = await this.prisma.schoolYear.findUnique({ where: { id: schoolYearId }, include: { terms: { orderBy: { number: 'asc' } } } });
    if (!year) throw new NotFoundException('Año escolar no encontrado');
    const [subjects, settings] = await Promise.all([
      this.prisma.subject.findMany({ where: { isActive: true }, include, orderBy: { name: 'asc' } }),
      this.prisma.subjectTermSetting.findMany({ where: { term: { schoolYearId } } }),
    ]);
    const on = new Set(settings.filter((s) => s.hasLapsoTest).map((s) => `${s.subjectId}:${s.termId}`));
    return {
      schoolYear: { id: year.id, name: year.name, status: year.status },
      terms: year.terms.map((t) => ({ id: t.id, number: t.number, name: t.name, status: t.status })),
      subjects: subjects.map((s) => ({
        ...present(s),
        terms: Object.fromEntries(year.terms.map((t) => [t.id, on.has(`${s.id}:${t.id}`)])),
      })),
    };
  }

  async setTermSetting(subjectId: string, termId: string, dto: SetTermSettingDto, actorId: string, meta: ClientMetaData) {
    const [subject, term] = await Promise.all([
      this.prisma.subject.findUnique({ where: { id: subjectId } }),
      this.prisma.academicTerm.findUnique({ where: { id: termId }, include: { schoolYear: true } }),
    ]);
    if (!subject) throw new NotFoundException('Materia no encontrada');
    if (!term) throw new NotFoundException('Momento no encontrado');
    if (term.status === 'CERRADO' || term.schoolYear.status === 'CERRADO')
      throw new ConflictException('El momento está cerrado: su configuración no se puede cambiar');
    const current = await this.prisma.subjectTermSetting.findUnique({ where: { subjectId_termId: { subjectId, termId } } });
    const before = current?.hasLapsoTest ?? false;
    if (before === dto.hasLapsoTest) return { subjectId, termId, hasLapsoTest: before };
    if (!dto.hasLapsoTest && (await this.prisma.evaluation.count({ where: { subjectId, termId, kind: 'LAPSO', voidedAt: null } })))
      throw new ConflictException('Ya existe una prueba de lapso en este momento. Anúlala antes de quitar la configuración');
    await this.prisma.subjectTermSetting.upsert({
      where: { subjectId_termId: { subjectId, termId } },
      create: { subjectId, termId, hasLapsoTest: dto.hasLapsoTest }, update: { hasLapsoTest: dto.hasLapsoTest },
    });
    await this.audit.log({
      userId: actorId, action: 'subject.term_setting', entity: 'Subject', entityId: subjectId,
      metadata: { term: term.name, schoolYear: term.schoolYear.name, changes: { hasLapsoTest: [before, dto.hasLapsoTest] } }, ...meta,
    });
    return { subjectId, termId, hasLapsoTest: dto.hasLapsoTest };
  }
}
