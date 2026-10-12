import { Prisma } from '@prisma/client';
import { normalizeIdentification, tokens } from '../common/utils/normalize';

/** Cada palabra debe aparecer en nombre, apellido, número de identificación o código SIGES (ej. "juan 1234"). */
export const studentSearch = (search?: string): Prisma.StudentWhereInput[] =>
  search
    ? tokens(search).map((t) => ({
      OR: [
        { firstName: { contains: t, mode: 'insensitive' } },
        { lastName: { contains: t, mode: 'insensitive' } },
        { identificationNumber: { contains: normalizeIdentification(t) } },
        { sigesCode: { contains: t, mode: 'insensitive' } },
      ],
    }))
    : [];
