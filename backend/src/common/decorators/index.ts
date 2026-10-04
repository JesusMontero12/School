import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';

/** Marca una ruta como pública (sin JWT). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
/** El usuario debe tener AL MENOS UNO de estos roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
/** El usuario debe tener TODOS estos permisos. */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser =>
  ctx.switchToHttp().getRequest().user);

export type ClientMetaData = { ip?: string; userAgent?: string };
export const ClientMeta = createParamDecorator((_: unknown, ctx: ExecutionContext): ClientMetaData => {
  const req = ctx.switchToHttp().getRequest();
  return { ip: req.ip as string, userAgent: (req.headers['user-agent'] as string) ?? undefined };
});
