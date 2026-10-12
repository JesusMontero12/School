import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SchoolYearStatus, TermStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ClientMetaData } from '../common/decorators';
import { paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { diffFields } from '../common/utils/diff';
import { ymd } from '../common/utils/dates';
import {
  ChangeSchoolYearStatusDto, ChangeTermStatusDto, CreateSchoolYearDto, ListSchoolYearsDto, TermDatesDto, UpdateSchoolYearDto,
} from './dto/school-years.dto';
import { SchoolYearsRepository } from './school-years.repository';

export const TERM_NAMES = ['Primer Momento Pedagógico', 'Segundo Momento Pedagógico', 'Tercer Momento Pedagógico'];

const YEAR_TRANSITIONS: Record<SchoolYearStatus, SchoolYearStatus[]> = {
  PLANIFICADO: ['ACTIVO'],
  ACTIVO: ['CERRADO'],
  CERRADO: [],
};
const TERM_TRANSITIONS: Record<TermStatus, TermStatus[]> = {
  PENDIENTE: ['ACTIVO'],
  ACTIVO: ['CERRADO'],
  CERRADO: [],
};

type YearRow = NonNullable<Awaited<ReturnType<SchoolYearsRepository['findById']>>>;
export const presentSchoolYear = (y: YearRow) => ({
  id: y.id, name: y.name, status: y.status, startDate: ymd(y.startDate), endDate: ymd(y.endDate),
  terms: y.terms.map((t) => ({ id: t.id, number: t.number, name: t.name, status: t.status, startDate: ymd(t.startDate), endDate: ymd(t.endDate) })),
});

/** Bloquea la fila del año hasta el fin de la transacción (evita cerrar un año mientras se inscribe). */
export const lockYearForUpdate = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT id FROM school_years WHERE id = ${id} FOR UPDATE`;

@Injectable()
export class SchoolYearsService {
  constructor(private repo: SchoolYearsRepository, private prisma: PrismaService, private audit: AuditService) {}

  options() {
    return this.repo.options().then((rows) => rows.map((y) => ({ ...y, startDate: ymd(y.startDate), endDate: ymd(y.endDate) })));
  }

  async list(q: ListSchoolYearsDto) {
    const where: Prisma.SchoolYearWhereInput = q.status ? { status: q.status } : {};
    const [rows, total] = await this.repo.list(where, (q.page - 1) * q.limit, q.limit);
    return paginated(rows.map(presentSchoolYear), total, q);
  }

  async get(id: string) {
    const year = await this.repo.findById(id);
    if (!year) throw new NotFoundException('Año escolar no encontrado');
    const counts = await this.repo.enrollmentCounts(id);
    const enrollments = { PENDIENTE: 0, ACTIVA: 0, RETIRADA: 0, ANULADA: 0 };
    for (const c of counts) enrollments[c.status] = c._count._all;
    return { ...presentSchoolYear(year), enrollments };
  }

  /** Reglas de fechas: orden, límites del año y momentos consecutivos sin solaparse. */
  private validateDates(name: string, startDate: Date, endDate: Date, terms: TermDatesDto[]) {
    const [first, second] = name.split('-').map(Number);
    if (second !== first + 1) throw new BadRequestException('El nombre del año escolar debe ser consecutivo (ej. 2026-2027)');
    if (startDate >= endDate) throw new BadRequestException('La fecha de inicio del año debe ser anterior a la de fin');
    terms.forEach((t, i) => {
      const label = TERM_NAMES[i];
      if (t.startDate >= t.endDate) throw new BadRequestException(`${label}: la fecha de inicio debe ser anterior a la de fin`);
      if (t.startDate < startDate || t.endDate > endDate) throw new BadRequestException(`${label}: debe estar dentro de las fechas del año escolar`);
      if (i > 0 && t.startDate <= terms[i - 1].endDate) throw new BadRequestException(`${label}: no puede iniciar antes de que termine el momento anterior`);
    });
  }

  async create(dto: CreateSchoolYearDto, actorId: string, meta: ClientMetaData) {
    if (await this.repo.findByName(dto.name)) throw new ConflictException('Ya existe un año escolar con ese nombre');
    this.validateDates(dto.name, dto.startDate, dto.endDate, dto.terms);
    const year = await this.prisma.schoolYear.create({
      data: {
        name: dto.name, startDate: dto.startDate, endDate: dto.endDate,
        terms: { create: dto.terms.map((t, i) => ({ number: i + 1, name: TERM_NAMES[i], startDate: t.startDate, endDate: t.endDate })) },
      },
      include: { terms: { orderBy: { number: 'asc' } } },
    });
    await this.audit.log({ userId: actorId, action: 'school_year.create', entity: 'SchoolYear', entityId: year.id, metadata: { name: year.name }, ...meta });
    return presentSchoolYear(year);
  }

  async update(id: string, dto: UpdateSchoolYearDto, actorId: string, meta: ClientMetaData) {
    const year = await this.repo.findById(id);
    if (!year) throw new NotFoundException('Año escolar no encontrado');
    if (year.status === SchoolYearStatus.CERRADO) throw new ConflictException('Un año escolar cerrado no se puede modificar');

    const name = dto.name ?? year.name;
    const startDate = dto.startDate ?? year.startDate;
    const endDate = dto.endDate ?? year.endDate;
    const terms: TermDatesDto[] = dto.terms ?? year.terms.map((t) => ({ startDate: t.startDate, endDate: t.endDate }));
    this.validateDates(name, startDate, endDate, terms);

    if (dto.name && dto.name !== year.name && (await this.repo.findByName(dto.name))) throw new ConflictException('Ya existe un año escolar con ese nombre');
    const latest = (await this.repo.latestEnrollmentDate(id))._max.enrollmentDate;
    if (latest && endDate < latest) throw new ConflictException(`La fecha de fin no puede ser anterior a la última inscripción registrada (${ymd(latest)})`);
    if (dto.terms) {
      // Un momento ya cerrado conserva sus fechas.
      for (const t of year.terms) {
        const next = dto.terms[t.number - 1];
        if (t.status === TermStatus.CERRADO && (next.startDate.getTime() !== t.startDate.getTime() || next.endDate.getTime() !== t.endDate.getTime()))
          throw new ConflictException(`${t.name} ya está cerrado: no se pueden cambiar sus fechas`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.schoolYear.update({ where: { id }, data: { name, startDate, endDate } });
      if (dto.terms) {
        for (const t of year.terms) {
          const next = dto.terms[t.number - 1];
          await tx.academicTerm.update({ where: { id: t.id }, data: { startDate: next.startDate, endDate: next.endDate } });
        }
      }
    });
    const updated = (await this.repo.findById(id))!;
    const changes = {
      ...diffFields(year, updated, ['name', 'startDate', 'endDate']),
      ...Object.fromEntries(year.terms.flatMap((t, i) => Object.entries(diffFields(t, updated.terms[i], ['startDate', 'endDate'])).map(([k, v]) => [`term${t.number}.${k}`, v]))),
    };
    await this.audit.log({ userId: actorId, action: 'school_year.update', entity: 'SchoolYear', entityId: id, metadata: { changes }, ...meta });
    return presentSchoolYear(updated);
  }

  async changeStatus(id: string, dto: ChangeSchoolYearStatusDto, actorId: string, meta: ClientMetaData) {
    const year = await this.repo.findById(id);
    if (!year) throw new NotFoundException('Año escolar no encontrado');
    if (!YEAR_TRANSITIONS[year.status].includes(dto.status))
      throw new ConflictException(`No se puede pasar un año de ${year.status} a ${dto.status}`);

    if (dto.status === SchoolYearStatus.ACTIVO) {
      const other = await this.repo.findOtherActive(id);
      if (other) throw new ConflictException(`Ya existe un año escolar activo (${other.name}). Ciérralo antes de activar este`);
      await this.prisma.schoolYear.update({ where: { id }, data: { status: dto.status } });
    } else {
      // CERRADO: se bloquea el año para que nadie cree inscripciones mientras se verifica.
      await this.prisma.$transaction(async (tx) => {
        await lockYearForUpdate(tx, id);
        const pending = await tx.enrollment.count({ where: { schoolYearId: id, status: 'PENDIENTE' } });
        if (pending > 0)
          throw new ConflictException(`No se puede cerrar el año: hay ${pending} inscripción(es) PENDIENTE. Actívalas o anúlalas primero`);
        await tx.academicTerm.updateMany({ where: { schoolYearId: id, status: { not: TermStatus.CERRADO } }, data: { status: TermStatus.CERRADO } });
        await tx.schoolYear.update({ where: { id }, data: { status: SchoolYearStatus.CERRADO } });
      });
    }
    await this.audit.log({ userId: actorId, action: 'school_year.status', entity: 'SchoolYear', entityId: id, metadata: { from: year.status, to: dto.status }, ...meta });
    return presentSchoolYear((await this.repo.findById(id))!);
  }

  async changeTermStatus(id: string, number: number, dto: ChangeTermStatusDto, actorId: string, meta: ClientMetaData) {
    const year = await this.repo.findById(id);
    if (!year) throw new NotFoundException('Año escolar no encontrado');
    const term = year.terms.find((t) => t.number === number);
    if (!term) throw new NotFoundException('Momento pedagógico no encontrado');
    if (year.status === SchoolYearStatus.CERRADO) throw new ConflictException('El año escolar está cerrado');
    if (!TERM_TRANSITIONS[term.status].includes(dto.status))
      throw new ConflictException(`No se puede pasar el momento de ${term.status} a ${dto.status}`);
    if (dto.status === TermStatus.ACTIVO) {
      if (year.status !== SchoolYearStatus.ACTIVO) throw new ConflictException('Activa el año escolar antes de activar un momento');
      const active = year.terms.find((t) => t.status === TermStatus.ACTIVO);
      if (active) throw new ConflictException(`${active.name} sigue activo. Ciérralo antes de activar otro`);
    }
    await this.prisma.academicTerm.update({ where: { id: term.id }, data: { status: dto.status } });
    await this.audit.log({
      userId: actorId, action: 'academic_term.status', entity: 'AcademicTerm', entityId: term.id,
      metadata: { schoolYear: year.name, number, from: term.status, to: dto.status }, ...meta,
    });
    return presentSchoolYear((await this.repo.findById(id))!);
  }
}
