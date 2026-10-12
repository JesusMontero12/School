import { Injectable } from '@nestjs/common';
import { Prisma, SchoolYearStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

const withTerms = { terms: { orderBy: { number: 'asc' } } } satisfies Prisma.SchoolYearInclude;

@Injectable()
export class SchoolYearsRepository {
  constructor(private prisma: PrismaService) {}

  findById(id: string) { return this.prisma.schoolYear.findUnique({ where: { id }, include: withTerms }); }
  findByName(name: string) { return this.prisma.schoolYear.findUnique({ where: { name } }); }
  findOtherActive(excludeId: string) {
    return this.prisma.schoolYear.findFirst({ where: { status: SchoolYearStatus.ACTIVO, id: { not: excludeId } }, select: { id: true, name: true } });
  }

  list(where: Prisma.SchoolYearWhereInput, skip: number, take: number) {
    return this.prisma.$transaction([
      this.prisma.schoolYear.findMany({ where, include: withTerms, orderBy: { startDate: 'desc' }, skip, take }),
      this.prisma.schoolYear.count({ where }),
    ]);
  }

  options() {
    return this.prisma.schoolYear.findMany({ select: { id: true, name: true, status: true, startDate: true, endDate: true }, orderBy: { startDate: 'desc' } });
  }

  /** Conteo de inscripciones por estado de un año (para el detalle). */
  enrollmentCounts(schoolYearId: string) {
    return this.prisma.enrollment.groupBy({ by: ['status'], where: { schoolYearId }, _count: { _all: true } });
  }

  latestEnrollmentDate(schoolYearId: string) {
    return this.prisma.enrollment.aggregate({ where: { schoolYearId }, _max: { enrollmentDate: true } });
  }
}
