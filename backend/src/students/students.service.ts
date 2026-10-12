import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { isOwnRecordsOnly, studentScope } from '../common/access/access-scope';
import { ClientMetaData } from '../common/decorators';
import { PaginationDto, paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { ymd } from '../common/utils/dates';
import { diffFields } from '../common/utils/diff';
import { AuthUser } from '../common/types/auth-user';
import { ListStudentsDto, UpdateStudentDto } from './dto/students.dto';
import { studentSearch } from './student-search';

const AUDITED_FIELDS = ['firstName', 'lastName', 'identificationType', 'identificationNumber', 'sigesCode', 'email', 'birthDate', 'birthPlace', 'sex', 'address', 'status'];
const REQUIRED_FIELDS = ['firstName', 'lastName', 'birthPlace', 'address'] as const;

const listInclude = {
  photos: { select: { gradeLevelId: true, gradeLevel: { select: { number: true } } } },
  enrollments: {
    where: { status: { not: 'ANULADA' } },
    orderBy: [{ schoolYear: { startDate: 'desc' } }, { createdAt: 'desc' }],
    take: 1,
    include: { schoolYear: { select: { id: true, name: true } }, section: { select: { id: true, name: true, gradeLevel: { select: { id: true, number: true, name: true } } } } },
  },
} satisfies Prisma.StudentInclude;

type ListRow = Prisma.StudentGetPayload<{ include: typeof listInclude }>;

/** Foto "actual" = la del grado más alto disponible. */
const currentPhoto = (photos: ListRow['photos']) =>
  photos.length ? photos.reduce((a, b) => (b.gradeLevel.number > a.gradeLevel.number ? b : a)).gradeLevelId : null;

const presentListRow = (s: ListRow) => {
  const last = s.enrollments[0];
  return {
    id: s.id, firstName: s.firstName, lastName: s.lastName,
    identificationType: s.identificationType, identificationNumber: s.identificationNumber,
    sigesCode: s.sigesCode, email: s.email, status: s.status, sex: s.sex, birthDate: ymd(s.birthDate),
    currentPhotoGradeLevelId: currentPhoto(s.photos),
    lastEnrollment: last ? {
      id: last.id, status: last.status, schoolYear: last.schoolYear, section: { id: last.section.id, name: last.section.name }, gradeLevel: last.section.gradeLevel,
    } : null,
  };
};

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(q: ListStudentsDto, user: AuthUser) {
    const enrollmentFilter: Prisma.EnrollmentWhereInput = {
      status: { in: ['PENDIENTE', 'ACTIVA'] },
      schoolYearId: q.schoolYearId,
      sectionId: q.sectionId,
      ...(q.gradeLevelId ? { section: { gradeLevelId: q.gradeLevelId } } : {}),
    };
    const byEnrollment = q.schoolYearId || q.gradeLevelId || q.sectionId;
    const where: Prisma.StudentWhereInput = {
      AND: [studentScope(user), ...studentSearch(q.search), ...(byEnrollment ? [{ enrollments: { some: enrollmentFilter } }] : [])],
      status: q.status,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({ where, include: listInclude, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit }),
      this.prisma.student.count({ where }),
    ]);
    return paginated(rows.map(presentListRow), total, q);
  }

  /** Busca respetando el alcance del usuario (los roles de familia solo ven lo suyo). */
  private async findScoped(id: string, user: AuthUser) {
    const student = await this.prisma.student.findFirst({ where: { AND: [{ id }, studentScope(user)] }, select: { id: true } });
    if (!student) throw new NotFoundException('Alumno no encontrado');
  }

  async get(id: string, user: AuthUser) {
    const student = await this.prisma.student.findFirst({
      where: { AND: [{ id }, studentScope(user)] },
      include: {
        representatives: { include: { representative: { select: { id: true, firstName: true, lastName: true, documentId: true, phone: true, isActive: true } } }, orderBy: { createdAt: 'asc' } },
        photos: { include: { gradeLevel: { select: { id: true, number: true, name: true } }, schoolYear: { select: { id: true, name: true } } }, orderBy: { gradeLevel: { number: 'asc' } } },
        enrollments: {
          orderBy: [{ schoolYear: { startDate: 'desc' } }, { createdAt: 'desc' }],
          include: { schoolYear: { select: { id: true, name: true } }, section: { select: { id: true, name: true, gradeLevel: { select: { id: true, number: true, name: true } } } } },
        },
      },
    });
    if (!student) throw new NotFoundException('Alumno no encontrado');
    const { photos, enrollments, representatives, ...rest } = student;
    return {
      ...rest, birthDate: ymd(student.birthDate),
      currentPhotoGradeLevelId: currentPhoto(photos),
      photos: photos.map((p) => ({ gradeLevel: p.gradeLevel, schoolYear: p.schoolYear, updatedAt: p.updatedAt })),
      representatives: representatives.map((r) => ({ relationship: r.relationship, relationshipDetail: r.relationshipDetail, ...r.representative })),
      enrollments: enrollments.map((e) => ({
        id: e.id, status: e.status, receiptNumber: e.receiptNumber, enrollmentDate: ymd(e.enrollmentDate),
        condition: e.condition, schoolYear: e.schoolYear, section: { id: e.section.id, name: e.section.name }, gradeLevel: e.section.gradeLevel,
      })),
    };
  }

  async update(id: string, dto: UpdateStudentDto, actorId: string, meta: ClientMetaData) {
    const before = await this.prisma.student.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Alumno no encontrado');
    for (const f of REQUIRED_FIELDS) if (dto[f] === null) throw new BadRequestException(`El campo ${f} no puede quedar vacío`);

    const type = dto.identificationType ?? before.identificationType;
    const number = dto.identificationNumber ?? before.identificationNumber;
    if (type !== before.identificationType || number !== before.identificationNumber) {
      const dup = await this.prisma.student.findFirst({ where: { identificationType: type, identificationNumber: number, id: { not: id } }, select: { firstName: true, lastName: true } });
      if (dup) throw new ConflictException(`Ya existe un alumno con esa identificación (${dup.firstName} ${dup.lastName})`);
    }
    if (dto.sigesCode) {
      const dup = await this.prisma.student.findFirst({ where: { sigesCode: dto.sigesCode, id: { not: id } }, select: { firstName: true, lastName: true } });
      if (dup) throw new ConflictException(`El código SIGES ya pertenece a ${dup.firstName} ${dup.lastName}`);
    }
    if (dto.birthDate && dto.birthDate > new Date()) throw new BadRequestException('La fecha de nacimiento no puede ser futura');
    if (dto.status && dto.status !== 'ACTIVO' && before.status === 'ACTIVO') {
      const open = await this.prisma.enrollment.count({ where: { studentId: id, status: { in: ['PENDIENTE', 'ACTIVA'] } } });
      if (open > 0) throw new ConflictException('El alumno tiene inscripciones PENDIENTE/ACTIVA: retíralas o anúlalas antes de cambiar su estado');
    }

    const after = await this.prisma.student.update({
      where: { id },
      data: {
        firstName: dto.firstName ?? undefined, lastName: dto.lastName ?? undefined,
        identificationType: dto.identificationType, identificationNumber: dto.identificationNumber,
        sigesCode: dto.sigesCode, email: dto.email, birthDate: dto.birthDate, birthPlace: dto.birthPlace ?? undefined,
        sex: dto.sex, address: dto.address ?? undefined, status: dto.status,
      },
    });
    const changes = diffFields(before, after, AUDITED_FIELDS);
    if (Object.keys(changes).length) await this.audit.log({ userId: actorId, action: 'student.update', entity: 'Student', entityId: id, metadata: { changes }, ...meta });
    return { ...after, birthDate: ymd(after.birthDate) };
  }

  /** Quién cambió qué: auditoría del alumno y de sus inscripciones. Solo personal (no roles de familia). */
  async history(id: string, q: PaginationDto, user: AuthUser) {
    if (isOwnRecordsOnly(user)) throw new ForbiddenException('No tienes permiso para ver el historial de cambios');
    const exists = await this.prisma.student.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Alumno no encontrado');
    const enrollmentIds = (await this.prisma.enrollment.findMany({ where: { studentId: id }, select: { id: true } })).map((e) => e.id);
    const where: Prisma.AuditLogWhereInput = {
      OR: [{ entity: 'Student', entityId: id }, { entity: 'Enrollment', entityId: { in: enrollmentIds } }],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit,
        select: { id: true, action: true, entity: true, entityId: true, metadata: true, createdAt: true, user: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(rows, total, q);
  }

  async assertVisible(id: string, user: AuthUser) { await this.findScoped(id, user); }
}
