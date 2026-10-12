import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsDate } from 'class-validator';

/** 'AAAA-MM-DD' → Date UTC 00:00, o el texto original si no es una fecha real. */
const toDateOnly = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00.000Z`);
  // JavaScript "corrige" 2026-02-31 a 2026-03-02: se exige que la fecha convertida coincida con lo escrito.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : value;
};

/**
 * Campo de fecha "solo día": acepta 'AAAA-MM-DD' y lo convierte a Date (UTC 00:00).
 * Rechaza fechas imposibles como 2026-02-31. Se combina con @IsOptional() cuando es opcional.
 */
export const DateOnly = () =>
  applyDecorators(
    Transform(({ value }) => toDateOnly(value)),
    IsDate({ message: 'Fecha inválida: usa el formato AAAA-MM-DD' }),
  );
