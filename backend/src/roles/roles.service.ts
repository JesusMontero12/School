import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ClientMetaData } from '../common/decorators';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/roles.dto';
import { RolesRepository } from './roles.repository';

type RoleRow = NonNullable<Awaited<ReturnType<RolesRepository['findById']>>>;
const present = ({ rolePermissions, _count, ...r }: RoleRow) => ({
  ...r, usersCount: _count.userRoles, permissions: rolePermissions.map((rp) => rp.permission),
});
const SUPER_ADMIN = 'SUPER_ADMIN';

@Injectable()
export class RolesService {
  constructor(private repo: RolesRepository, private permissions: PermissionsService, private audit: AuditService) {}

  async options() { return (await this.repo.findAll()).map(({ id, code, name }) => ({ id, code, name })); }

  async list() { return (await this.repo.findAll()).map(present); }

  async get(id: string) {
    const role = await this.repo.findById(id);
    if (!role) throw new NotFoundException('Rol no encontrado');
    return present(role);
  }

  async create(dto: CreateRoleDto, actorId: string, meta: ClientMetaData) {
    if (await this.repo.findByCode(dto.code)) throw new ConflictException('Ya existe un rol con ese código');
    const role = await this.repo.create(dto);
    await this.audit.log({ userId: actorId, action: 'role.created', entity: 'Role', entityId: role.id, metadata: { code: role.code }, ...meta });
    return present(role);
  }

  async update(id: string, dto: UpdateRoleDto, actorId: string, meta: ClientMetaData) {
    await this.get(id);
    const role = await this.repo.update(id, dto);
    await this.audit.log({ userId: actorId, action: 'role.updated', entity: 'Role', entityId: id, ...meta });
    return present(role);
  }

  async setPermissions(id: string, permissionIds: string[], actorId: string, meta: ClientMetaData) {
    const role = await this.get(id);
    if (role.code === SUPER_ADMIN) throw new BadRequestException('Los permisos del Super administrador no se pueden modificar');
    if ((await this.permissions.countByIds(permissionIds)) !== permissionIds.length) throw new BadRequestException('Alguno de los permisos no existe');
    await this.repo.setPermissions(id, permissionIds);
    await this.audit.log({ userId: actorId, action: 'role.permissions_changed', entity: 'Role', entityId: id, metadata: { total: permissionIds.length }, ...meta });
    return this.get(id);
  }

  async remove(id: string, actorId: string, meta: ClientMetaData) {
    const role = await this.get(id);
    if (role.isSystem) throw new BadRequestException('Los roles del sistema no se pueden eliminar');
    if (role.usersCount > 0) throw new ConflictException('Reasigna a los usuarios de este rol antes de eliminarlo');
    await this.repo.delete(id);
    await this.audit.log({ userId: actorId, action: 'role.deleted', entity: 'Role', entityId: id, metadata: { code: role.code }, ...meta });
    return { message: 'Rol eliminado' };
  }
}
