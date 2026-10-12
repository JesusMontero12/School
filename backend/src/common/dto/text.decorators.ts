import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, Matches, MaxLength } from 'class-validator';
import { clean, IDENTIFICATION_PATTERN, normalizeIdentification } from '../utils/normalize';

/** Quita espacios sobrantes. Texto vacío → null (sirve para campos opcionales que se pueden borrar). */
export const CleanText = () =>
  Transform(({ value }) => (typeof value === 'string' ? clean(value) || null : value));

/** Número de identificación en su forma canónica (sin V/E, puntos ni guiones, en mayúsculas). */
export const IdentificationNumber = () =>
  applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? normalizeIdentification(value) : value)),
    Matches(IDENTIFICATION_PATTERN, { message: 'El número de identificación debe tener entre 4 y 20 letras o números' }),
  );

/** Correo electrónico: sin espacios y en minúsculas. Vacío → null. */
export const EmailAddress = () =>
  applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() || null : value)),
    IsEmail({}, { message: 'Escribe un correo electrónico válido' }),
    MaxLength(120, { message: 'El correo no puede superar 120 caracteres' }),
  );

/** Código SIGES: mayúsculas, sin espacios. Vacío → null. */
export const SigesCode = () =>
  applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() || null : value)),
    Matches(/^[A-Z0-9-]{3,30}$/, { message: 'El código SIGES debe tener entre 3 y 30 letras, números o guiones' }),
  );
