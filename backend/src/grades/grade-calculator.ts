/**
 * Cálculo de notas. Implementa, sin añadir reglas propias, lo definido por el colegio:
 *
 *  · Escala de 1 a 20; 10 es la nota mínima aprobatoria.
 *  · Continuas: promedio proporcional = (Σ puntos obtenidos × 20) / Σ puntajes máximos. Sin ponderaciones individuales.
 *  · Si la materia lleva prueba de lapso en ese momento: continuas 70 % (máx. 14 pts) + prueba 30 % (máx. 6 pts):
 *        aporte continuo = promedio × 0,70
 *        aporte de la prueba = (puntos / máximo de la prueba) × 6
 *  · Sin prueba de lapso: las continuas valen el 100 %.
 *  · Los decimales se conservan en todo el cálculo; solo se redondea la nota del momento
 *    (al entero más cercano; 0,50 o más sube).
 *  · Una evaluación sin calificar NUNCA cuenta como cero. Sin evaluaciones calificadas (o con Σ máximos = 0) no hay promedio.
 *  · La nota mínima del momento es 1.
 *  · Nota anual = promedio de las tres notas de momento, con el mismo redondeo.
 *
 * Aritmética EXACTA: los puntos se convierten a centésimas enteras y todo se opera como fracción
 * de BigInt. Así 12,5 es exactamente 12,5 (y sube a 13) y no hay errores de coma flotante.
 * Este archivo no depende de Nest ni de Prisma: se prueba solo (grade-calculator.test.ts).
 */

export const MIN_SCORE = 1;
export const MAX_SCORE = 20;
export const PASSING_SCORE = 10;
/** Puntos que aporta la prueba de lapso (30 % de 20). */
export const LAPSO_POINTS = 6;
/** Puntos máximos que aportan las continuas cuando hay prueba de lapso (70 % de 20). */
export const CONTINUOUS_POINTS_WITH_LAPSO = 14;
export const TERMS_PER_YEAR = 3;

type Frac = { n: bigint; d: bigint };
type Numeric = string | number | { toString(): string };

/** '18.5' | 18.5 | Decimal → centésimas enteras (1850n). Rechaza negativos, texto y más de 2 decimales. */
export function toCents(value: Numeric): bigint {
  const text = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) throw new Error(`Valor numérico inválido: "${text}"`);
  return BigInt(m[1]) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
}

/** Redondeo al entero más cercano; la mitad sube (n ≥ 0, d > 0). */
const roundHalfUp = ({ n, d }: Frac): bigint => (2n * n + d) / (2n * d);

/** Fracción → texto decimal con `decimals` cifras (redondeo half-up). Solo para mostrar. */
function format({ n, d }: Frac, decimals = 2): string {
  const scale = 10n ** BigInt(decimals);
  const v = roundHalfUp({ n: n * scale, d }).toString().padStart(decimals + 1, '0');
  return `${v.slice(0, -decimals)}.${v.slice(-decimals)}`;
}

export interface ScoreInput {
  /** Puntaje máximo de la evaluación. */
  max: Numeric;
  /** Puntos obtenidos; null = pendiente de calificar. */
  points: Numeric | null;
}

export interface TermInput {
  continuous: ScoreInput[];
  /** La prueba de lapso de la materia/sección/momento, si ya fue creada. */
  lapso: ScoreInput | null;
  /** ¿La materia lleva prueba de lapso en este momento? (configuración del colegio) */
  hasLapsoTest: boolean;
  /** Momento CERRADO → el resultado es definitivo; si no, provisional. */
  closed: boolean;
}

/** SIN_NOTA: aún no se puede calcular · PROVISIONAL: calculada pero el momento sigue abierto · DEFINITIVA: momento cerrado. */
export type ResultStatus = 'SIN_NOTA' | 'PROVISIONAL' | 'DEFINITIVA';
export type MissingReason = 'SIN_EVALUACIONES_CALIFICADAS' | 'FALTA_PRUEBA_DE_LAPSO' | 'FALTAN_MOMENTOS';

export interface TermResult {
  status: ResultStatus;
  /** Nota del momento: entero de 1 a 20. */
  score: number | null;
  /** Valor antes de redondear, con 2 decimales (informativo). */
  rawScore: string | null;
  /** Promedio proporcional de las continuas, sobre 20. */
  continuousAverage: string | null;
  /** Lo que aportan las continuas a la nota: el 70 % del promedio con prueba de lapso, o el promedio completo sin ella. */
  continuousContribution: string | null;
  /** Lo que aporta la prueba de lapso (máx. 6). null si la materia no la lleva o aún no está calificada. */
  lapsoContribution: string | null;
  /** Evaluaciones creadas que este alumno todavía no tiene calificadas. */
  pendingEvaluations: number;
  missing: MissingReason | null;
  passed: boolean | null;
}

export function computeTermResult(input: TermInput): TermResult {
  const graded = input.continuous.filter((e) => e.points !== null);
  const lapsoPending = input.hasLapsoTest && input.lapso !== null && input.lapso.points === null ? 1 : 0;
  const pendingEvaluations = input.continuous.length - graded.length + lapsoPending;

  const blank = (missing: MissingReason, continuousAverage: string | null = null): TermResult => ({
    status: 'SIN_NOTA', score: null, rawScore: null, continuousAverage, continuousContribution: null,
    lapsoContribution: null, pendingEvaluations, missing, passed: null,
  });

  const sumMax = graded.reduce((acc, e) => acc + toCents(e.max), 0n);
  if (graded.length === 0 || sumMax === 0n) return blank('SIN_EVALUACIONES_CALIFICADAS');
  const sumPoints = graded.reduce((acc, e) => acc + toCents(e.points as Numeric), 0n);

  // Σ puntos × 20 / Σ máximos  (las centésimas se cancelan)
  const average: Frac = { n: sumPoints * 20n, d: sumMax };
  const averageText = format(average);

  let raw: Frac;
  let continuous: Frac;
  let lapsoContribution: Frac | null = null;
  if (!input.hasLapsoTest) {
    raw = continuous = average;
  } else {
    if (!input.lapso || input.lapso.points === null) return blank('FALTA_PRUEBA_DE_LAPSO', averageText);
    const lapsoMax = toCents(input.lapso.max);
    if (lapsoMax === 0n) return blank('FALTA_PRUEBA_DE_LAPSO', averageText);
    continuous = { n: BigInt(CONTINUOUS_POINTS_WITH_LAPSO) * sumPoints, d: sumMax }; // promedio × 0,70
    lapsoContribution = { n: BigInt(LAPSO_POINTS) * toCents(input.lapso.points), d: lapsoMax };
    raw = { n: continuous.n * lapsoContribution.d + lapsoContribution.n * continuous.d, d: continuous.d * lapsoContribution.d };
  }

  let score = Number(roundHalfUp(raw));
  score = Math.min(MAX_SCORE, Math.max(MIN_SCORE, score));
  return {
    status: input.closed ? 'DEFINITIVA' : 'PROVISIONAL',
    score, rawScore: format(raw), continuousAverage: averageText,
    continuousContribution: format(continuous), lapsoContribution: lapsoContribution ? format(lapsoContribution) : null,
    pendingEvaluations, missing: null, passed: score >= PASSING_SCORE,
  };
}

export interface AnnualResult {
  status: ResultStatus;
  /** Nota anual: entero de 1 a 20. */
  score: number | null;
  rawScore: string | null;
  missing: MissingReason | null;
  passed: boolean | null;
}

/**
 * Promedio simple de las notas definitivas de los tres momentos. Sin las tres notas no hay nota anual
 * (no se promedian menos momentos). Es DEFINITIVA solo cuando los tres momentos están cerrados.
 */
export function computeAnnualResult(terms: (TermResult | null)[]): AnnualResult {
  const scores = terms.map((t) => t?.score ?? null);
  if (scores.length !== TERMS_PER_YEAR || scores.some((s) => s === null))
    return { status: 'SIN_NOTA', score: null, rawScore: null, missing: 'FALTAN_MOMENTOS', passed: null };
  const sum = scores.reduce<bigint>((acc, s) => acc + BigInt(s as number), 0n);
  const avg: Frac = { n: sum, d: BigInt(TERMS_PER_YEAR) };
  const score = Math.min(MAX_SCORE, Math.max(MIN_SCORE, Number(roundHalfUp(avg))));
  const definitive = terms.every((t) => t?.status === 'DEFINITIVA');
  return { status: definitive ? 'DEFINITIVA' : 'PROVISIONAL', score, rawScore: format(avg), missing: null, passed: score >= PASSING_SCORE };
}
