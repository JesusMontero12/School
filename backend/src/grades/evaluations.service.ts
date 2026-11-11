import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { isOwnRecordsOnly } from '../common/access/access-scope';
import { ClientMetaData } from '../common/decorators';
import { paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { ymd } from '../common/utils/dates';
import { diffFields } from '../common/utils/diff';
import { OCCUPYING_STATUSES } from '../sections/sections.service';
import { TeachingAccessService } from '../teaching-assignments/teaching-access.service';
import { CreateEvaluationDto, GradeSheetDto, ListEvaluationsDto, SaveScoresDto, UpdateEvaluationDto, VoidEvaluationDto } from './dto/grades.dto';
import { ResultsService, TermCell } from './results.service';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';
type Term = { id: string; name: string; status: 'PENDIENTE' | 'ACTIVO' | 'CERRADO'; startDate: Date; endDate: Date; schoolYearId: string };

@Injectable()
export class EvaluationsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private access: TeachingAccessService, private results: ResultsService) {}

  /** Las notas de otros alumnos no son para las familias: sus endpoints son los boletines. */
  private assertStaff(user: AuthUser) {
    if (isOwnRecordsOnly(user)) throw new ForbiddenException('Tu cuenta consulta las notas desde el boletín');
  }

  /**
   * Regla de escritura según el estado del momento:
   *  · ACTIVO → se puede registrar y editar.
   *  · PENDIENTE → aún no inicia.
   *  · CERRADO → solo con permiso `grade.approve` y con motivo; el cambio queda auditado como corrección.
   * Devuelve true si es una corrección de momento cerrado.
   */
  private assertWritable(term: Term, user: AuthUser, reason?: string): boolean {
    if (term.status === 'ACTIVO') return false;
    if (term.status === 'PENDIENTE') throw new ConflictException(`El ${term.name} aún no ha iniciado: no admite evaluaciones ni notas`);
    if (!user.permissions.includes('grade.approve')) throw new ForbiddenException(`El ${term.name} está cerrado: solo quien tiene permiso para aprobar notas puede corregirlo`);
    if (!reason) throw new BadRequestException('Indica el motivo de la corrección (el momento está cerrado)');
    return true;
  }

  private assertDateInTerm(term: Term, date: Date) {
    if (date < term.startDate || date > term.endDate)
      throw new BadRequestException(`La fecha debe estar dentro del ${term.name} (${ymd(term.startDate)} a ${ymd(term.endDate)})`);
  }

  private async termOf(termId: string): Promise<Term> {
    const term = await this.prisma.academicTerm.findUnique({ where: { id: termId } });
    if (!term) throw new NotFoundException('Momento no encontrado');
    return term;
  }

  private async resolveYearId(schoolYearId?: string) {
    if (schoolYearId) {
      if (!(await this.prisma.schoolYear.findUnique({ where: { id: schoolYearId }, select: { id: true } }))) throw new NotFoundException('Año escolar no encontrado');
      return schoolYearId;
    }
    const year = (await this.prisma.schoolYear.findFirst({ where: { status: 'ACTIVO' }, select: { id: true } }))
      ?? (await this.prisma.schoolYear.findFirst({ orderBy: { startDate: 'desc' }, select: { id: true } }));
    if (!year) throw new NotFoundException('Aún no hay años escolares');
    return year.id;
  }

  private async duplicates(e: { termId: string; sectionId: string; subjectId: string; name: string; kind: string }, exceptId?: string) {
    const base = { termId: e.termId, sectionId: e.sectionId, subjectId: e.subjectId, voidedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) };
    if (await this.prisma.evaluation.findFirst({ where: { ...base, name: { equals: e.name, mode: 'insensitive' } }, select: { id: true } }))
      throw new ConflictException('Ya existe una evaluación con ese nombre en esta materia y momento');
    if (e.kind === 'LAPSO' && (await this.prisma.evaluation.findFirst({ where: { ...base, kind: 'LAPSO' }, select: { id: true } })))
      throw new ConflictException('Esta materia ya tiene una prueba de lapso en este momento');
  }

  // ───────── Consultas ─────────

  async list(q: ListEvaluationsDto, user: AuthUser) {
    this.assertStaff(user);
    const schoolYearId = await this.resolveYearId(q.schoolYearId);
    const where: Prisma.EvaluationWhereInput = {
      term: { schoolYearId }, termId: q.termId, sectionId: q.sectionId, subjectId: q.subjectId, teacherId: q.teacherId,
      ...(q.includeVoided ? {} : { voidedAt: null }),
    };
    if (!this.access.seesAll(user)) {
      // Un docente ve las evaluaciones de las materias/secciones que tiene asignadas hoy.
      const teacherId = await this.access.teacherIdOf(user);
      const mine = teacherId
        ? await this.prisma.teachingAssignment.findMany({ where: { schoolYearId, teacherId, endedAt: null }, select: { sectionId: true, subjectId: true } })
        : [];
      where.AND = [{ OR: mine.length ? mine.map((m) => ({ sectionId: m.sectionId, subjectId: m.subjectId })) : [{ id: NIL_UUID }] }];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.evaluation.findMany({
        where, orderBy: [{ evaluationDate: 'desc' }, { createdAt: 'desc' }], skip: (q.page - 1) * q.limit, take: q.limit,
        include: {
          term: { select: { id: true, number: true, name: true, status: true } },
          section: { select: { id: true, name: true, gradeLevel: { select: { name: true } } } },
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { scores: true } },
        },
      }),
      this.prisma.evaluation.count({ where }),
    ]);
    return {
      ...paginated(rows.map(({ _count, maxPoints, evaluationDate, ...e }) => ({ ...e, maxPoints: Number(maxPoints.toString()), evaluationDate: ymd(evaluationDate), gradedCount: _count.scores })), total, q),
      schoolYearId,
    };
  }

  /** Planilla de una materia en una sección: evaluaciones, puntos de cada alumno y resultados por momento y anual. */
  async sheet(q: GradeSheetDto, user: AuthUser) {
    this.assertStaff(user);
    const schoolYearId = await this.resolveYearId(q.schoolYearId);
    const [year, section, subject] = await Promise.all([
      this.prisma.schoolYear.findUniqueOrThrow({ where: { id: schoolYearId }, select: { id: true, name: true, status: true } }),
      this.prisma.section.findUnique({ where: { id: q.sectionId }, select: { id: true, name: true, gradeLevel: { select: { id: true, number: true, name: true } } } }),
      this.prisma.subject.findUnique({ where: { id: q.subjectId }, select: { id: true, name: true } }),
    ]);
    if (!section) throw new NotFoundException('Sección no encontrada');
    if (!subject) throw new NotFoundException('Materia no encontrada');
    await this.access.assertTeaches(user, { schoolYearId, sectionId: q.sectionId, subjectId: q.subjectId });

    const [assignment, set, enrollments] = await Promise.all([
      this.prisma.teachingAssignment.findFirst({ where: { schoolYearId, sectionId: q.sectionId, subjectId: q.subjectId, endedAt: null }, select: { teacher: { select: { id: true, firstName: true, lastName: true } } } }),
      this.results.load(schoolYearId, q.sectionId, { subjectIds: [q.subjectId] }),
      this.prisma.enrollment.findMany({
        where: { schoolYearId, sectionId: q.sectionId, status: { in: ['PENDIENTE', 'ACTIVA', 'RETIRADA'] } },
        select: { id: true, status: true, student: { select: { id: true, firstName: true, lastName: true, identificationType: true, identificationNumber: true } } },
        orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      }),
    ]);

    const occupying = new Set<string>(OCCUPYING_STATUSES);
    const rows = enrollments
      .map((e) => ({ enrollment: e, ...set.subject(e.id, q.subjectId) }))
      // Un alumno retirado solo aparece si ya tiene puntos (su historial se conserva, sin poder cargarle más).
      .filter((r) => occupying.has(r.enrollment.status) || (Object.values(r.terms) as TermCell[]).some((c) => Object.values(c.scores).some((p) => p !== null)))
      .map((r) => ({ enrollmentId: r.enrollment.id, status: r.enrollment.status, canGrade: occupying.has(r.enrollment.status), student: r.enrollment.student, terms: r.terms, annual: r.annual }));

    return {
      schoolYear: year, section, subject, teacher: assignment?.teacher ?? null,
      terms: set.terms.map((t) => ({ ...t, hasLapsoTest: set.hasLapsoTest(q.subjectId, t.id), evaluations: set.evaluationsOf(q.subjectId, t.id, true) })),
      rows,
    };
  }

  // ───────── Evaluaciones ─────────

  async create(dto: CreateEvaluationDto, user: AuthUser, meta: ClientMetaData) {
    const term = await this.termOf(dto.termId);
    const closedCorrection = this.assertWritable(term, user, dto.reason);
    this.assertDateInTerm(term, dto.evaluationDate);
    const key = { schoolYearId: term.schoolYearId, sectionId: dto.sectionId, subjectId: dto.subjectId };
    const assignment = await this.prisma.teachingAssignment.findFirst({ where: { ...key, endedAt: null }, select: { teacherId: true } });
    if (!assignment) throw new BadRequestException('Esta materia no tiene docente asignado en la sección. Asígnalo primero en Asignaciones');
    await this.access.assertTeaches(user, key);

    const kind = dto.kind ?? 'CONTINUA';
    if (kind === 'LAPSO' && !(await this.prisma.subjectTermSetting.findFirst({ where: { subjectId: dto.subjectId, termId: dto.termId, hasLapsoTest: true } })))
      throw new BadRequestException('Esta materia no lleva prueba de lapso en este momento. Actívala en Materias → Prueba de lapso');
    await this.duplicates({ ...dto, kind });

    const created = await this.prisma.evaluation.create({
      data: { termId: dto.termId, sectionId: dto.sectionId, subjectId: dto.subjectId, teacherId: assignment.teacherId, name: dto.name, kind, maxPoints: dto.maxPoints, evaluationDate: dto.evaluationDate, createdById: user.id },
    });
    await this.audit.log({
      userId: user.id, action: 'evaluation.create', entity: 'Evaluation', entityId: created.id,
      metadata: { name: created.name, kind, maxPoints: dto.maxPoints, term: term.name, ...(closedCorrection ? { closedTermCorrection: true, reason: dto.reason } : {}) }, ...meta,
    });
    return this.one(created.id);
  }

  private async one(id: string) {
    const e = await this.prisma.evaluation.findUniqueOrThrow({ where: { id } });
    return { ...e, maxPoints: Number(e.maxPoints.toString()), evaluationDate: ymd(e.evaluationDate) };
  }

  private async findForWrite(id: string, user: AuthUser) {
    const evaluation = await this.prisma.evaluation.findUnique({ where: { id }, include: { term: true } });
    if (!evaluation) throw new NotFoundException('Evaluación no encontrada');
    await this.access.assertTeaches(user, { schoolYearId: evaluation.term.schoolYearId, sectionId: evaluation.sectionId, subjectId: evaluation.subjectId });
    return evaluation;
  }

  async update(id: string, dto: UpdateEvaluationDto, user: AuthUser, meta: ClientMetaData) {
    this.assertStaff(user);
    const before = await this.findForWrite(id, user);
    if (before.voidedAt) throw new ConflictException('La evaluación está anulada y no se puede editar');
    const closedCorrection = this.assertWritable(before.term, user, dto.reason);
    if (dto.evaluationDate) this.assertDateInTerm(before.term, dto.evaluationDate);
    if (dto.name && dto.name.toLowerCase() !== before.name.toLowerCase()) await this.duplicates({ ...before, name: dto.name }, id);
    if (dto.maxPoints !== undefined) {
      // Bajar el máximo por debajo de un puntaje ya cargado dejaría una nota imposible.
      const top = await this.prisma.evaluationScore.aggregate({ where: { evaluationId: id }, _max: { points: true } });
      if (top._max.points && Number(top._max.points.toString()) > dto.maxPoints)
        throw new BadRequestException(`Ya hay puntajes cargados de hasta ${top._max.points.toString()}: el máximo no puede ser menor`);
    }
    const { reason, ...data } = dto;
    const after = await this.prisma.evaluation.update({ where: { id }, data });
    await this.audit.log({
      userId: user.id, action: 'evaluation.update', entity: 'Evaluation', entityId: id,
      metadata: { changes: diffFields({ ...before, maxPoints: before.maxPoints.toString() }, { ...after, maxPoints: after.maxPoints.toString() }, ['name', 'maxPoints', 'evaluationDate']), ...(closedCorrection ? { closedTermCorrection: true, reason } : {}) }, ...meta,
    });
    return this.one(id);
  }

  /** La evaluación no se borra: se anula con motivo y deja de contar. Los puntos cargados se conservan como historial. */
  async void(id: string, dto: VoidEvaluationDto, user: AuthUser, meta: ClientMetaData) {
    this.assertStaff(user);
    const before = await this.findForWrite(id, user);
    if (before.voidedAt) throw new ConflictException('La evaluación ya está anulada');
    const closedCorrection = this.assertWritable(before.term, user, dto.reason);
    await this.prisma.evaluation.update({ where: { id }, data: { voidedAt: new Date(), voidReason: dto.reason } });
    await this.audit.log({
      userId: user.id, action: 'evaluation.void', entity: 'Evaluation', entityId: id,
      metadata: { name: before.name, kind: before.kind, reason: dto.reason, ...(closedCorrection ? { closedTermCorrection: true } : {}) }, ...meta,
    });
    return this.one(id);
  }

  // ───────── Calificaciones ─────────

  async saveScores(id: string, dto: SaveScoresDto, user: AuthUser, meta: ClientMetaData) {
    this.assertStaff(user);
    const evaluation = await this.findForWrite(id, user);
    if (evaluation.voidedAt) throw new ConflictException('La evaluación está anulada: no admite calificaciones');
    const closedCorrection = this.assertWritable(evaluation.term, user, dto.reason);
    const max = Number(evaluation.maxPoints.toString());

    const ids = dto.scores.map((s) => s.enrollmentId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Un alumno aparece más de una vez en la planilla');
    const over = dto.scores.find((s) => s.points !== null && s.points > max);
    if (over) throw new BadRequestException(`Los puntos no pueden superar el máximo de la evaluación (${max})`);

    const [enrollments, current] = await Promise.all([
      this.prisma.enrollment.findMany({ where: { id: { in: ids } }, select: { id: true, sectionId: true, schoolYearId: true, status: true } }),
      this.prisma.evaluationScore.findMany({ where: { evaluationId: id, enrollmentId: { in: ids } }, select: { enrollmentId: true, points: true } }),
    ]);
    const byId = new Map(enrollments.map((e) => [e.id, e]));
    const currentBy = new Map(current.map((c) => [c.enrollmentId, Number(c.points.toString())]));
    const occupying = new Set<string>(OCCUPYING_STATUSES);

    const changes: { enrollmentId: string; from: number | null; to: number | null }[] = [];
    for (const s of dto.scores) {
      const enr = byId.get(s.enrollmentId);
      if (!enr || enr.sectionId !== evaluation.sectionId || enr.schoolYearId !== evaluation.term.schoolYearId)
        throw new BadRequestException('Alguno de los alumnos no pertenece a esta sección en este año escolar');
      const from = currentBy.get(s.enrollmentId) ?? null;
      if (from === s.points) continue;
      if (!occupying.has(enr.status)) throw new BadRequestException('No se pueden registrar notas a una inscripción retirada o anulada');
      changes.push({ enrollmentId: s.enrollmentId, from, to: s.points });
    }
    if (changes.length === 0) return { saved: 0 };

    await this.prisma.$transaction([
      ...changes.filter((c) => c.to === null).map((c) => this.prisma.evaluationScore.delete({ where: { evaluationId_enrollmentId: { evaluationId: id, enrollmentId: c.enrollmentId } } })),
      ...changes.filter((c) => c.to !== null).map((c) => this.prisma.evaluationScore.upsert({
        where: { evaluationId_enrollmentId: { evaluationId: id, enrollmentId: c.enrollmentId } },
        create: { evaluationId: id, enrollmentId: c.enrollmentId, points: c.to!, updatedById: user.id },
        update: { points: c.to!, updatedById: user.id },
      })),
    ]);
    await this.audit.log({
      userId: user.id, action: closedCorrection ? 'grade.correction' : 'grade.scores', entity: 'Evaluation', entityId: id,
      metadata: { evaluation: evaluation.name, term: evaluation.term.name, changes, ...(closedCorrection ? { reason: dto.reason } : {}) }, ...meta,
    });
    return { saved: changes.length };
  }
}
