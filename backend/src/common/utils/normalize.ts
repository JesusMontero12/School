/** Quita espacios sobrantes (inicio, fin y repetidos). */
export const clean = (value: string) => value.trim().replace(/\s+/g, ' ');

/**
 * Forma canónica de un número de identificación (cédula o cédula escolar):
 * mayúsculas, sin espacios, puntos ni guiones, y sin la letra de nacionalidad (V/E).
 * "V-12.345.678" y "12345678" quedan iguales, así la búsqueda y la unicidad no dependen de cómo se escribió.
 */
export function normalizeIdentification(raw: string): string {
  const compact = raw.toUpperCase().replace(/[\s.\-_/]/g, '');
  return /^[VE]\d+$/.test(compact) ? compact.slice(1) : compact;
}

/** No exige formato de C.I. venezolana: solo 4 a 20 letras o números (permite cédula escolar). */
export const IDENTIFICATION_PATTERN = /^[A-Z0-9]{4,20}$/;

/** Parte un texto de búsqueda en palabras (para buscar "juan perez" en nombres y apellidos). */
export const tokens = (search: string) => clean(search).split(' ').filter(Boolean).slice(0, 5);

/** Texto → código MAYÚSCULAS_CON_GUIONES_BAJOS, sin tildes ("Acta de Grado" → "ACTA_DE_GRADO"). */
export const toCode = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
