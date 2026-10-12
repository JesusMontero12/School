import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ClientMetaData } from '../common/decorators';
import { PrismaService } from '../common/prisma/prisma.service';
import { diffFields } from '../common/utils/diff';
import { toCode } from '../common/utils/normalize';
import { CreateRequirementTypeDto, UpdateRequirementTypeDto } from './dto/requirement-types.dto';

@Injectable()
export class RequirementTypesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** `onlyActive` se usa en los formularios; la pantalla de administración ve todos. */
  list(onlyActive = false) {
    return this.prisma.requirementType.findMany({ where: onlyActive ? { isActive: true } : {}, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async create(dto: CreateRequirementTypeDto, actorId: string, meta: ClientMetaData) {
    const base = toCode(dto.name);
    if (!base) throw new BadRequestException('El nombre debe contener letras o números');
    if (await this.prisma.requirementType.findFirst({ where: { name: { equals: dto.name, mode: 'insensitive' } } }))
      throw new ConflictException('Ya existe un requisito con ese nombre');
    // Código único: si choca con uno existente se añade un sufijo numérico.
    let code = base;
    for (let n = 2; await this.prisma.requirementType.findUnique({ where: { code } }); n++) code = `${base.slice(0, 36)}_${n}`;
    const created = await this.prisma.requirementType.create({
      data: { code, name: dto.name, description: dto.description, isRequired: dto.isRequired ?? true, sortOrder: dto.sortOrder ?? 100 },
    });
    await this.audit.log({ userId: actorId, action: 'requirement_type.create', entity: 'RequirementType', entityId: created.id, metadata: { code, name: created.name }, ...meta });
    return created;
  }

  async update(id: string, dto: UpdateRequirementTypeDto, actorId: string, meta: ClientMetaData) {
    const before = await this.prisma.requirementType.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Requisito no encontrado');
    if (dto.name && dto.name.toLowerCase() !== before.name.toLowerCase() &&
      (await this.prisma.requirementType.findFirst({ where: { name: { equals: dto.name, mode: 'insensitive' }, id: { not: id } } })))
      throw new ConflictException('Ya existe un requisito con ese nombre');
    const after = await this.prisma.requirementType.update({ where: { id }, data: dto });
    await this.audit.log({
      userId: actorId, action: 'requirement_type.update', entity: 'RequirementType', entityId: id,
      metadata: { changes: diffFields(before, after, ['name', 'description', 'isRequired', 'isActive', 'sortOrder']) }, ...meta,
    });
    return after;
  }
}
