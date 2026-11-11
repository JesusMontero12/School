import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isOwnRecordsOnly } from '../common/access/access-scope';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { OCCUPYING_STATUSES } from '../sections/sections.service';
import { ReportFiltersDto } from './dto/reports.dto';
import { ResultSet, ResultsService } from './results.service';

type Period = { termId: string | null };
type Cell = { score: number | null; status: string; passed: boolean | null; missing: string | null; pending: number };

interface SectionData {
  section: { id: string; name: string; gradeLevel: { id: string; number: number; name: string } };
  set: ResultSet;
  subjects: { id: string; name: string }[];
  teachers: Map<string, string>;
  enrollments: { id: string; status: string; student: { id: string; firstName: string; lastName: string; identificationType: string; identificationNumber: string } }[];
}

/** Reportes académicos: siempre calculados al consultar con las notas reales (sin cifras guardadas aparte). */
@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private results: ResultsService) {}

  private assertStaff(user: AuthUser) {
    if (isOwnRecordsOnly(user)) throw new ForbiddenException('No tienes acceso a los reportes');
  }

  private async resolveYear(schoolYearId?: string) {
    const year = schoolYearId
      ? await this.prisma.schoolYear.findUnique({ where: { id: schoolYearId }, select: { id: true, name: true, status: true } })
      : (await this.prisma.schoolYear.findFirst({ where: { status: 'ACTIVO' }, select: { id: true, name: true, status: true } }))
        ?? (await this.prisma.schoolYear.findFirst({ orderBy: { startDate: 'desc' }, select: { id: true, name: true, status: true } }));
    if (!year) throw new NotFoundException(schoolYearId ? 'Año escolar no encontrado' : 'Aún no hay años escolares');
    return year;
  }

  /** Carga, por cada sección del filtro, los resultados de todos sus alumnos y materias. */
  private async collect(f: ReportFiltersDto) {
    const year = await this.resolveYear(f.schoolYearId);
    const terms = await this.results.termsOf(year.id);
    if (f.termId && !terms.some((t) => t.id === f.termId)) throw new BadRequestException('El momento no pertenece al año escolar indicado');
    const period: Period = { termId: f.termId ?? null };

    const sections = await this.prisma.section.findMany({
      where: { id: f.sectionId, gradeLevelId: f.gradeLevelId, OR: [{ isActive: true }, { enrollments: { some: { schoolYearId: year.id } } }] },
      select: { id: true, name: true, gradeLevel: { select: { id: true, number: true, name: true, subjects: { select: { subject: { select: { id: true, name: true, isActive: true } } } } } } },
      orderBy: [{ gradeLevel: { number: 'asc' } }, { name: 'asc' }],
    });
    const data: SectionData[] = [];
    for (const s of sections) {
      const [set, enrollments, assignments] = await Promise.all([
        this.results.load(year.id, s.id),
        this.prisma.enrollment.findMany({
          where: { schoolYearId: year.id, sectionId: s.id, status: { in: ['PENDIENTE', 'ACTIVA', 'RETIRADA'] } },
          select: { id: true, status: true, student: { select: { id: true, firstName: true, lastName: true, identificationType: true, identificationNumber: true } } },
          orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
        }),
        this.prisma.teachingAssignment.findMany({ where: { schoolYearId: year.id, sectionId: s.id, endedAt: null }, select: { subjectId: true, teacher: { select: { firstName: true, lastName: true } } } }),
      ]);
      const ids = new Map<string, { id: string; name: string }>();
      s.gradeLevel.subjects.filter((x) => x.subject.isActive).forEach((x) => ids.set(x.subject.id, x.subject));
      const extra = [...new Set(set.evaluations.filter((e) => !e.voidedAt).map((e) => e.subjectId))].filter((id) => !ids.has(id));
      if (extra.length) (await this.prisma.subject.findMany({ where: { id: { in: extra } }, select: { id: true, name: true } })).forEach((x) => ids.set(x.id, x));
      const subjects = [...ids.values()].filter((x) => !f.subjectId || x.id === f.subjectId).sort((a, b) => a.name.localeCompare(b.name, 'es'));
      // Un retirado solo cuenta si ya tiene alguna nota: no se le exige lo que no cursó.
      const occupying = new Set<string>(OCCUPYING_STATUSES);
      const kept = enrollments.filter((e) => occupying.has(e.status) || subjects.some((sub) => set.subject(e.id, sub.id).annual.score !== null || terms.some((t) => set.term(e.id, sub.id, t.id).result.score !== null)));
      data.push({
        section: { id: s.id, name: s.name, gradeLevel: { id: s.gradeLevel.id, number: s.gradeLevel.number, name: s.gradeLevel.name } },
        set, subjects, enrollments: kept, teachers: new Map(assignments.map((a) => [a.subjectId, `${a.teacher.firstName} ${a.teacher.lastName}`])),
      });
    }
    return { year, terms, period, data };
  }

  /** Nota del periodo pedido (un momento o la anual) en forma plana. */
  private cell(d: SectionData, enrollmentId: string, subjectId: string, period: Period): Cell {
    if (period.termId) {
      const r = d.set.term(enrollmentId, subjectId, period.termId).result;
      return { score: r.score, status: r.status, passed: r.passed, missing: r.missing, pending: r.pendingEvaluations };
    }
    const a = d.set.subject(enrollmentId, subjectId).annual;
    return { score: a.score, status: a.status, passed: a.passed, missing: a.missing, pending: 0 };
  }

  private meta(ctx: { year: { id: string; name: string; status: string }; terms: { id: string; name: string }[]; period: Period }) {
    return { schoolYear: ctx.year, term: ctx.terms.find((t) => t.id === ctx.period.termId) ?? null, period: ctx.period.termId ? 'TERM' : 'ANNUAL' };
  }

  /** Rendimiento por materia y sección: cuántos aprueban, reprueban o aún no tienen nota, y el promedio de las notas del periodo. */
  async performance(f: ReportFiltersDto, user: AuthUser) {
    this.assertStaff(user);
    const ctx = await this.collect(f);
    const rows = ctx.data.flatMap((d) => d.subjects.map((sub) => {
      const cells = d.enrollments.map((e) => this.cell(d, e.id, sub.id, ctx.period));
      const scored = cells.filter((c) => c.score !== null);
      const sum = scored.reduce((acc, c) => acc + (c.score as number), 0);
      return {
        section: d.section, subject: sub, teacher: d.teachers.get(sub.id) ?? null,
        students: cells.length, scored: scored.length, approved: cells.filter((c) => c.passed === true).length, failed: cells.filter((c) => c.passed === false).length,
        withoutScore: cells.length - scored.length, provisional: cells.filter((c) => c.status === 'PROVISIONAL').length,
        average: scored.length ? Math.round((sum / scored.length) * 100) / 100 : null,
      };
    }));
    const totals = rows.reduce((t, r) => ({ scored: t.scored + r.scored, approved: t.approved + r.approved, failed: t.failed + r.failed, withoutScore: t.withoutScore + r.withoutScore }), { scored: 0, approved: 0, failed: 0, withoutScore: 0 });
    return { ...this.meta(ctx), rows, totals };
  }

  /** Rendimiento por alumno: su nota del periodo en cada materia de la sección (la sección es obligatoria). */
  async students(f: ReportFiltersDto, user: AuthUser) {
    this.assertStaff(user);
    if (!f.sectionId) throw new BadRequestException('Elige una sección');
    const ctx = await this.collect(f);
    const d = ctx.data[0];
    if (!d) throw new NotFoundException('Sección no encontrada');
    return {
      ...this.meta(ctx), section: d.section, subjects: d.subjects,
      rows: d.enrollments.map((e) => {
        const cells = d.subjects.map((sub) => ({ subjectId: sub.id, ...this.cell(d, e.id, sub.id, ctx.period) }));
        return {
          enrollmentId: e.id, enrollmentStatus: e.status, student: e.student, cells,
          approved: cells.filter((c) => c.passed === true).length, failed: cells.filter((c) => c.passed === false).length, withoutScore: cells.filter((c) => c.score === null).length,
        };
      }),
    };
  }

  /**
   * Alumnos con pendientes académicos. Se consideran pendientes:
   *  · evaluaciones creadas que el alumno aún no tiene calificadas (en momentos ACTIVO o CERRADO);
   *  · en un momento CERRADO, una materia sin nota del momento;
   *  · una prueba de lapso configurada que todavía no se ha creado o calificado.
   */
  async pending(f: ReportFiltersDto, user: AuthUser) {
    this.assertStaff(user);
    const ctx = await this.collect(f);
    const terms = ctx.terms.filter((t) => (f.termId ? t.id === f.termId : true) && t.status !== 'PENDIENTE');
    const rows = ctx.data.flatMap((d) => d.enrollments.map((e) => {
      const items = d.subjects.flatMap((sub) => terms.flatMap((t) => {
        const r = d.set.term(e.id, sub.id, t.id).result;
        const out: { subject: { id: string; name: string }; term: { id: string; name: string }; pendingEvaluations: number; reason: string }[] = [];
        if (r.pendingEvaluations > 0) out.push({ subject: sub, term: { id: t.id, name: t.name }, pendingEvaluations: r.pendingEvaluations, reason: r.missing === 'FALTA_PRUEBA_DE_LAPSO' ? 'Prueba de lapso sin calificar' : 'Evaluaciones sin calificar' });
        else if (r.missing === 'FALTA_PRUEBA_DE_LAPSO') out.push({ subject: sub, term: { id: t.id, name: t.name }, pendingEvaluations: 0, reason: 'Falta la prueba de lapso' });
        else if (t.status === 'CERRADO' && r.score === null) out.push({ subject: sub, term: { id: t.id, name: t.name }, pendingEvaluations: 0, reason: 'Sin nota del momento' });
        return out;
      }));
      return { enrollmentId: e.id, student: e.student, section: d.section, items };
    }).filter((r) => r.items.length > 0));
    return { ...this.meta(ctx), rows };
  }
}
