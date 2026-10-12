/**
 * Fechas "solo día" (columnas @db.Date). Se manejan como Date en UTC 00:00 para que
 * no se corran de día según la zona horaria del servidor.
 */

/** Hoy en la zona horaria del colegio (SCHOOL_TIMEZONE, por defecto America/Caracas). */
export function today(): Date {
  const timeZone = process.env.SCHOOL_TIMEZONE ?? 'America/Caracas';
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** 'AAAA-MM-DD' → Date UTC 00:00 (Invalid Date si el texto no es una fecha real). */
export const parseDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** Date → 'AAAA-MM-DD' (formato que consume el frontend; null si no hay fecha). */
export function ymd(date: Date): string;
export function ymd(date: Date | null | undefined): string | null;
export function ymd(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);
