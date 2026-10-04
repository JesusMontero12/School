import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user';

export const SUPER_ADMIN = 'SUPER_ADMIN';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  /** Devuelve el usuario con roles y permisos efectivos, o null si no puede operar. */
  async loadAuthUser(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
      include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    });
    if (!user) return null;

    const roles = user.userRoles.map((ur) => ur.role.code);
    // SUPER_ADMIN recibe siempre el catálogo completo, incluso permisos nuevos aún no asignados.
    const permissions = roles.includes(SUPER_ADMIN)
      ? (await this.prisma.permission.findMany({ select: { code: true } })).map((p) => p.code)
      : [...new Set(user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)))];

    return {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      mustChangePassword: user.mustChangePassword, roles, permissions: permissions.sort(),
    };
  }
}
