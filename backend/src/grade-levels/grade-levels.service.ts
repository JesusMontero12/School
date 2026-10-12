import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ClientMetaData } from '../common/decorators';
import { PrismaService } from '../common/prisma/prisma.service';
import { diffFields } from '../common/utils/diff';
import { UpdateGradeLevelDto } from './dto/grade-levels.dto';

@Injectable()
export class GradeLevelsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** Los 5 años (1er a 5to) vienen del seed: no se crean ni se eliminan desde la API. */
  async list() {
    const rows = await this.prisma.gradeLevel.findMany({ orderBy: { number: 'asc' }, include: { _count: { select: { sections: true } } } });
    return rows.map(({ _count, ...g }) => ({ ...g, sectionsCount: _count.sections }));
  }

  async update(id: string, dto: UpdateGradeLevelDto, actorId: string, meta: ClientMetaData) {
    const before = await this.prisma.gradeLevel.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Año/grado no encontrado');
    if (dto.name && dto.name !== before.name && (await this.prisma.gradeLevel.findUnique({ where: { name: dto.name } })))
      throw new ConflictException('Ya existe un año/grado con ese nombre');
    if (dto.isActive === false && before.isActive) {
      const occupied = await this.prisma.enrollment.count({
        where: { status: { in: ['PENDIENTE', 'ACTIVA'] }, section: { gradeLevelId: id }, schoolYear: { status: { not: 'CERRADO' } } },
      });
      if (occupied > 0) throw new ConflictException(`No se puede desactivar: hay ${occupied} inscripción(es) PENDIENTE/ACTIVA en este año/grado`);
    }
    const after = await this.prisma.gradeLevel.update({ where: { id }, data: { name: dto.name, isActive: dto.isActive } });
    await this.audit.log({
      userId: actorId, action: 'grade_level.update', entity: 'GradeLevel', entityId: id,
      metadata: { changes: diffFields(before, after, ['name', 'isActive']) }, ...meta,
    });
    return after;
  }
}
