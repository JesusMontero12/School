import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ymd } from '../common/utils/dates';
import { AnnualResult, computeAnnualResult, computeTermResult, TermResult } from './grade-calculator';

export interface TermInfo { id: string; number: number; name: string; status: 'PENDIENTE' | 'ACTIVO' | 'CERRADO'; startDate: string; endDate: string }
export interface EvaluationInfo {
  id: string; termId: string; sectionId: string; subjectId: string; teacherId: string;
  name: string; kind: 'CONTINUA' | 'LAPSO'; maxPoints: number; evaluationDate: string; voidedAt: string | null; voidReason: string | null;
}
export interface TermCell { scores: Record<string, number | null>; result: TermResult }

/**
 * Resultados ya calculados de una sección y año. Nada se guarda: cada consulta calcula con las
 * evaluaciones y puntos actuales, así una corrección se refleja de inmediato en sheet, boletín y reportes.
 */
export class ResultSet {
  constructor(
    readonly terms: TermInfo[],
    readonly evaluations: EvaluationInfo[],
    private scores: Map<string, number>, // `${evaluationId}:${enrollmentId}` → puntos
    private lapsoOn: Set<string>, // `${subjectId}:${termId}`
  ) {}

  hasLapsoTest(subjectId: string, termId: string) { return this.lapsoOn.has(`${subjectId}:${termId}`); }

  evaluationsOf(subjectId: string, termId: string, includeVoided = false) {
    return this.evaluations.filter((e) => e.subjectId === subjectId && e.termId === termId && (includeVoided || !e.voidedAt));
  }

  term(enrollmentId: string, subjectId: string, termId: string): TermCell {
    const term = this.terms.find((t) => t.id === termId)!;
    const evals = this.evaluationsOf(subjectId, termId);
    const points = (e: EvaluationInfo) => this.scores.get(`${e.id}:${enrollmentId}`) ?? null;
    const lapso = evals.find((e) => e.kind === 'LAPSO');
    return {
      scores: Object.fromEntries(evals.map((e) => [e.id, points(e)])),
      result: computeTermResult({
        continuous: evals.filter((e) => e.kind === 'CONTINUA').map((e) => ({ max: e.maxPoints, points: points(e) })),
        lapso: lapso ? { max: lapso.maxPoints, points: points(lapso) } : null,
        hasLapsoTest: this.hasLapsoTest(subjectId, termId),
        closed: term.status === 'CERRADO',
      }),
    };
  }

  /** Los tres momentos + la nota anual de una materia para una inscripción. */
  subject(enrollmentId: string, subjectId: string): { terms: Record<string, TermCell>; annual: AnnualResult } {
    const cells = this.terms.map((t) => [t.id, this.term(enrollmentId, subjectId, t.id)] as const);
    return { terms: Object.fromEntries(cells), annual: computeAnnualResult(cells.map(([, c]) => c.result)) };
  }
}

const toInfo = (e: {
  id: string; termId: string; sectionId: string; subjectId: string; teacherId: string; name: string; kind: 'CONTINUA' | 'LAPSO';
  maxPoints: { toString(): string }; evaluationDate: Date; voidedAt: Date | null; voidReason: string | null;
}): EvaluationInfo => ({
  id: e.id, termId: e.termId, sectionId: e.sectionId, subjectId: e.subjectId, teacherId: e.teacherId, name: e.name, kind: e.kind,
  maxPoints: Number(e.maxPoints.toString()), evaluationDate: ymd(e.evaluationDate), voidedAt: e.voidedAt?.toISOString() ?? null, voidReason: e.voidReason,
});

@Injectable()
export class ResultsService {
  constructor(private prisma: PrismaService) {}

  async termsOf(schoolYearId: string): Promise<TermInfo[]> {
    const rows = await this.prisma.academicTerm.findMany({ where: { schoolYearId }, orderBy: { number: 'asc' } });
    return rows.map((t) => ({ id: t.id, number: t.number, name: t.name, status: t.status, startDate: ymd(t.startDate), endDate: ymd(t.endDate) }));
  }

  /**
   * Carga evaluaciones (incluidas las anuladas, que se marcan), puntos y configuración de lapso de un año.
   * `subjectIds` / `enrollmentIds` acotan la consulta; sin ellos trae toda la sección.
   */
  async load(schoolYearId: string, sectionId: string, opts: { subjectIds?: string[]; enrollmentIds?: string[] } = {}): Promise<ResultSet> {
    const terms = await this.termsOf(schoolYearId);
    if (terms.length === 0) throw new NotFoundException('El año escolar no tiene momentos');
    const termIds = terms.map((t) => t.id);
    const evalRows = await this.prisma.evaluation.findMany({
      where: { termId: { in: termIds }, sectionId, ...(opts.subjectIds ? { subjectId: { in: opts.subjectIds } } : {}) },
      orderBy: [{ evaluationDate: 'asc' }, { createdAt: 'asc' }],
    });
    const [scoreRows, settings] = await Promise.all([
      this.prisma.evaluationScore.findMany({
        where: { evaluationId: { in: evalRows.map((e) => e.id) }, ...(opts.enrollmentIds ? { enrollmentId: { in: opts.enrollmentIds } } : {}) },
        select: { evaluationId: true, enrollmentId: true, points: true },
      }),
      this.prisma.subjectTermSetting.findMany({ where: { termId: { in: termIds }, hasLapsoTest: true }, select: { subjectId: true, termId: true } }),
    ]);
    return new ResultSet(
      terms, evalRows.map(toInfo),
      new Map(scoreRows.map((s) => [`${s.evaluationId}:${s.enrollmentId}`, Number(s.points.toString())])),
      new Set(settings.map((s) => `${s.subjectId}:${s.termId}`)),
    );
  }
}
