import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

/** Nunca se expone passwordHash ni campos de seguridad internos. */
export const userSelect = {
  id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true,
  mustChangePassword: true, lastLoginAt: true, createdAt: true, updatedAt: true,
  userRoles: { select: { role: { select: { id: true, code: true, name: true } } } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  findMany(where: Prisma.UserWhereInput, skip: number, take: number) {
    return this.prisma.$transaction([
      this.prisma.user.findMany({ where, skip, take, orderBy: [{ createdAt: 'desc' }], select: userSelect }),
      this.prisma.user.count({ where }),
    ]);
  }
  findById(id: string) { return this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: userSelect }); }
  findByEmail(email: string) { return this.prisma.user.findUnique({ where: { email }, select: { id: true } }); }

  create(data: { email: string; firstName: string; lastName: string; phone?: string; passwordHash: string; roleIds: string[] }) {
    const { roleIds, ...rest } = data;
    return this.prisma.user.create({
      data: { ...rest, mustChangePassword: true, userRoles: { create: roleIds.map((roleId) => ({ roleId })) } },
      select: userSelect,
    });
  }
  update(id: string, data: Prisma.UserUpdateInput) { return this.prisma.user.update({ where: { id }, data, select: userSelect }); }

  setRoles(userId: string, roleIds: string[]) {
    return this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) }),
    ]);
  }
  softDelete(id: string) {
    return this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }
  revokeSessions(userId: string) {
    return this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  countActiveWithRole(code: string, excludeUserId?: string) {
    return this.prisma.user.count({
      where: { isActive: true, deletedAt: null, id: excludeUserId ? { not: excludeUserId } : undefined, userRoles: { some: { role: { code } } } },
    });
  }
  countRoles(ids: string[]) { return this.prisma.role.count({ where: { id: { in: ids } } }); }
  rolesByIds(ids: string[]) { return this.prisma.role.findMany({ where: { id: { in: ids } }, select: { code: true } }); }
}
