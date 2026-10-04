import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { ClientMetaData } from '../common/decorators';
import { paginated } from '../common/dto/pagination.dto';
import { AuthUser } from '../common/types/auth-user';
import { CreateUserDto, ListUsersDto, UpdateUserDto } from './dto/users.dto';
import { UsersRepository } from './users.repository';

type UserRow = NonNullable<Awaited<ReturnType<UsersRepository['findById']>>>;
const SUPER_ADMIN = 'SUPER_ADMIN';

/** Aplana userRoles → roles para que el cliente reciba una forma simple. */
const present = ({ userRoles, ...u }: UserRow) => ({ ...u, roles: userRoles.map((ur) => ur.role) });

@Injectable()
export class UsersService {
  constructor(private repo: UsersRepository, private audit: AuditService) {}

  async list(q: ListUsersDto) {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (q.status) where.isActive = q.status === 'active';
    if (q.roleCode) where.userRoles = { some: { role: { code: q.roleCode } } };
    if (q.search) {
      where.OR = ['firstName', 'lastName', 'email'].map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } }));
    }
    const [rows, total] = await this.repo.findMany(where, (q.page - 1) * q.limit, q.limit);
    return paginated(rows.map(present), total, q);
  }

  async get(id: string) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return present(user);
  }

  async create(dto: CreateUserDto, actor: AuthUser, meta: ClientMetaData) {
    if (await this.repo.findByEmail(dto.email)) throw new ConflictException('Ya existe un usuario con ese correo');
    await this.assertRolesAssignable(dto.roleIds, actor);
    const { password, ...rest } = dto;
    const user = await this.repo.create({ ...rest, passwordHash: await argon2.hash(password, { type: argon2.argon2id }) });
    await this.audit.log({ userId: actor.id, action: 'user.created', entity: 'User', entityId: user.id, metadata: { email: user.email }, ...meta });
    return present(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser, meta: ClientMetaData) {
    await this.get(id);
    const { roleIds, ...data } = dto;
    if (roleIds) await this.changeRoles(id, roleIds, actor);
    const user = await this.repo.update(id, data);
    await this.audit.log({ userId: actor.id, action: 'user.updated', entity: 'User', entityId: id, metadata: { fields: Object.keys(dto) }, ...meta });
    return present(user);
  }

  async setRoles(id: string, roleIds: string[], actor: AuthUser, meta: ClientMetaData) {
    await this.get(id);
    await this.changeRoles(id, roleIds, actor);
    await this.audit.log({ userId: actor.id, action: 'user.roles_changed', entity: 'User', entityId: id, metadata: { roleIds }, ...meta });
    return this.get(id);
  }

  async setStatus(id: string, isActive: boolean, actor: AuthUser, meta: ClientMetaData) {
    const target = await this.get(id);
    if (!isActive) await this.assertCanDeactivate(target, actor);
    const user = await this.repo.update(id, { isActive });
    if (!isActive) await this.repo.revokeSessions(id);
    await this.audit.log({ userId: actor.id, action: isActive ? 'user.activated' : 'user.deactivated', entity: 'User', entityId: id, ...meta });
    return present(user);
  }

  async remove(id: string, actor: AuthUser, meta: ClientMetaData) {
    const target = await this.get(id);
    await this.assertCanDeactivate(target, actor);
    await this.repo.softDelete(id);
    await this.audit.log({ userId: actor.id, action: 'user.deleted', entity: 'User', entityId: id, metadata: { email: target.email }, ...meta });
    return { message: 'Usuario eliminado' };
  }

  // ── reglas de negocio ──

  private async changeRoles(userId: string, roleIds: string[], actor: AuthUser) {
    await this.assertRolesAssignable(roleIds, actor);
    const current = await this.repo.findById(userId);
    const hadSuper = current?.userRoles.some((ur) => ur.role.code === SUPER_ADMIN);
    const willHaveSuper = (await this.repo.rolesByIds(roleIds)).some((r) => r.code === SUPER_ADMIN);
    if (hadSuper && !willHaveSuper && (await this.repo.countActiveWithRole(SUPER_ADMIN, userId)) === 0)
      throw new BadRequestException('Debe existir al menos un Super administrador activo');
    await this.repo.setRoles(userId, roleIds);
  }

  /** Solo un SUPER_ADMIN puede asignar SUPER_ADMIN (evita escalada de privilegios). */
  private async assertRolesAssignable(roleIds: string[], actor: AuthUser) {
    if ((await this.repo.countRoles(roleIds)) !== new Set(roleIds).size) throw new BadRequestException('Alguno de los roles no existe');
    const wantsSuper = (await this.repo.rolesByIds(roleIds)).some((r) => r.code === SUPER_ADMIN);
    if (wantsSuper && !actor.roles.includes(SUPER_ADMIN)) throw new ForbiddenException('Solo un Super administrador puede asignar ese rol');
  }

  private async assertCanDeactivate(target: ReturnType<typeof present>, actor: AuthUser) {
    if (target.id === actor.id) throw new BadRequestException('No puedes desactivar ni eliminar tu propia cuenta');
    const isSuper = target.roles.some((r) => r.code === SUPER_ADMIN);
    if (isSuper && !actor.roles.includes(SUPER_ADMIN)) throw new ForbiddenException('No puedes modificar a un Super administrador');
    if (isSuper && (await this.repo.countActiveWithRole(SUPER_ADMIN, target.id)) === 0)
      throw new BadRequestException('Debe existir al menos un Super administrador activo');
  }
}
