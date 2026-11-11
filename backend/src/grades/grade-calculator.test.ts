/**
 * Pruebas de la fórmula de notas (sin dependencias: usa el test runner de Node).
 * Ejecutar:  npm run test:calc
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeAnnualResult, computeTermResult, toCents, TermInput, TermResult } from './grade-calculator';

const base = (over: Partial<TermInput>): TermInput => ({ continuous: [], lapso: null, hasLapsoTest: false, closed: false, ...over });

test('ejemplo del colegio: 10,3 + 2,2 = 12,5 → 13 (con prueba de lapso)', () => {
  // Σ obtenidos 103 de 140 → promedio 14,714285… × 0,70 = 10,3 ; prueba 11/30 × 6 = 2,2
  const r = computeTermResult(base({
    continuous: [{ max: 40, points: 30 }, { max: 50, points: 38 }, { max: 50, points: 35 }],
    lapso: { max: 30, points: 11 }, hasLapsoTest: true, closed: true,
  }));
  assert.equal(r.continuousContribution, '10.30');
  assert.equal(r.lapsoContribution, '2.20');
  assert.equal(r.rawScore, '12.50');
  assert.equal(r.score, 13);
  assert.equal(r.status, 'DEFINITIVA');
  assert.equal(r.passed, true);
});

test('sin prueba de lapso: promedio proporcional al 100 %', () => {
  const r = computeTermResult(base({ continuous: [{ max: 20, points: 15 }, { max: 10, points: 8 }] }));
  assert.equal(r.continuousAverage, '15.33'); // 23 × 20 / 30
  assert.equal(r.score, 15);
  assert.equal(r.lapsoContribution, null);
  assert.equal(r.status, 'PROVISIONAL'); // momento aún abierto
});

test('redondeo: 12,50 sube a 13 y 12,498 baja a 12 (sin errores de coma flotante)', () => {
  assert.equal(computeTermResult(base({ continuous: [{ max: 8, points: 5 }] })).score, 13); // 12,5 exacto
  assert.equal(computeTermResult(base({ continuous: [{ max: 100, points: 62.49 }] })).score, 12); // 12,498
  assert.equal(computeTermResult(base({ continuous: [{ max: 100, points: 62.5 }] })).score, 13); // 12,5
});

test('una evaluación pendiente NO cuenta como cero', () => {
  const r = computeTermResult(base({ continuous: [{ max: 20, points: 18 }, { max: 20, points: null }] }));
  assert.equal(r.score, 18);
  assert.equal(r.pendingEvaluations, 1);
});

test('sin evaluaciones calificadas, o con máximos en cero: no hay nota', () => {
  const none = computeTermResult(base({ continuous: [{ max: 20, points: null }] }));
  assert.equal(none.status, 'SIN_NOTA');
  assert.equal(none.missing, 'SIN_EVALUACIONES_CALIFICADAS');
  assert.equal(none.score, null);
  assert.equal(computeTermResult(base({ continuous: [] })).status, 'SIN_NOTA');
  assert.equal(computeTermResult(base({ continuous: [{ max: 0, points: 0 }] })).status, 'SIN_NOTA');
});

test('con prueba de lapso configurada pero sin calificar: no se calcula (no se inventa el 70 %)', () => {
  const noTestYet = computeTermResult(base({ continuous: [{ max: 20, points: 18 }], hasLapsoTest: true }));
  assert.equal(noTestYet.status, 'SIN_NOTA');
  assert.equal(noTestYet.missing, 'FALTA_PRUEBA_DE_LAPSO');
  assert.equal(noTestYet.continuousAverage, '18.00');
  const ungraded = computeTermResult(base({
    continuous: [{ max: 20, points: 18 }], hasLapsoTest: true, lapso: { max: 30, points: null },
  }));
  assert.equal(ungraded.missing, 'FALTA_PRUEBA_DE_LAPSO');
  assert.equal(ungraded.pendingEvaluations, 1);
});

test('la nota mínima del momento es 1', () => {
  assert.equal(computeTermResult(base({ continuous: [{ max: 20, points: 0 }, { max: 10, points: 0 }] })).score, 1);
  const withLapso = computeTermResult(base({
    continuous: [{ max: 20, points: 0 }], lapso: { max: 20, points: 0 }, hasLapsoTest: true,
  }));
  assert.equal(withLapso.score, 1);
  assert.equal(withLapso.passed, false);
});

test('máximo: todo perfecto da 20 con y sin prueba de lapso', () => {
  assert.equal(computeTermResult(base({ continuous: [{ max: 10, points: 10 }] })).score, 20);
  assert.equal(computeTermResult(base({
    continuous: [{ max: 10, points: 10 }], lapso: { max: 5, points: 5 }, hasLapsoTest: true,
  })).score, 20);
});

test('aprobatorio desde 10', () => {
  assert.equal(computeTermResult(base({ continuous: [{ max: 20, points: 10 }] })).passed, true);
  assert.equal(computeTermResult(base({ continuous: [{ max: 20, points: 9.49 }] })).passed, false); // 9,49 → 9
});

test('momento cerrado → DEFINITIVA; abierto → PROVISIONAL', () => {
  const evals = [{ max: 20, points: 14 }];
  assert.equal(computeTermResult(base({ continuous: evals, closed: true })).status, 'DEFINITIVA');
  assert.equal(computeTermResult(base({ continuous: evals, closed: false })).status, 'PROVISIONAL');
});

const term = (score: number | null, status: TermResult['status'] = 'DEFINITIVA'): TermResult => ({
  status, score, rawScore: null, continuousAverage: null, continuousContribution: null, lapsoContribution: null,
  pendingEvaluations: 0, missing: null, passed: null,
});

test('anual: promedio de los 3 momentos redondeado al entero', () => {
  assert.equal(computeAnnualResult([term(13), term(14), term(14)]).score, 14); // 13,67
  assert.equal(computeAnnualResult([term(10), term(10), term(11)]).score, 10); // 10,33
  assert.equal(computeAnnualResult([term(9), term(10), term(10)]).passed, true); // 9,67 → 10 aprueba
  assert.equal(computeAnnualResult([term(9), term(9), term(10)]).passed, false); // 9,33 → 9
});

test('anual: sin los tres momentos no hay nota; provisional si alguno no está cerrado', () => {
  const missing = computeAnnualResult([term(13), term(null), term(14)]);
  assert.equal(missing.status, 'SIN_NOTA');
  assert.equal(missing.missing, 'FALTAN_MOMENTOS');
  assert.equal(computeAnnualResult([term(13), term(14), term(15, 'PROVISIONAL')]).status, 'PROVISIONAL');
  assert.equal(computeAnnualResult([term(13), term(14), term(15)]).status, 'DEFINITIVA');
  assert.equal(computeAnnualResult([null, null, null]).status, 'SIN_NOTA');
});

test('toCents acepta Decimal-como-texto y rechaza valores inválidos', () => {
  assert.equal(toCents('18.5'), 1850n);
  assert.equal(toCents('18'), 1800n);
  assert.equal(toCents(0.07), 7n);
  assert.throws(() => toCents('-1'));
  assert.throws(() => toCents('abc'));
  assert.throws(() => toCents('1.234'));
});
