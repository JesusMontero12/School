import { BadRequestException, ConflictException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { representativeScope } from '../common/access/access-scope';
import { ClientMetaData } from '../common/decorators';
import { paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { FilesService, UploadedFileData } from '../common/storage/files.service';
import { AuthUser } from '../common/types/auth-user';
import { diffFields } from '../common/utils/diff';
import { normalizeIdentification, tokens } from '../common/utils/normalize';
import { ListRepresentativesDto, UpdateRepresentativeDto } from './dto/representatives.dto';

const AUDITED_FIELDS = ['firstName', 'lastName', 'documentId', 'phone', 'email', 'address', 'occupation', 'isActive'];

/** El tipo de la foto se deduce de la extensión que el servidor le puso a la clave. */
const mimeFromKey = (key: string) => (key.endsWith('.png') ? 'image/png' : 'image/jpeg');

const present = <T extends { photoKey: string | null }>({ photoKey, ...r }: T) => ({ ...r, hasPhoto: !!photoKey });

@Injectable()
export class RepresentativesService {
  constructor(private prisma: PrismaService, private audit: AuditService, private files: FilesService) {}

  async list(q: ListRepresentativesDto, user: AuthUser) {
    const search: Prisma.RepresentativeWhereInput[] = q.search
      ? tokens(q.search).map((t) => ({
        OR: [
          { firstName: { contains: t, mode: 'insensitive' } },
          { lastName: { contains: t, mode: 'insensitive' } },
          { documentId: { contains: normalizeIdentification(t) } },
          { phone: { contains: t } },
          { email: { contains: t, mode: 'insensitive' } },
        ],
      }))
      : [];
    const where: Prisma.RepresentativeWhereInput = {
      AND: [representativeScope(user), ...search],
      isActive: q.isActive === undefined ? undefined : q.isActive === 'true',
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.representative.findMany({
        where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit,
        select: { id: true, firstName: true, lastName: true, documentId: true, phone: true, email: true, isActive: true, photoKey: true, _count: { select: { students: true } } },
      }),
      this.prisma.representative.count({ where }),
    ]);
    return paginated(rows.map(({ _count, ...r }) => ({ ...present(r), studentsCount: _count.students })), total, q);
  }

  async get(id: string, user: AuthUser) {
    const rep = await this.prisma.representative.findFirst({
      where: { AND: [{ id }, representativeScope(user)] },
      include: {
        students: {
          include: { student: { select: { id: true, firstName: true, lastName: true, identificationType: true, identificationNumber: true, status: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!rep) throw new NotFoundException('Representante no encontrado');
    const { students, userId, ...rest } = rep;
    void userId;
    return { ...present(rest), createdAt: rest.createdAt, students: students.map((s) => ({ relationship: s.relationship, relationshipDetail: s.relationshipDetail, ...s.student })) };
  }

  async update(id: string, dto: UpdateRepresentativeDto, actorId: string, meta: ClientMetaData) {
    const before = await this.prisma.representative.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Representante no encontrado');
    if ((dto.firstName as unknown) === null || (dto.lastName as unknown) === null) throw new BadRequestException('El nombre y el apellido no pueden quedar vacíos');
    if (dto.documentId && dto.documentId !== before.documentId) {
      const dup = await this.prisma.representative.findFirst({ where: { documentId: dto.documentId, id: { not: id } }, select: { firstName: true, lastName: true } });
      if (dup) throw new ConflictException(`Ya existe un representante con esa cédula (${dup.firstName} ${dup.lastName})`);
    }
    if (dto.isActive === false && before.isActive) {
      // Un representante principal de una inscripción vigente no se puede desactivar.
      const principal = await this.prisma.enrollmentRepresentative.count({
        where: { representativeId: id, isPrimary: true, enrollment: { status: { in: ['PENDIENTE', 'ACTIVA'] } } },
      });
      if (principal > 0) throw new ConflictException('Es el representante principal de inscripciones PENDIENTE/ACTIVA: cambia el principal antes de desactivarlo');
    }
    const after = await this.prisma.representative.update({ where: { id }, data: { ...dto, firstName: dto.firstName ?? undefined, lastName: dto.lastName ?? undefined } });
    const changes = diffFields(before, after, AUDITED_FIELDS);
    if (Object.keys(changes).length) await this.audit.log({ userId: actorId, action: 'representative.update', entity: 'Representative', entityId: id, metadata: { changes }, ...meta });
    return present(after);
  }

  /** Foto del representante (JPG/PNG). Reemplaza la anterior y borra el archivo viejo. Usado también desde Inscripciones. */
  async savePhoto(id: string, file: UploadedFileData | undefined, actorId: string, meta: ClientMetaData) {
    const before = await this.prisma.representative.findUnique({ where: { id }, select: { id: true, photoKey: true } });
    if (!before) throw new NotFoundException('Representante no encontrado');
    const saved = await this.files.save(file, `representatives/${id}`, 'image');
    try {
      await this.prisma.representative.update({ where: { id }, data: { photoKey: saved.storageKey } });
    } catch (error) {
      await this.files.remove(saved.storageKey);
      throw error;
    }
    await this.files.remove(before.photoKey);
    await this.audit.log({ userId: actorId, action: 'representative.photo', entity: 'Representative', entityId: id, metadata: { replaced: !!before.photoKey }, ...meta });
    return { hasPhoto: true };
  }

  async photo(id: string, user: AuthUser): Promise<StreamableFile> {
    const rep = await this.prisma.representative.findFirst({ where: { AND: [{ id }, representativeScope(user)] }, select: { photoKey: true } });
    if (!rep) throw new NotFoundException('Representante no encontrado');
    if (!rep.photoKey) throw new NotFoundException('El representante no tiene foto');
    return this.files.stream(rep.photoKey, mimeFromKey(rep.photoKey), 'foto-representante');
  }
}
