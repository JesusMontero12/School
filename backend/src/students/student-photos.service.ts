import { ConflictException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ClientMetaData } from '../common/decorators';
import { PrismaService } from '../common/prisma/prisma.service';
import { FilesService, UploadedFileData } from '../common/storage/files.service';

/**
 * Historial fotográfico: máximo una foto por (alumno, año/grado) → hasta 5 por alumno.
 * Si el alumno repite el grado, la foto nueva reemplaza a la anterior; las inscripciones no se tocan.
 */
@Injectable()
export class StudentPhotosService {
  constructor(private prisma: PrismaService, private files: FilesService, private audit: AuditService) {}

  /** Guarda (o reemplaza) la foto del alumno para ese año/grado. */
  async save(
    studentId: string, gradeLevelId: string, schoolYearId: string, file: UploadedFileData | undefined,
    actorId: string, meta: ClientMetaData,
  ) {
    const saved = await this.files.save(file, `students/${studentId}/photos`, 'image');
    try {
      const where = { studentId_gradeLevelId: { studentId, gradeLevelId } };
      const previous = await this.prisma.studentPhoto.findUnique({ where });
      const data = { schoolYearId, storageKey: saved.storageKey, mimeType: saved.mimeType, sizeBytes: saved.sizeBytes };
      await this.prisma.studentPhoto.upsert({ where, create: { studentId, gradeLevelId, ...data }, update: data });
      await this.files.remove(previous?.storageKey);
      await this.audit.log({
        userId: actorId, action: 'student.photo', entity: 'Student', entityId: studentId,
        metadata: { gradeLevelId, schoolYearId, replaced: !!previous }, ...meta,
      });
      return { gradeLevelId, schoolYearId, replaced: !!previous };
    } catch (error) {
      await this.files.remove(saved.storageKey); // no dejar archivos huérfanos si falla la base de datos
      throw error;
    }
  }

  /** Subida desde Alumnos: el año escolar se toma de la última inscripción no anulada en ese año/grado. */
  async saveFromProfile(studentId: string, gradeLevelId: string, file: UploadedFileData | undefined, actorId: string, meta: ClientMetaData) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, status: { not: 'ANULADA' }, section: { gradeLevelId } },
      orderBy: [{ schoolYear: { startDate: 'desc' } }, { createdAt: 'desc' }],
      select: { schoolYearId: true },
    });
    if (!enrollment) throw new ConflictException('El alumno no tiene una inscripción en ese año/grado, así que no se puede asociar la foto');
    return this.save(studentId, gradeLevelId, enrollment.schoolYearId, file, actorId, meta);
  }

  async stream(studentId: string, gradeLevelId: string): Promise<StreamableFile> {
    const photo = await this.prisma.studentPhoto.findUnique({ where: { studentId_gradeLevelId: { studentId, gradeLevelId } } });
    if (!photo) throw new NotFoundException('El alumno no tiene foto en ese año/grado');
    return this.files.stream(photo.storageKey, photo.mimeType, 'foto-alumno');
  }
}
