// Postęp CFA względem planu i elementy sesji treningowej (przerwa, następna seria) — dane fikcyjne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cfaPace } from '../../src/core/calc/cfa.js';
import { restSeconds, nextSet } from '../../src/core/calc/training.js';
import { SRC } from '../../src/core/data.js';

const B = [
  { nr: 1, data: '2026-01-05' }, { nr: 2, data: '2026-01-05' }, { nr: 3, data: '2026-01-06' },
  { nr: 4, data: '2026-01-07' }, { nr: 5, data: '2026-01-07' }, { nr: 6, data: '2026-01-08' },
];

test('cfaPace: zaległe tylko z dni przed dzisiejszym', () => {
  const p = cfaPace(B, new Set([1, 6]), '2026-01-07');
  assert.equal(p.due, 3);
  assert.equal(p.doneDue, 1);
  assert.deepEqual(p.overdue.map(b => b.nr), [2, 3]);
  assert.equal(p.today, 2);
  assert.equal(p.todayDone, 0);
  assert.equal(p.ahead, 1);
});

test('cfaPace: przed startem planu i po jego końcu', () => {
  assert.deepEqual([cfaPace(B, new Set(), '2026-01-01').due, cfaPace(B, new Set(), '2026-01-01').overdue.length], [0, 0]);
  const end = cfaPace(B, new Set([1, 2, 3, 4, 5, 6]), '2026-02-01');
  assert.deepEqual([end.due, end.overdue.length, end.ahead], [6, 0, 0]);
});

test('cfaPace na prawdziwym harmonogramie: start CFA 13.10 — 10 bloków (A–J), 15.10 i 23.10 / 25.10 bez J, od 03.11 po 13 (plan V3, D-101)', () => {
  const D = SRC.cfa.D, P = d => cfaPace(D.bloki, new Set(), d);
  assert.deepEqual([P('2026-10-08').due, P('2026-10-08').today, P('2026-10-12').due, P('2026-10-12').today], [0, 0, 0, 0], 'dni przed 13.10: bez bloków CFA');
  assert.deepEqual([P('2026-10-13').due, P('2026-10-13').today], [0, 10]);
  assert.deepEqual([P('2026-10-14').due, P('2026-10-14').today], [10, 10]);
  assert.deepEqual([P('2026-10-15').due, P('2026-10-15').today], [20, 9], 'czwartek 15.10 — 9 bloków (bez J)');
  assert.equal(P('2026-10-16').due, 10 + 10 + 9, '13–15.10');
  assert.equal(P('2026-11-04').today, 13, 'od 03.11 — A–I, K, L, M i J');
  assert.equal(P('2026-11-12').due, D.bloki.length, 'po planie: wszystkie bloki zaległe');
});

test('restSeconds: zapisy przerw z planu treningowego', () => {
  assert.deepEqual(restSeconds('2–3 min'), { min: 120, max: 180 });
  assert.deepEqual(restSeconds('90 s'), { min: 90, max: 90 });
  assert.deepEqual(restSeconds('60 s'), { min: 60, max: 60 });
  assert.deepEqual(restSeconds('2 min'), { min: 120, max: 120 });
  assert.equal(restSeconds(''), null);
  assert.equal(restSeconds('dowolnie'), null);
});

test('restSeconds: każda przerwa w danych TRENING jest czytelna', () => {
  const all = Object.values(SRC.training.days).flat().map(e => (e.raw ? e.raw[4] : e.rest));
  assert.deepEqual(all.filter(r => !restSeconds(r)), []);
});

test('nextSet: pierwsza nieodhaczona seria w kolejności planu', () => {
  const plan = [{ e: { id: 'a' }, n: 2 }, { e: { id: 'b' }, n: 0 }, { e: { id: 'c' }, n: 1 }];
  const d = '2026-01-05';
  assert.deepEqual(nextSet(plan, {}, d), { e: { id: 'a' }, set: 1, of: 2 });
  assert.equal(nextSet(plan, { [`${d}|a|1`]: { done: true } }, d).set, 2);
  const t = { [`${d}|a|1`]: { done: true }, [`${d}|a|2`]: { done: true } };
  assert.equal(nextSet(plan, t, d).e.id, 'c');                       // ćwiczenie spoza fazy (n = 0) pominięte
  assert.equal(nextSet(plan, { ...t, [`${d}|c|1`]: { done: true } }, d), null);
  assert.equal(nextSet(plan, { [`${d}|a|1`]: { done: false, kg: 40 } }, d).set, 1); // wpisany ciężar ≠ odhaczenie
});
