import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { studentScope } from '../common/access/access-scope';
import { ClientMetaData } from '../common/decorators';
import { paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { addDays, today, ymd } from '../common/utils/dates';
import { diffFields } from '../common/utils/diff';
import { normalizeIdentification, tokens } from '../common/utils/normalize';
import { studentSearch } from '../students/student-search';
import {
  ChangeEnrollmentStatusDto, CreateEnrollmentDto, ListEnrollmentsDto, LookupDto, RepresentativeInputDto, SetEnrollmentRepresentativesDto, UpdateEnrollmentDto,
} from './dto/enrollments.dto';
import { assertEditable, isOverdue, isTerminal, OCCUPYING, summarizeDocuments, TRANSITIONS } from './enrollment.rules';

type Tx = Prisma.TransactionClient;
const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 };

/** Bloquea la sección: dos inscripciones simultáneas no pueden pasarse del cupo. */
const lockSection = (tx: Tx, id: string) => tx.$queryRaw`SELECT id FROM sections WHERE id = ${id} FOR UPDATE`;
/** Bloqueo compartido del año: se puede inscribir en paralelo, pero no cerrar el año a la vez. */
const lockYearShared = (tx: Tx, id: string) => tx.$queryRaw`SELECT id FROM school_years WHERE id = ${id} FOR SHARE`;

const detailInclude = {
  student: true,
  schoolYear: { select: { id: true, name: true, status: true } },
  section: { include: { gradeLevel: { select: { id: true, number: true, name: true } } } },
  representatives: { include: { representative: true }, orderBy: { isPrimary: 'desc' } },
  documents: { include: { requirementType: true } },
} satisfies Prisma.EnrollmentInclude;

const listInclude = {
  student: { select: { id: true, firstName: true, lastName: true, identificationType: true, identificationNumber: true, sigesCode: true } },
  schoolYear: { select: { id: true, name: true, status: true } },
  section: { select: { id: true, name: true, gradeLevel: { select: { id: true, number: true, name: true } } } },
  documents: { select: { requirementTypeId: true, status: true } },
} satisfies Prisma.EnrollmentInclude;

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private config: ConfigService) {}

  // ───────────────────────── catálogo y presentación ─────────────────────────

  private catalog() {
    return this.prisma.requirementType.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async list(q: ListEnrollmentsDto, user: AuthUser) {
    const catalog = await this.catalog();
    const required = catalog.filter((r) => r.isRequired);
    const deliveredAll: Prisma.EnrollmentWhereInput[] = required.map((r) => ({ documents: { some: { requirementTypeId: r.id, status: 'ENTREGADO' } } }));

    const and: Prisma.EnrollmentWhereInput[] = [{ student: studentScope(user) }];
    if (q.search) {
      const receiptTerm = q.search.replace(/\s+/g, '').toUpperCase();
      and.push({ OR: [{ receiptNumber: { contains: receiptTerm } }, { student: { AND: studentSearch(q.search) } }] });
    }
    if (q.documents === 'complete') and.push(...deliveredAll);
    if (q.documents === 'pending') and.push(required.length ? { NOT: { AND: deliveredAll } } : { id: { in: [] } });
    if (q.overdue) and.push({ status: 'PENDIENTE', documentsDueDate: { lt: today() } });

    const where: Prisma.EnrollmentWhereInput = {
      AND: and, schoolYearId: q.schoolYearId, sectionId: q.sectionId, status: q.status,
      ...(q.gradeLevelId ? { section: { gradeLevelId: q.gradeLevelId } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where, include: listInclude, orderBy: [{ enrollmentDate: 'desc' }, { createdAt: 'desc' }], skip: (q.page - 1) * q.limit, take: q.limit,
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    const now = today();
    return paginated(rows.map((e) => {
      const docs = summarizeDocuments(e.documents, required);
      return {
        id: e.id, receiptNumber: e.receiptNumber, status: e.status, enrollmentDate: ymd(e.enrollmentDate), condition: e.condition,
        student: e.student, schoolYear: e.schoolYear, section: { id: e.section.id, name: e.section.name }, gradeLevel: e.section.gradeLevel,
        documents: { required: docs.required, delivered: docs.delivered, complete: docs.complete },
        documentsDueDate: ymd(e.documentsDueDate), documentsOverdue: isOverdue(e.status, e.documentsDueDate, now),
      };
    }), total, q);
  }

  async get(id: string, user: AuthUser) {
    const e = await this.prisma.enrollment.findFirst({ where: { AND: [{ id }, { student: studentScope(user) }] }, include: detailInclude });
    if (!e) throw new NotFoundException('Inscripción no encontrada');
    const catalog = await this.catalog();
    const required = catalog.filter((r) => r.isRequired);
    const links = await this.prisma.studentRepresentative.findMany({
      where: { studentId: e.studentId, representativeId: { in: e.representatives.map((r) => r.representativeId) } },
    });
    const rel = new Map(links.map((l) => [l.representativeId, l]));

    const byType = new Map(e.documents.map((d) => [d.requirementTypeId, d]));
    const types = [...catalog, ...e.documents.filter((d) => !catalog.some((c) => c.id === d.requirementTypeId)).map((d) => d.requirementType)];
    const documents = types.map((t) => {
      const d = byType.get(t.id);
      return {
        requirementTypeId: t.id, code: t.code, name: t.name, isRequired: t.isRequired, isActive: t.isActive,
        status: d?.status ?? 'PENDIENTE', hasFile: !!d?.storageKey, originalName: d?.originalName ?? null, mimeType: d?.mimeType ?? null,
        sizeBytes: d?.sizeBytes ?? null, deliveredAt: ymd(d?.deliveredAt), notes: d?.notes ?? null,
      };
    });

    const expediente = summarizeDocuments(e.documents, required);
    const hasPrimary = e.representatives.some((r) => r.isPrimary);
    const canActivate = e.status === 'PENDIENTE' && expediente.complete && hasPrimary && e.schoolYear.status !== 'CERRADO' && e.student.status === 'ACTIVO';
    const { student } = e;
    return {
      id: e.id, receiptNumber: e.receiptNumber, status: e.status, enrollmentDate: ymd(e.enrollmentDate), condition: e.condition,
      previousSchool: e.previousSchool, notes: e.notes, createdAt: e.createdAt, updatedAt: e.updatedAt,
      documentsDueDate: ymd(e.documentsDueDate), documentsOverdue: isOverdue(e.status, e.documentsDueDate, today()),
      schoolYear: e.schoolYear, section: { id: e.section.id, name: e.section.name, maxCapacity: e.section.maxCapacity }, gradeLevel: e.section.gradeLevel,
      student: {
        id: student.id, firstName: student.firstName, lastName: student.lastName, identificationType: student.identificationType,
        identificationNumber: student.identificationNumber, sigesCode: student.sigesCode, email: student.email, birthDate: ymd(student.birthDate),
        birthPlace: student.birthPlace, sex: student.sex, address: student.address, status: student.status,
      },
      representatives: e.representatives.map((r) => ({
        id: r.representativeId, isPrimary: r.isPrimary, firstName: r.representative.firstName, lastName: r.representative.lastName,
        documentId: r.representative.documentId, phone: r.representative.phone, email: r.representative.email, hasPhoto: !!r.representative.photoKey,
        relationship: rel.get(r.representativeId)?.relationship ?? null, relationshipDetail: rel.get(r.representativeId)?.relationshipDetail ?? null,
      })),
      documents, expediente, canActivate, allowedTransitions: e.schoolYear.status === 'CERRADO' ? [] : TRANSITIONS[e.status],
    };
  }

  // ───────────────────────── búsquedas para el flujo de inscripción ─────────────────────────

  /** Alumnos existentes que se pueden reutilizar al inscribir (con sus representantes y si ya tienen inscripción vigente). */
  async lookupStudents({ search }: LookupDto) {
    if (!search?.trim()) return [];
    const rows = await this.prisma.student.findMany({
      where: { AND: studentSearch(search) }, take: 10, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        representatives: { include: { representative: { select: { id: true, firstName: true, lastName: true, documentId: true, phone: true, email: true, isActive: true } } } },
        enrollments: {
          where: { status: { in: OCCUPYING } },
          select: { id: true, status: true, schoolYear: { select: { id: true, name: true } }, section: { select: { name: true, gradeLevel: { select: { name: true } } } } },
        },
      },
    });
    return rows.map((s) => ({
      id: s.id, firstName: s.firstName, lastName: s.lastName, identificationType: s.identificationType, identificationNumber: s.identificationNumber,
      sigesCode: s.sigesCode, email: s.email, status: s.status, birthDate: ymd(s.birthDate), sex: s.sex, birthPlace: s.birthPlace, address: s.address,
      representatives: s.representatives.map((r) => ({ relationship: r.relationship, relationshipDetail: r.relationshipDetail, ...r.representative })),
      openEnrollments: s.enrollments.map((e) => ({ id: e.id, status: e.status, schoolYear: e.schoolYear, section: e.section.name, gradeLevel: e.section.gradeLevel.name })),
    }));
  }

  async lookupRepresentatives({ search }: LookupDto) {
    if (!search?.trim()) return [];
    const and = tokens(search).map((t) => ({
      OR: [
        { firstName: { contains: t, mode: 'insensitive' as const } },
        { lastName: { contains: t, mode: 'insensitive' as const } },
        { documentId: { contains: normalizeIdentification(t) } },
        { phone: { contains: t } },
        { email: { contains: t, mode: 'insensitive' as const } },
      ],
    }));
    return this.prisma.representative.findMany({
      where: { AND: and, isActive: true }, take: 10, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, documentId: true, phone: true, email: true, address: true, occupation: true },
    });
  }

  // ───────────────────────── representantes (compartido por crear y reemplazar) ─────────────────────────

  /** Reglas de forma (sin base de datos): uno u otro origen, parentesco OTRO con detalle, un solo principal, sin repetidos. */
  private validateRepresentativeInputs(inputs: RepresentativeInputDto[]) {
    const seen = new Set<string>();
    inputs.forEach((r, i) => {
      const n = i + 1;
      if (!!r.existingId === !!r.data) throw new BadRequestException(`Representante ${n}: indica uno existente o los datos de uno nuevo (solo uno)`);
      if (r.relationship === 'OTRO' && !r.relationshipDetail) throw new BadRequestException(`Representante ${n}: especifica el parentesco cuando es "Otro"`);
      const key = r.existingId ?? `doc:${r.data!.documentId}`;
      if (seen.has(key)) throw new BadRequestException(`Representante ${n}: está repetido en la lista`);
      seen.add(key);
    });
    const primaries = inputs.filter((r) => r.isPrimary).length;
    if (primaries !== 1) throw new BadRequestException('Debe haber exactamente un representante principal');
  }

  /** Reutiliza o crea cada representante dentro de la transacción. */
  private async resolveRepresentatives(tx: Tx, inputs: RepresentativeInputDto[]) {
    const out: { id: string; input: RepresentativeInputDto; created: boolean }[] = [];
    for (const input of inputs) {
      if (input.existingId) {
        const rep = await tx.representative.findUnique({ where: { id: input.existingId }, select: { id: true, isActive: true, firstName: true, lastName: true } });
        if (!rep) throw new NotFoundException('Uno de los representantes seleccionados no existe');
        if (!rep.isActive) throw new ConflictException(`El representante ${rep.firstName} ${rep.lastName} está desactivado`);
        out.push({ id: rep.id, input, created: false });
      } else {
        const d = input.data!;
        const dup = await tx.representative.findUnique({ where: { documentId: d.documentId }, select: { firstName: true, lastName: true } });
        if (dup) throw new ConflictException(`Ya existe un representante con la cédula ${d.documentId} (${dup.firstName} ${dup.lastName}). Selecciónalo de la lista en lugar de crearlo`);
        const rep = await tx.representative.create({
          data: { firstName: d.firstName, lastName: d.lastName, documentId: d.documentId, phone: d.phone, email: d.email ?? null, address: d.address ?? null, occupation: d.occupation ?? null },
        });
        out.push({ id: rep.id, input, created: true });
      }
    }
    return out;
  }

  /** Vínculo permanente alumno ↔ representante (el parentesco vive aquí). */
  private async linkRepresentatives(tx: Tx, studentId: string, reps: { id: string; input: RepresentativeInputDto }[]) {
    for (const { id, input } of reps) {
      const relationshipDetail = input.relationship === 'OTRO' ? input.relationshipDetail ?? null : null;
      await tx.studentRepresentative.upsert({
        where: { studentId_representativeId: { studentId, representativeId: id } },
        create: { studentId, representativeId: id, relationship: input.relationship, relationshipDetail },
        update: { relationship: input.relationship, relationshipDetail },
      });
    }
  }

  // ───────────────────────── crear ─────────────────────────

  async create(dto: CreateEnrollmentDto, user: AuthUser, meta: ClientMetaData) {
    const { student: studentIn } = dto;
    if (!!studentIn.existingId === !!studentIn.data) throw new BadRequestException('Indica un alumno existente o los datos de un alumno nuevo (solo uno)');
    this.validateRepresentativeInputs(dto.representatives);
    const now = today();
    if (studentIn.data && studentIn.data.birthDate > now) throw new BadRequestException('La fecha de nacimiento no puede ser futura');

    const year = await this.prisma.schoolYear.findUnique({ where: { id: dto.schoolYearId } });
    if (!year) throw new NotFoundException('Año escolar no encontrado');
    if (year.status === 'CERRADO') throw new ConflictException('El año escolar está cerrado: no admite inscripciones');
    if (dto.enrollmentDate > year.endDate) throw new BadRequestException('La fecha de inscripción no puede ser posterior al fin del año escolar');

    const section = await this.prisma.section.findUnique({ where: { id: dto.sectionId }, include: { gradeLevel: true } });
    if (!section) throw new NotFoundException('Sección no encontrada');
    if (section.gradeLevelId !== dto.gradeLevelId) throw new BadRequestException('La sección no pertenece al año/grado indicado');
    if (!section.isActive || !section.gradeLevel.isActive) throw new ConflictException('La sección (o su año/grado) está desactivada');

    if (await this.prisma.enrollment.findUnique({ where: { receiptNumber: dto.receiptNumber }, select: { id: true } }))
      throw new ConflictException(`El número de recibo ${dto.receiptNumber} ya está registrado`);

    const catalog = await this.catalog();
    const required = catalog.filter((r) => r.isRequired);
    const initial = new Map<string, { delivered: boolean; notes?: string | null }>();
    for (const d of dto.documents ?? []) {
      if (!catalog.some((c) => c.id === d.requirementTypeId)) throw new BadRequestException('Uno de los requisitos indicados no existe o está inactivo');
      if (initial.has(d.requirementTypeId)) throw new BadRequestException('Un requisito está repetido en la lista de documentos');
      initial.set(d.requirementTypeId, d);
    }
    const deliveredIds = [...initial].filter(([, v]) => v.delivered).map(([id]) => ({ requirementTypeId: id, status: 'ENTREGADO' as const }));
    const complete = summarizeDocuments(deliveredIds, required).complete;
    const status = complete ? 'ACTIVA' : 'PENDIENTE';

    let documentsDueDate: Date | null = null;
    if (status === 'PENDIENTE') {
      documentsDueDate = dto.documentsDueDate ?? addDays(now, Number(this.config.get('ENROLLMENT_DOCS_DUE_DAYS') ?? 30));
      if (documentsDueDate < dto.enrollmentDate) throw new BadRequestException('El plazo de documentos no puede ser anterior a la fecha de inscripción');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await lockYearShared(tx, year.id);
      const freshYear = await tx.schoolYear.findUniqueOrThrow({ where: { id: year.id }, select: { status: true } });
      if (freshYear.status === 'CERRADO') throw new ConflictException('El año escolar fue cerrado: no admite inscripciones');

      // Cupo: se bloquea la sección y se cuenta lo reservado (PENDIENTE + ACTIVA).
      await lockSection(tx, section.id);
      const occupied = await tx.enrollment.count({ where: { schoolYearId: year.id, sectionId: section.id, status: { in: OCCUPYING } } });
      if (occupied >= section.maxCapacity)
        throw new ConflictException(`La sección ${section.gradeLevel.name} "${section.name}" está llena (${occupied}/${section.maxCapacity})`);

      // Alumno: reutilizar o crear.
      let studentId: string;
      let studentCreated = false;
      if (studentIn.existingId) {
        const s = await tx.student.findUnique({ where: { id: studentIn.existingId }, select: { id: true, status: true, firstName: true, lastName: true } });
        if (!s) throw new NotFoundException('El alumno seleccionado no existe');
        if (s.status !== 'ACTIVO') throw new ConflictException(`El alumno ${s.firstName} ${s.lastName} está ${s.status} y no puede inscribirse`);
        const open = await tx.enrollment.findFirst({ where: { studentId: s.id, schoolYearId: year.id, status: { in: ['PENDIENTE', 'ACTIVA'] } }, select: { status: true } });
        if (open) throw new ConflictException(`El alumno ya tiene una inscripción ${open.status} en el año escolar ${year.name}`);
        studentId = s.id;
      } else {
        const d = studentIn.data!;
        const dup = await tx.student.findUnique({
          where: { identificationType_identificationNumber: { identificationType: d.identificationType, identificationNumber: d.identificationNumber } },
          select: { firstName: true, lastName: true },
        });
        if (dup) throw new ConflictException(`Ya existe un alumno con esa identificación (${dup.firstName} ${dup.lastName}). Selecciónalo de la lista en lugar de crearlo`);
        if (d.sigesCode) {
          const sg = await tx.student.findUnique({ where: { sigesCode: d.sigesCode }, select: { firstName: true, lastName: true } });
          if (sg) throw new ConflictException(`El código SIGES ya pertenece a ${sg.firstName} ${sg.lastName}`);
        }
        const created = await tx.student.create({
          data: {
            firstName: d.firstName, lastName: d.lastName, identificationType: d.identificationType, identificationNumber: d.identificationNumber,
            sigesCode: d.sigesCode ?? null, email: d.email ?? null, birthDate: d.birthDate, birthPlace: d.birthPlace, sex: d.sex, address: d.address,
          },
        });
        studentId = created.id;
        studentCreated = true;
      }

      const reps = await this.resolveRepresentatives(tx, dto.representatives);
      await this.linkRepresentatives(tx, studentId, reps);

      const enrollment = await tx.enrollment.create({
        data: {
          studentId, schoolYearId: year.id, sectionId: section.id, enrollmentDate: dto.enrollmentDate, receiptNumber: dto.receiptNumber,
          condition: dto.condition ?? 'REGULAR', previousSchool: dto.previousSchool ?? null, notes: dto.notes ?? null,
          status, documentsDueDate, createdById: user.id,
          representatives: { create: reps.map((r) => ({ representativeId: r.id, isPrimary: r.input.isPrimary })) },
          documents: {
            create: catalog.map((t) => {
              const init = initial.get(t.id);
              return init?.delivered
                ? { requirementTypeId: t.id, status: 'ENTREGADO' as const, deliveredAt: now, notes: init.notes ?? null }
                : { requirementTypeId: t.id, status: 'PENDIENTE' as const, notes: init?.notes ?? null };
            }),
          },
        },
      });
      return { enrollment, studentId, studentCreated, createdReps: reps.filter((r) => r.created).map((r) => r.id) };
    }, TX_OPTIONS);

    const { enrollment } = result;
    await this.audit.log({
      userId: user.id, action: 'enrollment.create', entity: 'Enrollment', entityId: enrollment.id,
      metadata: { status, receiptNumber: enrollment.receiptNumber, studentId: result.studentId, sectionId: section.id, schoolYearId: year.id, newStudent: result.studentCreated, newRepresentatives: result.createdReps.length }, ...meta,
    });
    if (result.studentCreated) await this.audit.log({ userId: user.id, action: 'student.create', entity: 'Student', entityId: result.studentId, metadata: { via: 'enrollment', enrollmentId: enrollment.id }, ...meta });
    for (const id of result.createdReps) await this.audit.log({ userId: user.id, action: 'representative.create', entity: 'Representative', entityId: id, metadata: { via: 'enrollment', enrollmentId: enrollment.id }, ...meta });
    return this.get(enrollment.id, user);
  }

  // ───────────────────────── editar ─────────────────────────

  async update(id: string, dto: UpdateEnrollmentDto, user: AuthUser, meta: ClientMetaData) {
    const before = await this.prisma.enrollment.findUnique({ where: { id }, include: { schoolYear: true, section: { include: { gradeLevel: true } } } });
    if (!before) throw new NotFoundException('Inscripción no encontrada');
    assertEditable(before);

    if (dto.enrollmentDate && dto.enrollmentDate > before.schoolYear.endDate) throw new BadRequestException('La fecha de inscripción no puede ser posterior al fin del año escolar');
    if (dto.receiptNumber && dto.receiptNumber !== before.receiptNumber &&
      (await this.prisma.enrollment.findUnique({ where: { receiptNumber: dto.receiptNumber }, select: { id: true } })))
      throw new ConflictException(`El número de recibo ${dto.receiptNumber} ya está registrado`);
    if (dto.documentsDueDate !== undefined && before.status !== 'PENDIENTE')
      throw new ConflictException('El plazo de documentos solo aplica a inscripciones PENDIENTE');
    const enrollmentDate = dto.enrollmentDate ?? before.enrollmentDate;
    if (dto.documentsDueDate && dto.documentsDueDate < enrollmentDate) throw new BadRequestException('El plazo de documentos no puede ser anterior a la fecha de inscripción');

    const data: Prisma.EnrollmentUncheckedUpdateInput = {
      enrollmentDate: dto.enrollmentDate, receiptNumber: dto.receiptNumber, condition: dto.condition,
      previousSchool: dto.previousSchool, notes: dto.notes, documentsDueDate: dto.documentsDueDate,
    };

    const moving = !!dto.sectionId && dto.sectionId !== before.sectionId;
    const after = await this.prisma.$transaction(async (tx) => {
      if (moving) {
        await lockYearShared(tx, before.schoolYearId);
        await lockSection(tx, dto.sectionId!);
        const target = await tx.section.findUnique({ where: { id: dto.sectionId! }, include: { gradeLevel: true } });
        if (!target) throw new NotFoundException('La sección de destino no existe');
        if (!target.isActive || !target.gradeLevel.isActive) throw new ConflictException('La sección de destino está desactivada');
        const occupied = await tx.enrollment.count({ where: { schoolYearId: before.schoolYearId, sectionId: target.id, status: { in: OCCUPYING } } });
        if (occupied >= target.maxCapacity) throw new ConflictException(`La sección ${target.gradeLevel.name} "${target.name}" está llena (${occupied}/${target.maxCapacity})`);
        data.sectionId = target.id;
      }
      return tx.enrollment.update({ where: { id }, data });
    }, TX_OPTIONS);

    const changes = diffFields(before, after, ['sectionId', 'enrollmentDate', 'receiptNumber', 'condition', 'previousSchool', 'notes', 'documentsDueDate']);
    if (Object.keys(changes).length) await this.audit.log({ userId: user.id, action: 'enrollment.update', entity: 'Enrollment', entityId: id, metadata: { changes }, ...meta });
    return this.get(id, user);
  }

  // ───────────────────────── estado ─────────────────────────

  async changeStatus(id: string, dto: ChangeEnrollmentStatusDto, user: AuthUser, meta: ClientMetaData) {
    const e = await this.prisma.enrollment.findUnique({
      where: { id }, include: { schoolYear: true, student: { select: { id: true, status: true, firstName: true, lastName: true } }, documents: { select: { requirementTypeId: true, status: true } } },
    });
    if (!e) throw new NotFoundException('Inscripción no encontrada');
    if (e.schoolYear.status === 'CERRADO') throw new ConflictException('El año escolar está cerrado: sus inscripciones ya no se pueden modificar');
    if (!TRANSITIONS[e.status].includes(dto.status)) {
      if (e.status === 'ACTIVA' && dto.status === 'ANULADA') throw new ConflictException('Una inscripción ACTIVA no se anula: se RETIRA');
      throw new ConflictException(isTerminal(e.status)
        ? `La inscripción está ${e.status} y es un registro histórico`
        : `No se puede pasar una inscripción de ${e.status} a ${dto.status}`);
    }

    if (dto.status === 'ACTIVA') {
      const required = (await this.catalog()).filter((r) => r.isRequired);
      const docs = summarizeDocuments(e.documents, required);
      if (!docs.complete) throw new ConflictException(`No se puede activar: faltan requisitos obligatorios (${docs.missing.join(', ')})`);
      if (!(await this.prisma.enrollmentRepresentative.count({ where: { enrollmentId: id, isPrimary: true } })))
        throw new ConflictException('No se puede activar: la inscripción no tiene representante principal');
      if (e.student.status !== 'ACTIVO') throw new ConflictException(`El alumno está ${e.student.status} y no puede tener una inscripción activa`);
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.status === 'ACTIVA') {
        await lockYearShared(tx, e.schoolYearId);
        const other = await tx.enrollment.findFirst({ where: { studentId: e.studentId, schoolYearId: e.schoolYearId, status: 'ACTIVA', id: { not: id } }, select: { receiptNumber: true } });
        if (other) throw new ConflictException(`El alumno ya tiene una inscripción ACTIVA en este año escolar (recibo ${other.receiptNumber})`);
        await tx.enrollment.update({ where: { id }, data: { status: 'ACTIVA', documentsDueDate: null } });
      } else {
        await tx.enrollment.update({ where: { id }, data: { status: dto.status } });
      }
    }, TX_OPTIONS);

    await this.audit.log({
      userId: user.id, action: 'enrollment.status', entity: 'Enrollment', entityId: id,
      metadata: { from: e.status, to: dto.status, reason: dto.reason ?? null, receiptNumber: e.receiptNumber }, ...meta,
    });
    return this.get(id, user);
  }

  // ───────────────────────── representantes de la inscripción ─────────────────────────

  async setRepresentatives(id: string, dto: SetEnrollmentRepresentativesDto, user: AuthUser, meta: ClientMetaData) {
    const e = await this.prisma.enrollment.findUnique({ where: { id }, include: { schoolYear: true } });
    if (!e) throw new NotFoundException('Inscripción no encontrada');
    assertEditable(e);
    this.validateRepresentativeInputs(dto.representatives);

    const result = await this.prisma.$transaction(async (tx) => {
      const reps = await this.resolveRepresentatives(tx, dto.representatives);
      const ids = reps.map((r) => r.id);
      // El índice único parcial permite un solo principal: primero se limpian, al final se marca el nuevo.
      await tx.enrollmentRepresentative.deleteMany({ where: { enrollmentId: id, representativeId: { notIn: ids } } });
      await tx.enrollmentRepresentative.updateMany({ where: { enrollmentId: id }, data: { isPrimary: false } });
      for (const r of reps) {
        await tx.enrollmentRepresentative.upsert({
          where: { enrollmentId_representativeId: { enrollmentId: id, representativeId: r.id } },
          create: { enrollmentId: id, representativeId: r.id, isPrimary: false }, update: {},
        });
      }
      const primary = reps.find((r) => r.input.isPrimary)!;
      await tx.enrollmentRepresentative.update({
        where: { enrollmentId_representativeId: { enrollmentId: id, representativeId: primary.id } }, data: { isPrimary: true },
      });
      await this.linkRepresentatives(tx, e.studentId, reps);
      return { ids, created: reps.filter((r) => r.created).map((r) => r.id), primaryId: primary.id };
    }, TX_OPTIONS);

    await this.audit.log({ userId: user.id, action: 'enrollment.representatives', entity: 'Enrollment', entityId: id, metadata: { representativeIds: result.ids, primaryId: result.primaryId }, ...meta });
    for (const rid of result.created) await this.audit.log({ userId: user.id, action: 'representative.create', entity: 'Representative', entityId: rid, metadata: { via: 'enrollment', enrollmentId: id }, ...meta });
    return this.get(id, user);
  }
}
