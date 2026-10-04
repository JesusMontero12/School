import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const include = {
  rolePermissions: { select: { permission: { select: { id: true, code: true, module: true } } } },
  _count: { select: { userRoles: true } },
} as const;

@Injectable()
export class RolesRepository {
  constructor(private prisma: PrismaService) {}
  findAll() { return this.prisma.role.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }], include }); }
  findById(id: string) { return this.prisma.role.findUnique({ where: { id }, include }); }
  findByCode(code: string) { return this.prisma.role.findUnique({ where: { code } }); }
  create(data: { code: string; name: string; description?: string }) { return this.prisma.role.create({ data, include }); }
  update(id: string, data: { name?: string; description?: string }) { return this.prisma.role.update({ where: { id }, data, include }); }
  delete(id: string) { return this.prisma.role.delete({ where: { id } }); }
  setPermissions(roleId: string, permissionIds: string[]) {
    return this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })) }),
    ]);
  }
}
