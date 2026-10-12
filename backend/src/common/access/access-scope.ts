import { Prisma } from '@prisma/client';
import { AuthUser } from '../types/auth-user';

/** Roles de familia: solo deben ver sus propios registros. */
const FAMILY_ROLES = ['REPRESENTANTE', 'ESTUDIANTE'];

/**
 * true si TODOS los roles del usuario son de familia. Quien además tenga un rol de personal
 * (docente, administrativo, director…) ve todo según sus permisos.
 */
export const isOwnRecordsOnly = (user: AuthUser) =>
  user.roles.length > 0 && user.roles.every((role) => FAMILY_ROLES.includes(role));

/** Filtro de alumnos visibles: el propio alumno, o los que representa este usuario. */
export const studentScope = (user: AuthUser): Prisma.StudentWhereInput =>
  isOwnRecordsOnly(user)
    ? { OR: [{ userId: user.id }, { representatives: { some: { representative: { userId: user.id } } } }] }
    : {};

/** Filtro de representantes visibles: solo el propio. */
export const representativeScope = (user: AuthUser): Prisma.RepresentativeWhereInput =>
  isOwnRecordsOnly(user) ? { userId: user.id } : {};
