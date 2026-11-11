import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isOwnRecordsOnly, studentScope } from '../common/access/access-scope';
import { paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { normalizeIdentification, tokens } from '../common/utils/normalize';
import { ListReportCardsDto } from './dto/report-cards.dto';
import { ResultsService } from './results.service';

const studentSelect = { id: true, firstName: true, lastName: true, identificationType: true, identificationNumber: true } as const;

/**
 * Boletín = resultados reales (calculados al consultar) de una inscripción. Quién lo ve:
 *  · Familia (representante / estudiante): solo el de sus alumnos (studentScope).
 *  · Personal con `report.view` (dirección, administración): cualquiera.
 *  · Un docente NO ve boletines completos: ve las planillas de sus materias (un boletín incluye materias de otros docentes).
 */
@Injectable()
export class ReportCardsService {
  constructor(private prisma: PrismaService, private results: ResultsService) {}

  private visibility(user: AuthUser): Prisma.EnrollmentWhereInput {
    if (isOwnRecordsOnly(user)) return { student: studentScope(user) };
    if (user.permissions.includes('report.view')) return {};
    throw new ForbiddenException('No tienes acceso a los boletines');
  }

  private async resolveYearId(schoolYearId?: string) {
    if (schoolYearId) return schoolYearId;
    const year = (await this.prisma.schoolYear.findFirst({ where: { status: 'ACTIVO' }, select: { id: true } }))
      ?? (await this.prisma.schoolYear.findFirst({ orderBy: { startDate: 'desc' }, select: { id: true } }));
    return year?.id ?? null;
  }

  async list(q: ListReportCardsDto, user: AuthUser) {
    const visible = this.visibility(user);
    const schoolYearId = await this.resolveYearId(q.schoolYearId);
    const words = q.search ? tokens(q.search) : [];
    const where: Prisma.EnrollmentWhereInput = {
      AND: [
        visible,
        { status: { not: 'ANULADA' }, schoolYearId: schoolYearId ?? '00000000-0000-0000-0000-000000000000', sectionId: q.sectionId, ...(q.gradeLevelId ? { section: { gradeLevelId: q.gradeLevelId } } : {}) },
        ...words.map((t) => ({
          student: { OR: [
            { firstName: { contains: t, mode: 'insensitive' as const } }, { lastName: { contains: t, mode: 'insensitive' as const } },
            { identificationNumber: { contains: normalizeIdentification(t) } },
          ] },
        })),
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where, skip: (q.page - 1) * q.limit, take: q.limit,
        orderBy: [{ section: { gradeLevel: { number: 'asc' } } }, { section: { name: 'asc' } }, { student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
        select: { id: true, status: true, student: { select: studentSelect }, section: { select: { id: true, name: true, gradeLevel: { select: { id: true, number: true, name: true } } } }, schoolYear: { select: { id: true, name: true, status: true } } },
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    return { ...paginated(rows, total, q), schoolYearId };
  }

  async get(enrollmentId: string, user: AuthUser) {
    const visible = this.visibility(user);
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { AND: [visible, { id: enrollmentId, status: { not: 'ANULADA' } }] },
      select: {
        id: true, status: true, schoolYearId: true, sectionId: true,
        student: { select: studentSelect },
        schoolYear: { select: { id: true, name: true, status: true } },
        section: { select: { id: true, name: true, gradeLevel: { select: { id: true, number: true, name: true, subjects: { select: { subject: { select: { id: true, name: true, isActive: true } } } } } } } },
      },
    });
    if (!enrollment) throw new NotFoundException('Boletín no encontrado');

    const set = await this.results.load(enrollment.schoolYearId, enrollment.sectionId, { enrollmentIds: [enrollment.id] });
    const subjectMap = new Map<string, { id: string; name: string }>();
    enrollment.section.gradeLevel.subjects.filter((x) => x.subject.isActive).forEach((x) => subjectMap.set(x.subject.id, x.subject));
    // Una materia con evaluaciones en la sección también cuenta aunque se haya quitado después del plan de estudio.
    const extraIds = [...new Set(set.evaluations.filter((e) => !e.voidedAt).map((e) => e.subjectId))].filter((id) => !subjectMap.has(id));
    if (extraIds.length) (await this.prisma.subject.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true } })).forEach((s) => subjectMap.set(s.id, s));

    const teachers = await this.prisma.teachingAssignment.findMany({
      where: { schoolYearId: enrollment.schoolYearId, sectionId: enrollment.sectionId, endedAt: null },
      select: { subjectId: true, teacher: { select: { firstName: true, lastName: true } } },
    });
    const teacherOf = new Map(teachers.map((t) => [t.subjectId, `${t.teacher.firstName} ${t.teacher.lastName}`]));

    const subjects = [...subjectMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((s) => {
      const r = set.subject(enrollment.id, s.id);
      return {
        subject: s, teacher: teacherOf.get(s.id) ?? null,
        terms: Object.fromEntries(Object.entries(r.terms).map(([termId, cell]) => [termId, cell.result])),
        annual: r.annual,
      };
    });
    const annual = subjects.map((s) => s.annual);
    return {
      id: enrollment.id, enrollmentStatus: enrollment.status, student: enrollment.student, schoolYear: enrollment.schoolYear,
      section: { id: enrollment.section.id, name: enrollment.section.name, gradeLevel: { id: enrollment.section.gradeLevel.id, number: enrollment.section.gradeLevel.number, name: enrollment.section.gradeLevel.name } },
      terms: set.terms, subjects,
      summary: {
        subjects: subjects.length,
        withAnnualScore: annual.filter((a) => a.score !== null).length,
        approved: annual.filter((a) => a.passed === true).length,
        failed: annual.filter((a) => a.passed === false).length,
        withoutAnnualScore: annual.filter((a) => a.score === null).length,
        provisional: annual.filter((a) => a.status === 'PROVISIONAL').length,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
