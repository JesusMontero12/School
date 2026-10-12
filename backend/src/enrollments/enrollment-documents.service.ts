import { ConflictException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { studentScope } from '../common/access/access-scope';
import { ClientMetaData } from '../common/decorators';
import { PrismaService } from '../common/prisma/prisma.service';
import { FilesService, UploadedFileData } from '../common/storage/files.service';
import { AuthUser } from '../common/types/auth-user';
import { today, ymd } from '../common/utils/dates';
import { RepresentativesService } from '../representatives/representatives.service';
import { StudentPhotosService } from '../students/student-photos.service';
import { UpdateDocumentDto } from './dto/enrollments.dto';
import { assertEditable } from './enrollment.rules';

const present = (d: { requirementTypeId: string; status: string; deliveredAt: Date | null; notes: string | null; storageKey: string | null; originalName: string | null; mimeType: string | null; sizeBytes: number | null }) => ({
  requirementTypeId: d.requirementTypeId, status: d.status, deliveredAt: ymd(d.deliveredAt), notes: d.notes,
  hasFile: !!d.storageKey, originalName: d.originalName, mimeType: d.mimeType, sizeBytes: d.sizeBytes,
});

/** Documentos de una inscripción concreta (estado + archivo opcional) y fotos que se capturan al inscribir. */
@Injectable()
export class EnrollmentDocumentsService {
  constructor(
    private prisma: PrismaService, private files: FilesService, private audit: AuditService,
    private studentPhotos: StudentPhotosService, private representatives: RepresentativesService,
  ) {}

  private async editableEnrollment(id: string) {
    const e = await this.prisma.enrollment.findUnique({ where: { id }, include: { schoolYear: true, section: { select: { gradeLevelId: true } } } });
    if (!e) throw new NotFoundException('Inscripción no encontrada');
    assertEditable(e);
    return e;
  }

  private async requirement(requirementTypeId: string) {
    const rt = await this.prisma.requirementType.findUnique({ where: { id: requirementTypeId } });
    if (!rt) throw new NotFoundException('Requisito no encontrado');
    return rt;
  }

  private findDoc(enrollmentId: string, requirementTypeId: string) {
    return this.prisma.enrollmentDocument.findUnique({ where: { enrollmentId_requirementTypeId: { enrollmentId, requirementTypeId } } });
  }

  async update(id: string, requirementTypeId: string, dto: UpdateDocumentDto, user: AuthUser, meta: ClientMetaData) {
    await this.editableEnrollment(id);
    const rt = await this.requirement(requirementTypeId);
    const existing = await this.findDoc(id, requirementTypeId);
    if (!existing && !rt.isActive) throw new ConflictException('El requisito está inactivo');

    const status = dto.status ?? existing?.status ?? 'PENDIENTE';
    if (status === 'PENDIENTE' && existing?.storageKey) throw new ConflictException('El documento tiene un archivo adjunto: elimínalo antes de marcarlo como PENDIENTE');
    const deliveredAt = status === 'ENTREGADO' ? existing?.deliveredAt ?? today() : null;

    const doc = await this.prisma.enrollmentDocument.upsert({
      where: { enrollmentId_requirementTypeId: { enrollmentId: id, requirementTypeId } },
      create: { enrollmentId: id, requirementTypeId, status, deliveredAt, notes: dto.notes ?? null },
      update: { status, deliveredAt, notes: dto.notes },
    });
    if ((existing?.status ?? 'PENDIENTE') !== status || dto.notes !== undefined)
      await this.audit.log({ userId: user.id, action: 'enrollment.document', entity: 'Enrollment', entityId: id, metadata: { requirement: rt.code, from: existing?.status ?? 'PENDIENTE', to: status }, ...meta });
    return present(doc);
  }

  /** Adjunta el escaneo (JPG/PNG/PDF). Entregar el archivo marca el documento como ENTREGADO. */
  async uploadFile(id: string, requirementTypeId: string, file: UploadedFileData | undefined, user: AuthUser, meta: ClientMetaData) {
    await this.editableEnrollment(id);
    const rt = await this.requirement(requirementTypeId);
    const existing = await this.findDoc(id, requirementTypeId);
    if (!existing && !rt.isActive) throw new ConflictException('El requisito está inactivo');

    const saved = await this.files.save(file, `enrollments/${id}/documents`, 'document');
    try {
      const data = {
        status: 'ENTREGADO' as const, deliveredAt: existing?.deliveredAt ?? today(),
        storageKey: saved.storageKey, originalName: saved.originalName, mimeType: saved.mimeType, sizeBytes: saved.sizeBytes,
      };
      const doc = await this.prisma.enrollmentDocument.upsert({
        where: { enrollmentId_requirementTypeId: { enrollmentId: id, requirementTypeId } },
        create: { enrollmentId: id, requirementTypeId, ...data }, update: data,
      });
      await this.files.remove(existing?.storageKey);
      await this.audit.log({ userId: user.id, action: 'enrollment.document_file', entity: 'Enrollment', entityId: id, metadata: { requirement: rt.code, replaced: !!existing?.storageKey }, ...meta });
      return present(doc);
    } catch (error) {
      await this.files.remove(saved.storageKey);
      throw error;
    }
  }

  async streamFile(id: string, requirementTypeId: string, user: AuthUser): Promise<StreamableFile> {
    const e = await this.prisma.enrollment.findFirst({ where: { AND: [{ id }, { student: studentScope(user) }] }, select: { id: true } });
    if (!e) throw new NotFoundException('Inscripción no encontrada');
    const doc = await this.findDoc(id, requirementTypeId);
    if (!doc?.storageKey || !doc.mimeType) throw new NotFoundException('El documento no tiene archivo adjunto');
    return this.files.stream(doc.storageKey, doc.mimeType, doc.originalName);
  }

  /** Quita solo el archivo; el estado del documento no cambia (se corrige aparte si hace falta). */
  async removeFile(id: string, requirementTypeId: string, user: AuthUser, meta: ClientMetaData) {
    await this.editableEnrollment(id);
    const doc = await this.findDoc(id, requirementTypeId);
    if (!doc?.storageKey) throw new NotFoundException('El documento no tiene archivo adjunto');
    const updated = await this.prisma.enrollmentDocument.update({
      where: { id: doc.id }, data: { storageKey: null, originalName: null, mimeType: null, sizeBytes: null },
    });
    await this.files.remove(doc.storageKey);
    await this.audit.log({ userId: user.id, action: 'enrollment.document_file_removed', entity: 'Enrollment', entityId: id, metadata: { requirementTypeId }, ...meta });
    return present(updated);
  }

  // ───────── fotos que se capturan durante la inscripción ─────────

  /** Foto del alumno para el año/grado de esta inscripción (reemplaza la anterior de ese grado). */
  async uploadStudentPhoto(id: string, file: UploadedFileData | undefined, user: AuthUser, meta: ClientMetaData) {
    const e = await this.editableEnrollment(id);
    return this.studentPhotos.save(e.studentId, e.section.gradeLevelId, e.schoolYearId, file, user.id, meta);
  }

  async uploadRepresentativePhoto(id: string, representativeId: string, file: UploadedFileData | undefined, user: AuthUser, meta: ClientMetaData) {
    await this.editableEnrollment(id);
    const link = await this.prisma.enrollmentRepresentative.findUnique({ where: { enrollmentId_representativeId: { enrollmentId: id, representativeId } } });
    if (!link) throw new NotFoundException('El representante no pertenece a esta inscripción');
    return this.representatives.savePhoto(representativeId, file, user.id, meta);
  }
}
